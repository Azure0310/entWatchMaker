/**
 * Builds StripperCS2 actions from loaded entities and edits them: how to pick an entity out
 * (match strategies), how to delete / clone it, and how key value and output edits turn into
 * the replace / delete / insert sections of a "modify".
 */

import type { EntityConnection, MapEntity } from './entity';
import { friendlyName } from './entity';
import {
  cloneAction,
  exactValue,
  ioIsEmpty,
  newAdd,
  newFilter,
  newModify,
  targetForEntity,
  type AddAction,
  type FilterAction,
  type IoSpec,
  type KV,
  type ModifyAction,
  type StripperAction,
  type StripperConfig,
} from './stripper';
import { connectionMatches } from './stripperMatch';

/**
 * How an action picks its entity:
 *  - id: classname + hammeruniqueid, the most exact one and what to use by default
 *  - name: classname + targetname, survives a map update that renumbers entities
 *  - origin: classname + origin, for unnamed entities without a usable id
 *  - class: every entity of the class
 */
export type MatchStrategy = 'id' | 'name' | 'origin' | 'class';

function classnameOf(e: MapEntity): string {
  return e.props.classname ?? e.classname;
}

export function availableStrategies(e: MapEntity): MatchStrategy[] {
  const out: MatchStrategy[] = [];
  if (e.hammerId) out.push('id');
  if (e.targetname) out.push('name');
  if (e.props.origin) out.push('origin');
  out.push('class');
  return out;
}

/** The strategy a new action should start with: the exact id when there is one. */
export function defaultStrategy(e: MapEntity): MatchStrategy {
  return availableStrategies(e)[0];
}

export function buildMatch(e: MapEntity, strategy: MatchStrategy): KV[] {
  const cls: KV = { key: 'classname', value: exactValue(classnameOf(e)) };
  switch (strategy) {
    case 'id':
      return e.hammerId ? [cls, { key: 'hammeruniqueid', value: exactValue(e.hammerId) }] : buildMatch(e, e.targetname ? 'name' : 'origin');
    case 'name':
      return e.targetname ? [cls, { key: 'targetname', value: exactValue(e.targetname) }] : buildMatch(e, 'origin');
    case 'origin':
      return e.props.origin ? [cls, { key: 'origin', value: exactValue(e.props.origin) }] : [cls];
    default:
      return [cls];
  }
}

export function describeEntity(e: MapEntity): string {
  const name = friendlyName(e.targetname);
  return `${e.classname}${name ? ' ' + name : ''}${e.hammerId ? ' #' + e.hammerId : ''}`;
}

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

function fullIo(c: EntityConnection): IoSpec {
  return {
    outputname: exactValue(c.output),
    targetname: exactValue(c.target),
    inputname: exactValue(c.input),
    overrideparam: exactValue(c.param),
    delay: c.delay,
    timestofire: c.timesToFire,
  };
}

/**
 * Describes one output of an entity with as few fields as it takes to select just that output
 * (and its exact duplicates). Output, target and input always go in; parameter, delay and times
 * to fire are added only while another output of the entity would also be selected.
 */
export function ioSpecFor(e: MapEntity, c: EntityConnection): IoSpec {
  const full = fullIo(c);
  const spec: IoSpec = { outputname: full.outputname, targetname: full.targetname, inputname: full.inputname };
  const others = e.connections.filter((o) => o !== c);
  const ambiguous = (): boolean => others.some((o) => connectionMatches(o, spec) && !sameConnection(o, c));
  for (const extra of ['overrideparam', 'delay', 'timestofire'] as const) {
    if (!ambiguous()) break;
    if (extra === 'overrideparam') spec.overrideparam = full.overrideparam;
    else if (extra === 'delay') spec.delay = full.delay;
    else spec.timestofire = full.timestofire;
  }
  if (c.param !== '' && spec.overrideparam === undefined) spec.overrideparam = full.overrideparam;
  if (c.delay !== 0 && spec.delay === undefined) spec.delay = full.delay;
  return spec;
}

function sameConnection(a: EntityConnection, b: EntityConnection): boolean {
  return a.output === b.output && a.target === b.target && a.input === b.input && a.param === b.param && a.delay === b.delay && a.timesToFire === b.timesToFire;
}

/** A new output with everything spelled out, for an "add" that copies an entity. */
export function ioForAdd(c: EntityConnection): IoSpec {
  const io: IoSpec = { outputname: c.output, targetname: c.target, inputname: c.input };
  if (c.param) io.overrideparam = c.param;
  if (c.delay) io.delay = c.delay;
  if (c.timesToFire !== -1) io.timestofire = c.timesToFire;
  if (c.targetType !== 7) io.targettype = c.targetType;
  return io;
}

// ---------------------------------------------------------------------------------------------
// Actions from an entity
// ---------------------------------------------------------------------------------------------

export function filterForEntity(e: MapEntity, mapName: string, strategy: MatchStrategy = defaultStrategy(e)): FilterAction {
  return newFilter({ target: targetForEntity(e, mapName), match: buildMatch(e, strategy), note: describeEntity(e) });
}

export function modifyForEntity(e: MapEntity, mapName: string, strategy: MatchStrategy = defaultStrategy(e)): ModifyAction {
  return newModify({ target: targetForEntity(e, mapName), match: buildMatch(e, strategy), note: describeEntity(e) });
}

/** An "add" that creates a copy of the entity (without its hammer id, which would collide with the original). */
export function cloneForEntity(e: MapEntity, mapName: string): AddAction {
  const keyvalues: KV[] = [{ key: 'classname', value: classnameOf(e) }];
  for (const [key, value] of Object.entries(e.props)) {
    if (key === 'classname' || key === 'hammeruniqueid') continue;
    keyvalues.push({ key, value });
  }
  return newAdd({ target: targetForEntity(e, mapName), keyvalues, io: e.connections.map(ioForAdd), note: `copy of ${describeEntity(e)}` });
}

function kvEqual(a: KV[], b: KV[]): boolean {
  return a.length === b.length && a.every((kv, i) => kv.key === b[i].key && kv.value === b[i].value);
}

/**
 * The modify that holds an entity's own edits (key values, deleted and added outputs): same
 * target, same match as the entity's default match, no output selection of its own.
 */
export function findEntityModify(config: StripperConfig, e: MapEntity, mapName: string): ModifyAction | undefined {
  const target = targetForEntity(e, mapName);
  const match = buildMatch(e, defaultStrategy(e));
  return config.actions.find((a): a is ModifyAction => a.kind === 'modify' && a.target === target && a.matchIo.length === 0 && !a.replaceIo && kvEqual(a.match, match));
}

export function replaceAction(config: StripperConfig, action: StripperAction): StripperConfig {
  return { actions: config.actions.map((a) => (a.uid === action.uid ? action : a)) };
}

/** Returns the config with the entity's modify present (created when missing) and that modify. */
export function ensureEntityModify(config: StripperConfig, e: MapEntity, mapName: string): { config: StripperConfig; action: ModifyAction } {
  const found = findEntityModify(config, e, mapName);
  if (found) return { config, action: found };
  const action = modifyForEntity(e, mapName);
  return { config: { actions: [...config.actions, action] }, action };
}

// ---------------------------------------------------------------------------------------------
// Key value and output edits on an entity's modify
// ---------------------------------------------------------------------------------------------

function withoutKey(kvs: KV[], key: string): KV[] {
  return kvs.filter((kv) => kv.key.toLowerCase() !== key.toLowerCase());
}

function upsert(kvs: KV[], key: string, value: string): KV[] {
  const i = kvs.findIndex((kv) => kv.key.toLowerCase() === key.toLowerCase());
  if (i < 0) return [...kvs, { key, value }];
  const out = [...kvs];
  out[i] = { key: kvs[i].key, value };
  return out;
}

/** Sets a key value: "replace" when the entity already has the key, "insert" when it does not. */
export function editKeyValue(action: ModifyAction, e: MapEntity, key: string, value: string): ModifyAction {
  const a = cloneAction(action);
  const original = e.props[key.toLowerCase()];
  a.replace = withoutKey(a.replace, key);
  a.insert = withoutKey(a.insert, key);
  a.delete = withoutKey(a.delete, key);
  if (original === undefined) a.insert = upsert(a.insert, key, value);
  else if (original !== value) a.replace = upsert(a.replace, key, value);
  return a;
}

/** Deletes a key from the entity; the delete value is the key's current value, so only that value is removed. */
export function deleteKeyValue(action: ModifyAction, e: MapEntity, key: string): ModifyAction {
  const a = cloneAction(action);
  a.replace = withoutKey(a.replace, key);
  a.insert = withoutKey(a.insert, key);
  a.delete = upsert(withoutKey(a.delete, key), key, exactValue(e.props[key.toLowerCase()] ?? ''));
  return a;
}

/** Forgets any edit of a key. */
export function revertKeyValue(action: ModifyAction, key: string): ModifyAction {
  const a = cloneAction(action);
  a.replace = withoutKey(a.replace, key);
  a.insert = withoutKey(a.insert, key);
  a.delete = withoutKey(a.delete, key);
  return a;
}

function ioKey(io: IoSpec): string {
  return JSON.stringify(io);
}

export function deleteOutput(action: ModifyAction, e: MapEntity, c: EntityConnection): ModifyAction {
  const a = cloneAction(action);
  const spec = ioSpecFor(e, c);
  if (!a.deleteIo.some((x) => ioKey(x) === ioKey(spec))) a.deleteIo = [...a.deleteIo, spec];
  return a;
}

export function revertOutputDelete(action: ModifyAction, e: MapEntity, c: EntityConnection): ModifyAction {
  const a = cloneAction(action);
  const spec = ioKey(ioSpecFor(e, c));
  a.deleteIo = a.deleteIo.filter((x) => ioKey(x) !== spec);
  return a;
}

export function isOutputDeleted(action: ModifyAction | undefined, e: MapEntity, c: EntityConnection): boolean {
  if (!action) return false;
  const spec = ioKey(ioSpecFor(e, c));
  return action.deleteIo.some((x) => ioKey(x) === spec);
}

/** A separate modify that rewrites one output; fields of `replaceIo` left unset keep the output's own value. */
export function rewriteOutput(e: MapEntity, c: EntityConnection, mapName: string): ModifyAction {
  return newModify({
    target: targetForEntity(e, mapName),
    match: buildMatch(e, defaultStrategy(e)),
    matchIo: [ioSpecFor(e, c)],
    replaceIo: {},
    note: `${describeEntity(e)}: ${c.output} → ${c.target}.${c.input}`,
  });
}

export function addOutput(action: ModifyAction, io: IoSpec = { outputname: '', targetname: '', inputname: '' }): ModifyAction {
  const a = cloneAction(action);
  a.insertIo = [...a.insertIo, io];
  return a;
}

/** True when the modify holds no edits at all, so it can be dropped. */
export function isEmptyModify(a: ModifyAction): boolean {
  return a.replace.length === 0 && a.delete.length === 0 && a.insert.length === 0 && a.deleteIo.length === 0 && a.insertIo.length === 0 && (!a.replaceIo || ioIsEmpty(a.replaceIo));
}
