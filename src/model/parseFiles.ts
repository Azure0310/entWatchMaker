import { blobByteSource } from '../formats/vpk';
import { groupVpkSources, loadMapFromVmaps, loadMapFromVpk, type ProgressFn } from './loadMap';
import type { ParsedMap } from './entity';

/**
 * Parses dropped files into a ParsedMap. Runs inside the Web Worker normally, and on the main
 * thread as a fallback when the worker cannot start.
 */
export async function parseMapFilesDirect(files: File[], progress?: ProgressFn, mainVmap?: string): Promise<ParsedMap> {
  const vpks = files.filter((f) => f.name.toLowerCase().endsWith('.vpk'));
  const vmaps = files.filter((f) => f.name.toLowerCase().endsWith('.vmap'));
  if (vpks.length === 0 && vmaps.length === 0) {
    throw new Error('Drop a CS2 workshop .vpk or a Hammer .vmap file');
  }
  if (vpks.length > 0 && vmaps.length > 0) {
    throw new Error('Drop either .vpk files or .vmap files, not both at once');
  }
  if (vpks.length > 0) {
    const { dir, archives } = groupVpkSources(vpks.map((f) => ({ name: f.name, source: blobByteSource(f, f.name) })));
    return loadMapFromVpk(dir, archives, progress);
  }
  const buffers: { name: string; bytes: Uint8Array }[] = [];
  for (const f of vmaps) {
    progress?.(`Reading ${f.name}`);
    buffers.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return loadMapFromVmaps(buffers, mainVmap, progress);
}
