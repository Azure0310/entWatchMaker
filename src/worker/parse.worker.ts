/// <reference lib="webworker" />
import { parseMapFilesDirect } from '../model/parseFiles';
import type { ParsedMap } from '../model/entity';

export interface ParseRequest {
  type: 'parse';
  files: File[];
  mainVmap?: string;
}

export type ParseResponse =
  | { type: 'ready' }
  | { type: 'progress'; message: string; done?: number; total?: number }
  | { type: 'done'; map: ParsedMap }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: ParseResponse): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('error', (ev) => {
  post({ type: 'error', message: `Worker error: ${ev.message || 'unknown'} (${ev.filename || '?'}:${ev.lineno || 0})` });
});
ctx.addEventListener('unhandledrejection', (ev) => {
  const reason = (ev as PromiseRejectionEvent).reason;
  post({ type: 'error', message: `Worker error: ${reason instanceof Error ? reason.message : String(reason)}` });
});

ctx.onmessage = (ev: MessageEvent<ParseRequest>) => {
  if (ev.data.type !== 'parse') return;
  const progress = (message: string, done?: number, total?: number) => post({ type: 'progress', message, done, total });
  parseMapFilesDirect(ev.data.files, progress, ev.data.mainVmap)
    .then((map) => post({ type: 'done', map }))
    .catch((err: unknown) => post({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
};

post({ type: 'ready' });
