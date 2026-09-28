import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { classifyVpkFileName } from '../src/formats/vpk';
import { loadMapFromVmaps, loadMapFromVpk } from '../src/model/loadMap';
import type { ParsedMap } from '../src/model/entity';
import { fileByteSource } from './nodeByteSource';

/**
 * Loads a map from a path: a .vpk (workshop package or compiled map, split archives picked up
 * from the same folder), a .vmap (prefabs next to it are included), or a folder containing one
 * of those (e.g. steamapps/workshop/content/730/<id>).
 */
export async function loadLocalMap(target: string, log: (s: string) => void = () => {}): Promise<ParsedMap> {
  let file = target;
  if (statSync(target).isDirectory()) {
    const entries = readdirSync(target);
    const vpks = entries.filter((f) => f.toLowerCase().endsWith('.vpk') && classifyVpkFileName(f).kind !== 'archive');
    const vmaps = entries.filter((f) => f.toLowerCase().endsWith('.vmap'));
    const pick = vpks[0] ?? vmaps[0];
    if (!pick) throw new Error(`No .vpk or .vmap found in ${target}`);
    file = path.join(target, pick);
  }
  const lower = file.toLowerCase();
  if (lower.endsWith('.vpk')) {
    const dir = await fileByteSource(file);
    const archives = new Map<number, Awaited<ReturnType<typeof fileByteSource>>>();
    const c = classifyVpkFileName(path.basename(file));
    if (c.kind === 'dir') {
      for (const f of readdirSync(path.dirname(file))) {
        const cf = classifyVpkFileName(f);
        if (cf.kind === 'archive' && cf.base === c.base) archives.set(cf.index, await fileByteSource(path.join(path.dirname(file), f)));
      }
    }
    return loadMapFromVpk(dir, archives, (m) => log(m));
  }
  if (lower.endsWith('.vmap')) {
    const folder = path.dirname(file);
    const files = [{ name: path.basename(file), bytes: new Uint8Array(readFileSync(file)) }];
    const prefabDir = path.join(folder, 'prefabs');
    try {
      for (const f of readdirSync(prefabDir)) if (f.toLowerCase().endsWith('.vmap')) files.push({ name: f, bytes: new Uint8Array(readFileSync(path.join(prefabDir, f))) });
    } catch {
      // no prefabs folder
    }
    return loadMapFromVmaps(files, path.basename(file), (m) => log(m));
  }
  throw new Error(`Unsupported file: ${file}`);
}
