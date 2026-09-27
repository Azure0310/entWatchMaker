import type { ParsedMap } from '../model/entity';
import type { ParseRequest, ParseResponse } from './parse.worker';

export function parseMapFiles(
  files: File[],
  onProgress: (message: string, done?: number, total?: number) => void,
  mainVmap?: string,
): Promise<ParsedMap> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<ParseResponse>) => {
      const msg = ev.data;
      if (msg.type === 'progress') onProgress(msg.message, msg.done, msg.total);
      else if (msg.type === 'done') {
        resolve(msg.map);
        worker.terminate();
      } else {
        reject(new Error(msg.message));
        worker.terminate();
      }
    };
    worker.onerror = (ev) => {
      reject(new Error(ev.message || 'Worker failed'));
      worker.terminate();
    };
    const req: ParseRequest = { type: 'parse', files, mainVmap };
    worker.postMessage(req);
  });
}
