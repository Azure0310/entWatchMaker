import { GLOBAL_LUMP, ioIsEmpty, type IoSpec, type KV, type StripperAction, type StripperConfig } from './stripper';
import type { StripperSimulation } from './stripperMatch';

export interface StripperIssue {
  level: 'error' | 'warning' | 'info';
  actionUid: string;
  /** i18n key */
  key: string;
  detail?: string;
}

const FLOAT_KEYS = new Set(['origin', 'angles', 'scales']);

function matchHasKey(kvs: KV[], key: string): boolean {
  return kvs.some((kv) => kv.key.toLowerCase() === key);
}

function hasKeys(kvs: KV[]): boolean {
  return kvs.some((kv) => kv.key !== '');
}

/**
 * Problems in a config. `sim` is the result of running it over the loaded map (null when no map is
 * loaded, e.g. right after importing a file), which is what lets "matches nothing" be reported.
 */
export function validateStripper(config: StripperConfig, sim: StripperSimulation | null): StripperIssue[] {
  const issues: StripperIssue[] = [];
  const push = (a: StripperAction, level: StripperIssue['level'], key: string, detail?: string): void => {
    issues.push({ level, actionUid: a.uid, key, detail });
  };

  for (const a of config.actions) {
    const result = sim?.perAction.get(a.uid);
    for (const err of result?.errors ?? []) push(a, 'error', 'sv.badRegex', err);

    if (a.kind === 'add') {
      const cls = a.keyvalues.find((kv) => kv.key.toLowerCase() === 'classname')?.value.trim() ?? '';
      if (!cls) push(a, 'error', 'sv.addNoClassname');
      if (a.target === GLOBAL_LUMP) push(a, 'warning', 'sv.addInGlobalLump');
      continue;
    }

    const matchNothing = a.match.every((kv) => kv.key === '') && (a.kind === 'filter' ? a.io : a.matchIo).length === 0;
    if (matchNothing) push(a, a.kind === 'filter' ? 'error' : 'warning', a.kind === 'filter' ? 'sv.filterAll' : 'sv.matchAll');

    for (const kv of a.match) {
      if (FLOAT_KEYS.has(kv.key.toLowerCase()) && !kv.value.startsWith('/')) push(a, 'info', 'sv.floatKey', kv.key);
    }

    if (a.kind === 'modify') {
      const ioEmptyDelete = a.deleteIo.some((io: IoSpec) => ioIsEmpty(io));
      if (ioEmptyDelete) push(a, 'warning', 'sv.deleteAllIo');
      const hasReplaceIo = !!a.replaceIo && !ioIsEmpty(a.replaceIo);
      if (hasReplaceIo && a.matchIo.length === 0) push(a, 'warning', 'sv.replaceIoNoMatch');
      const doesSomething = hasKeys(a.replace) || hasKeys(a.delete) || hasKeys(a.insert) || hasReplaceIo || a.deleteIo.length > 0 || a.insertIo.length > 0;
      if (!doesSomething) push(a, 'warning', 'sv.modifyNoop');
    }

    if (!sim || !result) continue;
    if (!result.lumpKnown) push(a, 'warning', 'sv.lumpUnknown', a.target);
    else if (result.matched === 0 && !matchNothing) push(a, 'warning', 'sv.matchesNothing');
    else if (result.matched > 1 && matchHasKey(a.match, 'hammeruniqueid')) push(a, 'warning', 'sv.idMatchedMany', String(result.matched));
    else if (result.matched > 1 && a.kind === 'filter') push(a, 'info', 'sv.filterMany', String(result.matched));
  }
  return issues;
}
