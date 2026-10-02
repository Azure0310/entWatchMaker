/** Editing actions for the StripperCS2 side of the tool. */
import type { EntityConnection, MapEntity } from '../model/entity';
import {
  cloneAction,
  newAdd,
  newFilter,
  newModify,
  parseStripperFile,
  targetForEntity,
  type IoSpec,
  type KV,
  type StripperAction,
} from '../model/stripper';
import {
  addOutput,
  cloneForEntity,
  deleteKeyValue,
  deleteOutput,
  describeEntity,
  editKeyValue,
  ensureEntityModify,
  filterForEntity,
  isEmptyModify,
  replaceAction,
  revertKeyValue,
  revertOutputDelete,
  rewriteOutput,
  buildMatch,
  type MatchStrategy,
} from '../model/stripperBuild';
import { showToast } from './actions';
import { MODE_KEY, store, type AppMode } from './store';
import { refreshStripperSim, setStripper } from './stripperState';

export function setMode(mode: AppMode): void {
  store.set((s) => ({ mode, weaponsOnly: mode === 'stripper' ? false : (s.map?.stats.weapons ?? 0) > 0 }));
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
  refreshStripperSim();
}

export function selectAction(uid: string | null): void {
  store.set({ selectedActionUid: uid });
}

export function setStripperFile(target: string | null): void {
  store.set({ stripperFile: target });
}

function mapName(): string {
  return store.get().map?.mapName ?? 'map';
}

function append(action: StripperAction, select = true): void {
  setStripper((c) => ({ actions: [...c.actions, action] }));
  if (select) store.set({ selectedActionUid: action.uid, stripperFile: action.target });
}

// ---------------------------------------------------------------------------------------------
// Blank actions and list editing
// ---------------------------------------------------------------------------------------------

/** The lump the user is most likely working in: the selected entity's, else the main one. */
function currentTarget(): string {
  const { graph, selectedEntityId, map } = store.get();
  const e = graph && selectedEntityId !== null ? graph.byId.get(selectedEntityId) : null;
  return e && map ? targetForEntity(e, map.mapName) : 'default_ents';
}

export function addBlankAction(kind: StripperAction['kind']): void {
  const target = currentTarget();
  if (kind === 'filter') append(newFilter({ target, match: [{ key: 'classname', value: '' }] }));
  else if (kind === 'add') append(newAdd({ target }));
  else append(newModify({ target, match: [{ key: 'classname', value: '' }], replace: [{ key: '', value: '' }] }));
}

export function updateAction(uid: string, fn: (a: StripperAction) => StripperAction): void {
  setStripper((c) => ({ actions: c.actions.map((a) => (a.uid === uid ? fn(a) : a)) }));
}

export function removeAction(uid: string): void {
  setStripper((c) => ({ actions: c.actions.filter((a) => a.uid !== uid) }));
}

export function duplicateAction(uid: string): void {
  const src = store.get().stripper.actions.find((a) => a.uid === uid);
  if (!src) return;
  const copy = cloneAction(src, true);
  setStripper((c) => {
    const i = c.actions.findIndex((a) => a.uid === uid);
    const actions = [...c.actions];
    actions.splice(i + 1, 0, copy);
    return { actions };
  });
  store.set({ selectedActionUid: copy.uid });
}

export function moveAction(uid: string, dir: -1 | 1): void {
  setStripper((c) => {
    const i = c.actions.findIndex((a) => a.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.actions.length) return c;
    const actions = [...c.actions];
    [actions[i], actions[j]] = [actions[j], actions[i]];
    return { actions };
  });
}

export function clearStripper(): void {
  setStripper(() => ({ actions: [] }));
  store.set({ selectedActionUid: null, stripperFile: null });
}

/** Rewrites a match from an entity, keeping the rest of the action. */
export function applyMatchStrategy(uid: string, entity: MapEntity, strategy: MatchStrategy): void {
  const match: KV[] = buildMatch(entity, strategy);
  updateAction(uid, (a) => (a.kind === 'add' ? a : { ...a, match }));
}

// ---------------------------------------------------------------------------------------------
// From entities
// ---------------------------------------------------------------------------------------------

export function removeEntity(e: MapEntity, strategy?: MatchStrategy): void {
  append(filterForEntity(e, mapName(), strategy));
  showToast(`filter: ${describeEntity(e)}`);
}

/** Removes every entity of the class, matched by classname alone. */
export function removeClass(e: MapEntity): void {
  append(filterForEntity(e, mapName(), 'class'));
  showToast(`filter: ${e.classname} (*)`);
}

export function cloneEntity(e: MapEntity): void {
  append(cloneForEntity(e, mapName()));
}

function mutateEntityModify(e: MapEntity, fn: (a: ReturnType<typeof ensureEntityModify>['action']) => ReturnType<typeof ensureEntityModify>['action']): void {
  const name = mapName();
  setStripper((c) => {
    const ensured = ensureEntityModify(c, e, name);
    const next = fn(ensured.action);
    // an entity modify with nothing left in it is dropped again
    if (isEmptyModify(next)) return { actions: ensured.config.actions.filter((a) => a.uid !== next.uid) };
    return replaceAction(ensured.config, next);
  });
}

export function editEntityKey(e: MapEntity, key: string, value: string): void {
  mutateEntityModify(e, (a) => editKeyValue(a, e, key, value));
}

export function deleteEntityKey(e: MapEntity, key: string): void {
  mutateEntityModify(e, (a) => deleteKeyValue(a, e, key));
}

export function revertEntityKey(e: MapEntity, key: string): void {
  mutateEntityModify(e, (a) => revertKeyValue(a, key));
}

export function deleteEntityOutput(e: MapEntity, c: EntityConnection): void {
  mutateEntityModify(e, (a) => deleteOutput(a, e, c));
}

export function revertEntityOutputDelete(e: MapEntity, c: EntityConnection): void {
  mutateEntityModify(e, (a) => revertOutputDelete(a, e, c));
}

/** Starts a rewrite of one output and opens it in the editor. */
export function startOutputRewrite(e: MapEntity, c: EntityConnection): void {
  append(rewriteOutput(e, c, mapName()));
}

/** Adds an empty output to the entity's own modify and opens it in the editor. */
export function startOutputInsert(e: MapEntity): void {
  const name = mapName();
  let uid = '';
  setStripper((c) => {
    const ensured = ensureEntityModify(c, e, name);
    uid = ensured.action.uid;
    return replaceAction(ensured.config, addOutput(ensured.action));
  });
  store.set({ selectedActionUid: uid });
}

// ---------------------------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------------------------

export function importStripperText(text: string, target: string, mode: 'replace' | 'append'): { count: number; warnings: string[] } {
  const { actions, warnings } = parseStripperFile(text, target);
  setStripper((c) => ({
    actions: mode === 'replace' ? [...c.actions.filter((a) => a.target !== target), ...actions] : [...c.actions, ...actions],
  }));
  store.set({ selectedActionUid: actions[0]?.uid ?? store.get().selectedActionUid, stripperFile: actions.length > 0 ? target : store.get().stripperFile });
  return { count: actions.length, warnings };
}

/** One line saying what an action selects and, for a modify, what it does to it. */
export function describeAction(a: StripperAction): string {
  const kvText = (kvs: KV[], prefix = ''): string[] => kvs.filter((k) => k.key).map((k) => `${prefix}${k.key}=${k.value}`);
  const ioText = (io: IoSpec): string => [io.outputname, io.targetname && `→ ${io.targetname}`, io.inputname && `.${io.inputname}`].filter(Boolean).join(' ');
  const ioList = (list: IoSpec[], prefix: string): string[] => list.map((io) => `${prefix}io ${ioText(io)}`.trim());
  if (a.kind === 'add') return [...kvText(a.keyvalues), ...ioList(a.io, '')].join(' ');
  if (a.kind === 'filter') return [...kvText(a.match), ...ioList(a.io, '')].join(' ');
  const match = [...kvText(a.match), ...ioList(a.matchIo, '')].join(' ');
  const ops = [
    ...kvText(a.replace),
    ...(a.replaceIo ? [`io ${Object.entries(a.replaceIo).map(([k, v]) => `${k}=${v}`).join(',') || '…'}`] : []),
    ...a.delete.filter((k) => k.key).map((k) => `-${k.key}`),
    ...ioList(a.deleteIo, '-'),
    ...kvText(a.insert, '+'),
    ...ioList(a.insertIo, '+'),
  ];
  return ops.length > 0 ? `${match} ⇒ ${ops.join(', ')}` : match;
}
