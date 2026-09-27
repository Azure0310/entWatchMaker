import type { ParsedMap } from '../model/entity';
import { parseMapFilesDirect } from '../model/parseFiles';
import type { ParseRequest, ParseResponse } from './parse.worker';
// The worker is inlined (blob URL, classic script) so the built page works from any path,
// including a plain file:// open of the single-file build.
import ParseWorker from './parse.worker.ts?worker&inline';

type ProgressFn = (message: string, done?: number, total?: number) => void;

/** Thrown when the worker itself could not run (blocked blob URLs, CSP, crash before start). */
class WorkerUnavailableError extends Error {}

function parseInWorker(files: File[], onProgress: ProgressFn, mainVmap?: string): Promise<ParsedMap> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new ParseWorker();
    } catch (err) {
      reject(new WorkerUnavailableError(err instanceof Error ? err.message : String(err)));
      return;
    }
    let started = false;
    const finish = (fn: () => void) => {
      fn();
      worker.terminate();
    };
    worker.onmessage = (ev: MessageEvent<ParseResponse>) => {
      const msg = ev.data;
      if (msg.type === 'ready') started = true;
      else if (msg.type === 'progress') onProgress(msg.message, msg.done, msg.total);
      else if (msg.type === 'done') finish(() => resolve(msg.map));
      else finish(() => reject(started ? new Error(msg.message) : new WorkerUnavailableError(msg.message)));
    };
    worker.onerror = (ev) => {
      const detail = [ev.message, ev.filename ? `${ev.filename}:${ev.lineno}` : ''].filter(Boolean).join(' @ ');
      finish(() => reject(new WorkerUnavailableError(detail || 'worker failed to start')));
    };
    const req: ParseRequest = { type: 'parse', files, mainVmap };
    worker.postMessage(req);
  });
}

/**
 * Parses the files in a Web Worker; if the worker cannot run in this environment the parsing
 * happens on the main thread instead (slower UI updates, same result).
 */
export async function parseMapFiles(files: File[], onProgress: ProgressFn, mainVmap?: string): Promise<ParsedMap> {
  try {
    return await parseInWorker(files, onProgress, mainVmap);
  } catch (err) {
    if (!(err instanceof WorkerUnavailableError)) throw err;
    onProgress('Worker unavailable, parsing on the main thread…');
    const map = await parseMapFilesDirect(files, onProgress, mainVmap);
    map.warnings.unshift(`Parsed on the main thread because the background worker could not run (${err.message}).`);
    return map;
  }
}
