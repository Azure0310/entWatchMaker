import {
  dmxElementArray,
  dmxNumber,
  dmxString,
  dmxValueToString,
  isDmxElement,
  parseDmx,
  type DmxDocument,
  type DmxElement,
} from './dmx';
import type { EntityConnection, MapEntity } from '../model/entity';

/**
 * Extracts entities (with connections and Hammer ids) from Hammer .vmap files.
 *
 * Hammer ids: a top level entity's compiled `hammerUniqueId` is its nodeID; entities inside a
 * prefab get the prefab node's id prefixed ("<prefab nodeID>:<entity nodeID>"), nesting adds
 * more segments. Prefab contents live in separate .vmap files, so callers may pass those too.
 */

export interface VmapFile {
  /** File name (or path) as given by the user. */
  name: string;
  doc: DmxDocument;
}

export interface VmapExtractResult {
  entities: MapEntity[];
  warnings: string[];
  /** Prefab paths that were referenced but not provided. */
  missingPrefabs: string[];
}

function baseName(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return (idx >= 0 ? norm.slice(idx + 1) : norm).toLowerCase();
}

function vec3(v: unknown): string {
  return v instanceof Float32Array ? dmxValueToString(v) : '';
}

export function parseVmapFile(name: string, bytes: Uint8Array): VmapFile {
  return { name, doc: parseDmx(bytes) };
}

export function extractVmapEntities(main: VmapFile, others: VmapFile[] = []): VmapExtractResult {
  const entities: MapEntity[] = [];
  const warnings: string[] = [];
  const missing = new Set<string>();
  const byBase = new Map<string, VmapFile>();
  for (const f of [main, ...others]) byBase.set(baseName(f.name), f);

  let nextId = 0;
  let skippedEditorOnly = 0;

  const visit = (node: DmxElement, lineage: number[], scope: string, container: string, stack: string[]): void => {
    const nodeId = dmxNumber(node.attrs.get('nodeID'), 0);
    const editorOnly = node.attrs.get('editorOnly') === true;
    const props = node.attrs.get('entity_properties');

    if (isDmxElement(props) && !editorOnly) {
      const kv: Record<string, string> = {};
      for (const [k, v] of props.attrs) kv[k.toLowerCase()] = dmxValueToString(v);
      if (!kv.origin) kv.origin = vec3(node.attrs.get('origin'));
      if (!kv.angles) kv.angles = vec3(node.attrs.get('angles'));
      if (!kv.scales) kv.scales = vec3(node.attrs.get('scales'));
      const hammerId = [...lineage, nodeId].join(':');
      kv.hammeruniqueid = hammerId;
      const connections: EntityConnection[] = [];
      for (const c of dmxElementArray(node.attrs.get('connectionsData'))) {
        connections.push({
          output: dmxString(c.attrs.get('outputName')),
          targetType: dmxNumber(c.attrs.get('targetType'), 7),
          target: dmxString(c.attrs.get('targetName')),
          input: dmxString(c.attrs.get('inputName')),
          param: dmxString(c.attrs.get('overrideParam')),
          delay: dmxNumber(c.attrs.get('delay'), 0),
          timesToFire: dmxNumber(c.attrs.get('timesToFire'), -1),
        });
      }
      if (kv.classname) {
        entities.push({
          id: nextId++,
          hammerId,
          classname: kv.classname.toLowerCase(),
          targetname: kv.targetname ?? '',
          props: kv,
          connections,
          source: { kind: 'vmap', file: main.name, container, scope, templated: false, lineage: [...lineage, nodeId] },
        });
      }
    } else if (isDmxElement(props) && editorOnly) {
      skippedEditorOnly++;
    }

    if (node.type === 'CMapPrefab') {
      const targetMapPath = dmxString(node.attrs.get('targetMapPath'));
      const fixup = node.attrs.get('fixupEntityNames') !== false;
      const file = byBase.get(baseName(targetMapPath));
      if (!file) {
        if (targetMapPath) missing.add(targetMapPath);
      } else if (stack.includes(file.name)) {
        warnings.push(`Prefab recursion detected at ${targetMapPath}`);
      } else {
        const world = file.doc.root?.attrs.get('world');
        if (isDmxElement(world)) {
          visit(world, [...lineage, nodeId], fixup ? `${scope}/${nodeId}` : scope, targetMapPath, [...stack, file.name]);
        }
      }
      return;
    }

    if (node.type === 'CMapInstance') {
      const target = node.attrs.get('target');
      if (isDmxElement(target)) {
        for (const child of dmxElementArray(target.attrs.get('children'))) {
          visit(child, [...lineage, nodeId], `${scope}/${nodeId}`, `${container} (instance ${nodeId})`, stack);
        }
      }
      return;
    }

    for (const child of dmxElementArray(node.attrs.get('children'))) {
      visit(child, lineage, scope, container, stack);
    }
  };

  const world = main.doc.root?.attrs.get('world');
  if (!isDmxElement(world)) {
    throw new Error('vmap has no world element (is this really a map file?)');
  }
  // The world itself is the worldspawn entity but we skip it: it's never an item.
  const worldKv = world.attrs.get('entity_properties');
  if (isDmxElement(worldKv)) {
    // still traverse world's children
  }
  for (const child of dmxElementArray(world.attrs.get('children'))) visit(child, [], '', main.name, [main.name]);

  if (skippedEditorOnly > 0) warnings.push(`${skippedEditorOnly} editor-only entities were skipped (they are not compiled into the map)`);
  const missingPrefabs = [...missing];
  if (missingPrefabs.length > 0) {
    warnings.push(`Prefab files not provided (drop them together with the map to include their entities): ${missingPrefabs.join(', ')}`);
  }
  return { entities, warnings, missingPrefabs };
}
