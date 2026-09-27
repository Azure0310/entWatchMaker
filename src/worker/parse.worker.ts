/// <reference lib="webworker" />
import { blobByteSource } from '../formats/vpk';
import { groupVpkSources, loadMapFromVmaps, loadMapFromVpk } from '../model/loadMap';
import type { ParsedMap } from '../model/entity';

export interface ParseRequest {
  type: 'parse';
  files: File[];
  mainVmap?: string;
}

export type ParseResponse =
  | { type: 'progress'; message: string; done?: number; total?: number }
  | { type: 'done'; map: ParsedMap }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: ParseResponse): void {
  ctx.postMessage(msg);
}

async function handle(req: ParseRequest): Promise<ParsedMap> {
  const vpks = req.files.filter((f) => f.name.toLowerCase().endsWith('.vpk'));
  const vmaps = req.files.filter((f) => f.name.toLowerCase().endsWith('.vmap'));
  if (vpks.length === 0 && vmaps.length === 0) {
    throw new Error('Drop a CS2 workshop .vpk or a Hammer .vmap file');
  }
  if (vpks.length > 0 && vmaps.length > 0) {
    throw new Error('Drop either .vpk files or .vmap files, not both at once');
  }
  const progress = (message: string, done?: number, total?: number) => post({ type: 'progress', message, done, total });
  if (vpks.length > 0) {
    const { dir, archives } = groupVpkSources(vpks.map((f) => ({ name: f.name, source: blobByteSource(f, f.name) })));
    return loadMapFromVpk(dir, archives, progress);
  }
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const f of vmaps) {
    progress(`Reading ${f.name}`);
    files.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return loadMapFromVmaps(files, req.mainVmap, progress);
}

ctx.onmessage = (ev: MessageEvent<ParseRequest>) => {
  if (ev.data.type !== 'parse') return;
  handle(ev.data)
    .then((map) => post({ type: 'done', map }))
    .catch((err: unknown) => post({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
};
