import type { ParsedMap } from '../model/entity';
import type { ParseRequest, ParseResponse } from './parse.worker';
// The worker is inlined as a Blob URL so the built page also works when opened from a local
// file (file://), where a separate worker script could not be fetched.
import ParseWorker from './parse.worker.ts?worker&inline';

export function parseMapFiles(
  files: File[],
  onProgress: (message: string, done?: number, total?: number) => void,
  mainVmap?: string,
): Promise<ParsedMap> {
  return new Promise((resolve, reject) => {
    const worker: Worker = new ParseWorker();
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
