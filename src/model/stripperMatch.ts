/**
 * Re-implementation of StripperCS2's matching and its filter -> add -> modify pass
 * (src/actions/actions.cpp) over the entities the tool has loaded, so the UI can show how many
 * entities an action hits and what a config does before it goes on a server.
 *
 * Differences that cannot be avoided: the plugin compiles regexes with PCRE2 (caseless, not anchored)
 * and the tool uses JavaScript's engine, and key values are compared as the text this tool read
 * from the map, not as the engine's own string conversion of typed values (floats, vectors).
 */

import type { EntityConnection, MapEntity } from './entity';
import {
  GLOBAL_LUMP,
  GLOBAL_MAP,
  MAIN_LUMP,
  isRegexValue,
  targetForEntity,
  type AddAction,
  type FilterAction,
  type IoSpec,
  type KV,
  type ModifyAction,
  type StripperAction,
  type StripperConfig,
} from './stripper';

export type Matcher = { kind: 'exact'; text: string } | { kind: 'regex'; re: RegExp } | { kind: 'invalid'; error: string };

const matcherCache = new Map<string, Matcher>();

/** "/pattern/" becomes a caseless regex, anything else compares byte for byte. */
export function compileValue(value: string): Matcher {
  const cached = matcherCache.get(value);
  if (cached) return cached;
  let m: Matcher;
  if (isRegexValue(value)) {
    try {
      m = { kind: 'regex', re: new RegExp(value.slice(1, -1), 'i') };
    } catch (err) {
      m = { kind: 'invalid', error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    m = { kind: 'exact', text: value };
  }
  if (matcherCache.size > 2000) matcherCache.clear();
  matcherCache.set(value, m);
  return m;
}

function valueMatches(actual: string, matcher: Matcher): boolean {
  if (matcher.kind === 'exact') return actual === matcher.text;
  if (matcher.kind === 'regex') return matcher.re.test(actual);
  return false;
}

/** Entity state while a config is being applied. */
export interface SimEntity {
  /** Lowercased key -> value. Shared with the loaded entity until an action changes it (see `own`). */
  props: Record<string, string>;
  connections: EntityConnection[];
  /** The loaded entity this came from, absent for entities created by an "add" action. */
  origin?: MapEntity;
  /** props / connections still point at the loaded entity's own objects and must be copied before a change. */
  shared?: boolean;
}

/** Copies the entity's data away from the loaded entity before it is changed. */
function own(e: SimEntity): void {
  if (!e.shared) return;
  e.props = { ...e.props };
  e.connections = e.connections.map((c) => ({ ...c }));
  e.shared = false;
}

export function connectionMatches(c: EntityConnection, spec: IoSpec): boolean {
  const str = (field: string | undefined, actual: string): boolean => field === undefined || valueMatches(actual, compileValue(field));
  if (!str(spec.inputname, c.input)) return false;
  if (!str(spec.outputname, c.output)) return false;
  if (!str(spec.targetname, c.target)) return false;
  if (!str(spec.overrideparam, c.param)) return false;
  if (spec.delay !== undefined && Math.fround(c.delay) !== Math.fround(spec.delay)) return false;
  if (spec.timestofire !== undefined && c.timesToFire !== Math.trunc(spec.timestofire)) return false;
  return true;
}

/** DoesEntityMatch: every key must exist and match; every io spec must match at least one output. */
export function entityMatches(e: SimEntity, match: KV[], matchIo: IoSpec[], matchedIo?: Set<number>): boolean {
  for (const { key, value } of match) {
    const actual = e.props[key.toLowerCase()];
    if (actual === undefined) return false;
    if (!valueMatches(actual, compileValue(value))) return false;
  }
  for (const spec of matchIo) {
    let found = false;
    e.connections.forEach((c, i) => {
      if (connectionMatches(c, spec)) {
        matchedIo?.add(i);
        found = true;
      }
    });
    if (!found) return false;
  }
  return true;
}

export function toSimEntity(e: MapEntity): SimEntity {
  // the parsers store lowercased keys already; only a map that does not needs a converted copy
  let lower = true;
  for (const k in e.props) {
    if (k !== k.toLowerCase()) {
      lower = false;
      break;
    }
  }
  if (lower) return { props: e.props, connections: e.connections, origin: e, shared: true };
  const props: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.props)) props[k.toLowerCase()] = v;
  return { props, connections: e.connections.map((c) => ({ ...c })), origin: e };
}

function newConnection(io: IoSpec, base?: EntityConnection): EntityConnection {
  const strOr = (v: string | undefined, fallback: string): string => (v === undefined ? fallback : v);
  return {
    output: strOr(io.outputname, base?.output ?? ''),
    target: strOr(io.targetname, base?.target ?? ''),
    input: strOr(io.inputname, base?.input ?? ''),
    param: strOr(io.overrideparam, base?.param ?? ''),
    delay: io.delay ?? base?.delay ?? 0,
    timesToFire: io.timestofire !== undefined ? Math.trunc(io.timestofire) : (base?.timesToFire ?? -1),
    // Hammer's default for a hand written output
    targetType: io.targettype !== undefined ? Math.trunc(io.targettype) : (base?.targetType ?? 7),
  };
}

function setKeyValues(e: SimEntity, kvs: KV[]): void {
  for (const { key, value } of kvs) if (key !== '') e.props[key.toLowerCase()] = value;
}

function applyFilter(list: SimEntity[], a: FilterAction, hit: (e: SimEntity) => void): SimEntity[] {
  return list.filter((e) => {
    if (!entityMatches(e, a.match, a.io)) return true;
    hit(e);
    return false;
  });
}

function applyAdd(list: SimEntity[], a: AddAction): void {
  const e: SimEntity = { props: {}, connections: a.io.map((io) => newConnection(io)) };
  setKeyValues(e, a.keyvalues);
  list.push(e);
}

function applyModify(list: SimEntity[], a: ModifyAction, hit: (e: SimEntity) => void): void {
  for (const e of list) {
    const matchedIo = new Set<number>();
    if (!entityMatches(e, a.match, a.matchIo, matchedIo)) continue;
    hit(e);
    own(e);

    setKeyValues(e, a.replace);
    if (a.replaceIo) {
      const replaceIo = a.replaceIo;
      // the plugin removes each matched output and appends the rewritten one at the end
      const kept: EntityConnection[] = [];
      const rewritten: EntityConnection[] = [];
      e.connections.forEach((c, i) => (matchedIo.has(i) ? rewritten.push(newConnection(replaceIo, c)) : kept.push(c)));
      e.connections = [...kept, ...rewritten];
    }

    for (const { key, value } of a.delete) {
      const k = key.toLowerCase();
      if (k === '') continue;
      const actual = e.props[k];
      if (actual !== undefined && valueMatches(actual, compileValue(value))) delete e.props[k];
    }
    for (const spec of a.deleteIo) e.connections = e.connections.filter((c) => !connectionMatches(c, spec));

    setKeyValues(e, a.insert);
    for (const io of a.insertIo) e.connections.push(newConnection(io));
  }
}

const KIND_RANK: Record<StripperAction['kind'], number> = { filter: 0, add: 1, modify: 2 };

/** What a config file does to a lump: filters first, then adds, then modifies, each in file order. */
function inExecutionOrder(actions: StripperAction[]): StripperAction[] {
  return actions.map((a, i) => ({ a, i })).sort((x, y) => KIND_RANK[x.a.kind] - KIND_RANK[y.a.kind] || x.i - y.i).map((x) => x.a);
}

export interface ActionResult {
  /** Entities the match selected (for add actions: 1 per lump the entity was created in). */
  matched: number;
  /** Loaded entities that were selected, capped for display. */
  samples: MapEntity[];
  /** Some of the selected entities were created by an earlier add action rather than loaded from the map. */
  hitAdded: number;
  /** Regex errors found in this action's values. */
  errors: string[];
  /** False when the action's target lump does not exist in the loaded map. */
  lumpKnown: boolean;
}

export interface StripperSimulation {
  perAction: Map<string, ActionResult>;
  /** Loaded entity id -> the entity as it is after the config ran (absent when a filter removed it). */
  after: Map<number, SimEntity>;
  /** Entities created by "add" actions, with the lump each one lands in. */
  created: { target: string; entity: SimEntity }[];
  /** Loaded entity id -> what the config does to it. */
  touched: Map<number, 'filter' | 'modify'>;
  removed: number;
  modified: number;
  added: number;
}

const SAMPLE_LIMIT = 12;

function regexErrors(a: StripperAction): string[] {
  const errors: string[] = [];
  const check = (v: string | undefined): void => {
    if (v === undefined) return;
    const m = compileValue(v);
    if (m.kind === 'invalid') errors.push(`${v}: ${m.error}`);
  };
  const checkKv = (kvs: KV[]): void => kvs.forEach((kv) => check(kv.value));
  const checkIo = (list: (IoSpec | undefined)[]): void => {
    for (const io of list) {
      if (!io) continue;
      check(io.outputname);
      check(io.targetname);
      check(io.inputname);
      check(io.overrideparam);
    }
  };
  if (a.kind === 'filter') {
    checkKv(a.match);
    checkIo(a.io);
  } else if (a.kind === 'modify') {
    checkKv(a.match);
    checkIo(a.matchIo);
    checkKv(a.delete);
    checkIo(a.deleteIo);
  }
  return [...new Set(errors)];
}

/** Runs every action over the loaded entities, lump by lump, the way the plugin does at map load. */
export function simulateStripper(entities: MapEntity[], config: StripperConfig, mapName: string): StripperSimulation {
  const perAction = new Map<string, ActionResult>();
  const after = new Map<number, SimEntity>();
  const created: { target: string; entity: SimEntity }[] = [];
  const touched = new Map<number, 'filter' | 'modify'>();
  const knownLumps = new Set<string>();
  const byLump = new Map<string, MapEntity[]>();
  for (const e of entities) {
    const t = targetForEntity(e, mapName);
    knownLumps.add(t);
    let list = byLump.get(t);
    if (!list) byLump.set(t, (list = []));
    list.push(e);
  }

  for (const a of config.actions) {
    perAction.set(a.uid, {
      matched: 0,
      samples: [],
      hitAdded: 0,
      errors: regexErrors(a),
      lumpKnown: a.target === GLOBAL_MAP || a.target === GLOBAL_LUMP || knownLumps.has(a.target) || (entities.length === 0 && a.target === MAIN_LUMP),
    });
  }

  let added = 0;

  // lumps named only by the config still get their (empty) pass so adds are counted
  const lumpNames = new Set<string>([...byLump.keys(), ...config.actions.filter((a) => a.target !== GLOBAL_MAP && a.target !== GLOBAL_LUMP).map((a) => a.target)]);

  for (const lump of lumpNames) {
    let list: SimEntity[] = (byLump.get(lump) ?? []).map(toSimEntity);
    const pass: StripperAction[] = [
      ...inExecutionOrder(config.actions.filter((a) => a.target === lump)),
      ...(lump === MAIN_LUMP ? inExecutionOrder(config.actions.filter((a) => a.target === GLOBAL_MAP)) : []),
      ...inExecutionOrder(config.actions.filter((a) => a.target === GLOBAL_LUMP)),
    ];
    // the plugin applies the lump file, then global_map, then global_lump, each as its own
    // filter -> add -> modify pass, which is how `pass` is assembled above
    for (const a of pass) {
      const r = perAction.get(a.uid)!;
      const hit = (e: SimEntity, kind: 'filter' | 'modify'): void => {
        r.matched += 1;
        if (e.origin) {
          if (r.samples.length < SAMPLE_LIMIT) r.samples.push(e.origin);
          if (kind === 'filter') {
            touched.set(e.origin.id, 'filter');
          } else if (touched.get(e.origin.id) !== 'filter') {
            touched.set(e.origin.id, 'modify');
          }
        } else r.hitAdded += 1;
      };
      if (a.kind === 'filter') {
        list = applyFilter(list, a, (e) => hit(e, 'filter'));
      } else if (a.kind === 'add') {
        applyAdd(list, a);
        r.matched += 1;
        added += 1;
      } else {
        applyModify(list, a, (e) => hit(e, 'modify'));
      }
    }
    for (const e of list) {
      if (e.origin) after.set(e.origin.id, e);
      else created.push({ target: lump, entity: e });
    }
  }
  let removed = 0;
  let modified = 0;
  for (const kind of touched.values()) {
    if (kind === 'filter') removed += 1;
    else modified += 1;
  }

  return { perAction, after, created, touched, removed, modified, added };
}
