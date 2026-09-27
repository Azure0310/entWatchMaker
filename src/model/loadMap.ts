import { parseEntityLump, type ParsedEntityLump } from '../formats/entityLump';
import { VpkArchive, classifyVpkFileName, type ByteSource } from '../formats/vpk';
import { extractVmapEntities, parseVmapFile, type VmapFile } from '../formats/vmap';
import type { MapEntity, ParsedMap } from './entity';

export type ProgressFn = (message: string, done?: number, total?: number) => void;

function finish(map: Omit<ParsedMap, 'stats'>): ParsedMap {
  return {
    ...map,
    stats: {
      lumps: new Set(map.entities.map((e) => e.source.container)).size,
      entities: map.entities.length,
      connections: map.entities.reduce((n, e) => n + e.connections.length, 0),
      weapons: map.entities.filter((e) => e.classname.startsWith('weapon_')).length,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Compiled maps (workshop .vpk)
// ---------------------------------------------------------------------------------------------

/**
 * Finds the package that actually holds the compiled map. CS2 workshop items are addon packages
 * with the compiled map nested inside as `maps/<name>.vpk`, so we descend into nested vpks
 * (without copying them) until entity lumps show up.
 */
async function findMapPackage(
  pak: VpkArchive,
  progress: ProgressFn | undefined,
  depth: number,
  chain: string[],
): Promise<{ pak: VpkArchive; chain: string[] } | null> {
  if (pak.entries.some((e) => e.ext === 'vents_c')) return { pak, chain };
  if (depth >= 2) return null;
  const nested = pak.entries
    .filter((e) => e.ext === 'vpk' && e.length > 0)
    // compiled maps first, biggest first
    .sort((a, b) => Number(b.dir.toLowerCase().startsWith('maps')) - Number(a.dir.toLowerCase().startsWith('maps')) || b.length - a.length);
  for (const entry of nested) {
    progress?.(`Opening nested package ${entry.path}`);
    try {
      const inner = await pak.openNested(entry);
      const found = await findMapPackage(inner, progress, depth + 1, [...chain, entry.path]);
      if (found) return found;
    } catch (err) {
      progress?.(`Skipping ${entry.path}: ${(err as Error).message}`);
    }
  }
  return null;
}

function describePackage(pak: VpkArchive): string {
  const exts = new Map<string, number>();
  for (const e of pak.entries) exts.set(e.ext || '(none)', (exts.get(e.ext || '(none)') ?? 0) + 1);
  const top = [...exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`);
  return `${pak.entries.length} files: ${top.join(', ')}`;
}

export async function loadMapFromVpk(dir: ByteSource, archives: Map<number, ByteSource>, progress?: ProgressFn): Promise<ParsedMap> {
  progress?.('Reading VPK directory');
  const outer = await VpkArchive.open(dir, archives);
  const warnings: string[] = [];

  const found = await findMapPackage(outer, progress, 0, []);
  if (!found) {
    throw new Error(
      `No entity lumps (*.vents_c) found in this VPK (${describePackage(outer)}). ` +
        'Expected a compiled CS2 map, or a workshop package containing maps/<name>.vpk.',
    );
  }
  const pak = found.pak;
  if (found.chain.length > 0) warnings.push(`Compiled map read from nested package ${found.chain.join(' → ')}`);

  const mapResources = pak.entries.filter((e) => e.ext === 'vmap_c' && e.dir.toLowerCase().startsWith('maps'));
  const lumpEntries = pak.entries.filter((e) => e.ext === 'vents_c');

  // Pick the map whose folder owns the most lumps (a workshop vpk normally has exactly one).
  let mapName = '';
  let mapDir = '';
  if (mapResources.length > 0) {
    let best = -1;
    for (const m of mapResources) {
      const folder = `${m.dir}/${m.name}/`.toLowerCase();
      const count = lumpEntries.filter((l) => l.path.toLowerCase().startsWith(folder)).length;
      if (count > best) {
        best = count;
        mapName = m.name;
        mapDir = folder;
      }
    }
    if (mapResources.length > 1) {
      warnings.push(`VPK contains ${mapResources.length} maps, using "${mapName}"`);
    }
  } else {
    const first = lumpEntries[0];
    const m = /^maps\/(.+?)\/entities\//i.exec(first.path);
    mapName = m ? m[1].split('/').pop()! : dir.name.replace(/\.vpk$/i, '');
    mapDir = m ? `maps/${m[1]}/`.toLowerCase() : '';
  }
  // workshop packages are named by their numeric id; the nested map vpk carries the real name
  if (/^\d+$/.test(mapName) && found.chain.length > 0) {
    const inner = found.chain[found.chain.length - 1].replace(/\\/g, '/').split('/').pop()!.replace(/\.vpk$/i, '');
    if (inner) mapName = inner;
  }

  const relevantLumps = lumpEntries.filter((l) => !mapDir || l.path.toLowerCase().startsWith(mapDir));
  const lumps: { path: string; lump: ParsedEntityLump }[] = [];
  let i = 0;
  for (const entry of relevantLumps) {
    progress?.(`Parsing ${entry.path}`, i++, relevantLumps.length);
    try {
      const bytes = await pak.readEntry(entry);
      lumps.push({ path: entry.path, lump: parseEntityLump(bytes) });
    } catch (err) {
      warnings.push(`Failed to parse ${entry.path}: ${(err as Error).message}`);
    }
  }

  // Which lumps are point_template children?
  const templateOwners = new Map<string, string>();
  for (const { lump } of lumps) {
    for (const e of lump.entities) {
      if (e.props.get('classname') === 'point_template') {
        const lumpName = e.props.get('entitylumpname');
        if (lumpName) templateOwners.set(lumpName.toLowerCase(), e.props.get('targetname') ?? '');
      }
    }
  }

  const entities: MapEntity[] = [];
  let id = 0;
  for (const { path, lump } of lumps) {
    const templated = templateOwners.has(lump.name.toLowerCase()) || lump.hammerUniqueId.length > 0;
    for (const raw of lump.entities) {
      const props: Record<string, string> = {};
      for (const [k, v] of raw.props) props[k] = v;
      const hammerId = props.hammeruniqueid ?? '';
      entities.push({
        id: id++,
        hammerId,
        classname: (props.classname ?? '').toLowerCase(),
        targetname: props.targetname ?? '',
        props,
        connections: raw.connections,
        source: { kind: 'vpk', file: path, container: lump.name, scope: '', templated },
      });
    }
  }

  return finish({ mapName, sourceKind: 'vpk', sourceFiles: [dir.name, ...[...archives.values()].map((a) => a.name)], entities, warnings });
}

/** Groups dropped .vpk files into a directory source plus numbered archives. */
export function groupVpkSources(files: { name: string; source: ByteSource }[]): { dir: ByteSource; archives: Map<number, ByteSource> } {
  const vpks = files.filter((f) => f.name.toLowerCase().endsWith('.vpk'));
  if (vpks.length === 0) throw new Error('No .vpk file provided');
  const dirCandidate = vpks.find((f) => classifyVpkFileName(f.name).kind === 'dir') ?? vpks.find((f) => classifyVpkFileName(f.name).kind === 'single');
  if (!dirCandidate) {
    throw new Error('Only numbered archive parts were provided; the "_dir.vpk" file is required');
  }
  const base = classifyVpkFileName(dirCandidate.name).base;
  const archives = new Map<number, ByteSource>();
  for (const f of vpks) {
    const c = classifyVpkFileName(f.name);
    if (c.kind === 'archive' && c.base === base) archives.set(c.index, f.source);
  }
  return { dir: dirCandidate.source, archives };
}

// ---------------------------------------------------------------------------------------------
// Hammer maps (.vmap)
// ---------------------------------------------------------------------------------------------

export function loadMapFromVmaps(files: { name: string; bytes: Uint8Array }[], mainName?: string, progress?: ProgressFn): ParsedMap {
  const parsed: VmapFile[] = [];
  let i = 0;
  for (const f of files) {
    progress?.(`Parsing ${f.name}`, i++, files.length);
    parsed.push(parseVmapFile(f.name, f.bytes));
  }
  if (parsed.length === 0) throw new Error('No .vmap file provided');

  // Main map: explicitly chosen, otherwise the one nobody references as a prefab, otherwise the largest.
  let main: VmapFile | undefined = mainName ? parsed.find((p) => p.name === mainName) : undefined;
  if (!main) {
    const referenced = new Set<string>();
    for (const p of parsed) {
      for (const el of p.doc.elements) {
        if (el.type === 'CMapPrefab') {
          const t = el.attrs.get('targetMapPath');
          if (typeof t === 'string') referenced.add(t.replace(/\\/g, '/').split('/').pop()!.toLowerCase());
        }
      }
    }
    const roots = parsed.filter((p) => !referenced.has(p.name.replace(/\\/g, '/').split('/').pop()!.toLowerCase()));
    const pool = roots.length > 0 ? roots : parsed;
    main = pool.reduce((a, b) => (b.doc.elements.length > a.doc.elements.length ? b : a));
  }

  const others = parsed.filter((p) => p !== main);
  const result = extractVmapEntities(main, others);
  const mapName = main.name.replace(/\\/g, '/').split('/').pop()!.replace(/\.vmap$/i, '');
  return finish({
    mapName,
    sourceKind: 'vmap',
    sourceFiles: parsed.map((p) => p.name),
    entities: result.entities,
    warnings: result.warnings,
  });
}
