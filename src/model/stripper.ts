/**
 * StripperCS2 config model: filter / add / modify actions written to
 * addons/StripperCS2/maps/<map>/<world name>/<lump name>.jsonc (or the global_*.jsonc files).
 *
 * Schema and semantics follow Source2ZE/StripperCS2 (src/providers/json/json_actions.cpp and
 * src/actions/actions.cpp):
 *  - every key value is a string; a value written as "/pattern/" is a PCRE2 regex (case-insensitive,
 *    not anchored)
 *  - an output ("io") is an object with outputname / targetname / inputname / overrideparam
 *    (strings or regex) and delay / timestofire / targettype (numbers)
 *  - the file is parsed with nlohmann::json 3.11 (comments allowed, trailing commas are not)
 */

import type { MapEntity } from './entity';

export interface KV {
  key: string;
  value: string;
}

export interface IoSpec {
  outputname?: string;
  targetname?: string;
  inputname?: string;
  overrideparam?: string;
  delay?: number;
  timestofire?: number;
  targettype?: number;
}

export const IO_STRING_FIELDS = ['outputname', 'targetname', 'inputname', 'overrideparam'] as const;
export const IO_NUMBER_FIELDS = ['delay', 'timestofire', 'targettype'] as const;
export type IoStringField = (typeof IO_STRING_FIELDS)[number];
export type IoNumberField = (typeof IO_NUMBER_FIELDS)[number];

/** EntityIOTargetType_t from the hl2sdk (the value Hammer writes is 7). */
export const TARGET_TYPES: { value: number; label: string }[] = [
  { value: 0, label: 'classname' },
  { value: 1, label: 'classname (derives from)' },
  { value: 2, label: 'entity name' },
  { value: 3, label: 'contains component' },
  { value: 4, label: '!activator' },
  { value: 5, label: '!caller' },
  { value: 6, label: 'ehandle' },
  { value: 7, label: 'entity name or classname' },
];

interface ActionBase {
  /** Local editor id, never serialized. */
  uid: string;
  /**
   * Config file this action is written to, relative to addons/StripperCS2/maps/<map>/ and without the
   * extension ("default_ents", "prefabs/misc/foo/default_ents"), or one of the global targets.
   */
  target: string;
  /** Free text written as a comment above the action. */
  note?: string;
}

export interface FilterAction extends ActionBase {
  kind: 'filter';
  match: KV[];
  io: IoSpec[];
}

export interface AddAction extends ActionBase {
  kind: 'add';
  keyvalues: KV[];
  io: IoSpec[];
}

export interface ModifyAction extends ActionBase {
  kind: 'modify';
  match: KV[];
  matchIo: IoSpec[];
  replace: KV[];
  /** One object applied to every output selected by matchIo. */
  replaceIo?: IoSpec;
  delete: KV[];
  deleteIo: IoSpec[];
  insert: KV[];
  insertIo: IoSpec[];
}

export type StripperAction = FilterAction | AddAction | ModifyAction;

export interface StripperConfig {
  actions: StripperAction[];
}

export const GLOBAL_MAP = '@global_map';
export const GLOBAL_LUMP = '@global_lump';
export const MAIN_LUMP = 'default_ents';

export function isGlobalTarget(target: string): boolean {
  return target === GLOBAL_MAP || target === GLOBAL_LUMP;
}

/** Path of a target's file below addons/StripperCS2/. */
export function targetFilePath(target: string, mapName: string): string {
  if (target === GLOBAL_MAP) return 'global_map.jsonc';
  if (target === GLOBAL_LUMP) return 'global_lump.jsonc';
  return `maps/${mapName}/${target}.jsonc`;
}

/**
 * The target (config file) an entity's lump maps to. StripperCS2 names the file after the lump
 * and puts it in a folder named after the world: the map's own world has no folder, a nested
 * world (prefabs/misc/foo) does. Hammer maps carry no lump layout, so everything goes to the main lump.
 */
export function targetForEntity(e: MapEntity, mapName: string): string {
  if (e.source.kind !== 'vpk') return MAIN_LUMP;
  const lump = (e.source.container || MAIN_LUMP).toLowerCase();
  const m = /^maps\/(.+)\/entities\/[^/]+$/i.exec(e.source.file.replace(/\\/g, '/'));
  const world = m ? m[1].toLowerCase() : '';
  if (!world || world === mapName.toLowerCase() || !world.includes('/')) return lump;
  return `${world}/${lump}`;
}

/** All distinct targets of the entities in a map, main lump first. */
export function targetsOfEntities(entities: MapEntity[], mapName: string): string[] {
  const seen = new Set<string>();
  for (const e of entities) seen.add(targetForEntity(e, mapName));
  return [...seen].sort((a, b) => Number(b === MAIN_LUMP) - Number(a === MAIN_LUMP) || a.localeCompare(b));
}

let uidCounter = 0;
export function newActionUid(): string {
  uidCounter += 1;
  return `s${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function newFilter(partial: Partial<Omit<FilterAction, 'kind' | 'uid'>> = {}): FilterAction {
  return { kind: 'filter', uid: newActionUid(), target: MAIN_LUMP, match: [], io: [], ...partial };
}

export function newAdd(partial: Partial<Omit<AddAction, 'kind' | 'uid'>> = {}): AddAction {
  return { kind: 'add', uid: newActionUid(), target: MAIN_LUMP, keyvalues: [{ key: 'classname', value: '' }], io: [], ...partial };
}

export function newModify(partial: Partial<Omit<ModifyAction, 'kind' | 'uid'>> = {}): ModifyAction {
  return {
    kind: 'modify',
    uid: newActionUid(),
    target: MAIN_LUMP,
    match: [],
    matchIo: [],
    replace: [],
    delete: [],
    deleteIo: [],
    insert: [],
    insertIo: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

/** True when StripperCS2 will treat the value as a regex ("/.../", at least 3 characters). */
export function isRegexValue(value: string): boolean {
  return value.length >= 3 && value.startsWith('/') && value.endsWith('/');
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * A value that matches exactly this text. Plain text already does, unless it happens to look like
 * "/.../" (then StripperCS2 would compile it as a regex), in which case an anchored regex is used.
 */
export function exactValue(text: string): string {
  return isRegexValue(text) ? `/^${escapeRegex(text)}$/` : text;
}

export function ioIsEmpty(io: IoSpec): boolean {
  return IO_STRING_FIELDS.every((f) => io[f] === undefined) && IO_NUMBER_FIELDS.every((f) => io[f] === undefined);
}

export function cloneIo(io: IoSpec): IoSpec {
  return { ...io };
}

export function cloneAction<T extends StripperAction>(a: T, withNewUid = false): T {
  const copy = JSON.parse(JSON.stringify(a)) as T;
  if (withNewUid) copy.uid = newActionUid();
  return copy;
}

// ---------------------------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------------------------

export interface SerializeStripperOptions {
  comments?: boolean;
  indent?: string;
}

const q = (s: string): string => JSON.stringify(s);

function numText(n: number): string {
  return Number.isFinite(n) ? String(n) : '0';
}

function ioText(io: IoSpec): string {
  const parts: string[] = [];
  for (const f of IO_STRING_FIELDS) if (io[f] !== undefined) parts.push(`${q(f)}: ${q(io[f] as string)}`);
  for (const f of IO_NUMBER_FIELDS) if (io[f] !== undefined) parts.push(`${q(f)}: ${numText(io[f] as number)}`);
  return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`;
}

function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

/** Lines of `"key": "value"` pairs, last one carries the comma state given by `trailing`. */
function kvLines(kvs: KV[], ind: string): string[] {
  // a later duplicate key would be ignored by the engine's object model anyway; keep the last one
  const map = new Map<string, string>();
  for (const kv of kvs) if (kv.key !== '') map.set(kv.key, kv.value);
  return [...map.entries()].map(([k, v]) => `${ind}${q(k)}: ${q(v)}`);
}

function ioArrayLines(list: IoSpec[], ind: string, step: string): string[] {
  const lines: string[] = [`${ind}"io": [`];
  list.forEach((io, i) => lines.push(`${ind}${step}${ioText(io)}${i === list.length - 1 ? '' : ','}`));
  lines.push(`${ind}]`);
  return lines;
}

/** Object body: key values followed by an optional io entry; commas are added between the pieces. */
function objectBody(kvs: KV[], extra: string[][], ind: string): string[] {
  const pieces: string[][] = kvLines(kvs, ind).map((l) => [l]);
  for (const e of extra) pieces.push(e);
  const out: string[] = [];
  pieces.forEach((p, i) => {
    p.forEach((l, j) => out.push(j === p.length - 1 && i < pieces.length - 1 ? `${l},` : l));
  });
  return out;
}

function actionLines(a: StripperAction, ind: string, step: string, comments: boolean): string[] {
  const i1 = ind;
  const i2 = ind + step;
  const i3 = ind + step + step;
  const out: string[] = [];
  if (comments && a.note) out.push(`${i1}// ${oneLine(a.note)}`);
  out.push(`${i1}{`);
  if (a.kind === 'filter') {
    out.push(...objectBody(a.match, a.io.length > 0 ? [ioArrayLines(a.io, i2, step)] : [], i2));
  } else if (a.kind === 'add') {
    out.push(...objectBody(a.keyvalues, a.io.length > 0 ? [ioArrayLines(a.io, i2, step)] : [], i2));
  } else {
    const sections: string[][] = [];
    const section = (name: string, body: string[]): void => {
      sections.push(body.length === 0 ? [`${i2}${q(name)}: {}`] : [`${i2}${q(name)}: {`, ...body, `${i2}}`]);
    };
    section('match', objectBody(a.match, a.matchIo.length > 0 ? [ioArrayLines(a.matchIo, i3, step)] : [], i3));
    const replaceExtra: string[][] = a.replaceIo && !ioIsEmpty(a.replaceIo) ? [[`${i3}"io": ${ioText(a.replaceIo)}`]] : [];
    if (a.replace.some((k) => k.key !== '') || replaceExtra.length > 0) section('replace', objectBody(a.replace, replaceExtra, i3));
    if (a.delete.some((k) => k.key !== '') || a.deleteIo.length > 0) {
      section('delete', objectBody(a.delete, a.deleteIo.length > 0 ? [ioArrayLines(a.deleteIo, i3, step)] : [], i3));
    }
    if (a.insert.some((k) => k.key !== '') || a.insertIo.length > 0) {
      section('insert', objectBody(a.insert, a.insertIo.length > 0 ? [ioArrayLines(a.insertIo, i3, step)] : [], i3));
    }
    sections.forEach((s, i) => {
      s.forEach((l, j) => out.push(j === s.length - 1 && i < sections.length - 1 ? `${l},` : l));
    });
  }
  out.push(`${i1}}`);
  return out;
}

/** Writes the actions of one target as a StripperCS2 file (filter, add, modify: the order the plugin runs them in). */
export function serializeStripperFile(actions: StripperAction[], opts: SerializeStripperOptions = {}): string {
  const step = opts.indent ?? '    ';
  const comments = opts.comments ?? true;
  const groups: { key: string; items: StripperAction[] }[] = [
    { key: 'filter', items: actions.filter((a) => a.kind === 'filter') },
    { key: 'add', items: actions.filter((a) => a.kind === 'add') },
    { key: 'modify', items: actions.filter((a) => a.kind === 'modify') },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return '{}\n';

  const out: string[] = ['{'];
  groups.forEach((g, gi) => {
    out.push(`${step}${q(g.key)}: [`);
    g.items.forEach((a, ai) => {
      const lines = actionLines(a, step + step, step, comments);
      const last = ai === g.items.length - 1;
      lines.forEach((l, li) => out.push(li === lines.length - 1 && !last ? `${l},` : l));
    });
    out.push(`${step}]${gi === groups.length - 1 ? '' : ','}`);
  });
  out.push('}');
  return out.join('\n') + '\n';
}

/** Targets that have at least one action, lump files first (in order of appearance), then the globals. */
export function activeTargets(config: StripperConfig): string[] {
  const seen: string[] = [];
  for (const a of config.actions) if (!seen.includes(a.target)) seen.push(a.target);
  return seen.sort((a, b) => Number(isGlobalTarget(a)) - Number(isGlobalTarget(b)));
}

export function serializeStripperConfig(config: StripperConfig, mapName: string, opts: SerializeStripperOptions = {}): { target: string; path: string; text: string }[] {
  return activeTargets(config).map((target) => ({
    target,
    path: targetFilePath(target, mapName),
    text: serializeStripperFile(
      config.actions.filter((a) => a.target === target),
      opts,
    ),
  }));
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

export interface JsonObject {
  /** Entries in file order; duplicate keys are kept. */
  entries: [string, JsonNode][];
}
export type JsonNode = string | number | boolean | null | JsonNode[] | JsonObject;

export function isJsonObject(n: JsonNode | undefined): n is JsonObject {
  return typeof n === 'object' && n !== null && !Array.isArray(n);
}

/**
 * JSON with comments reader that keeps duplicate keys (StripperCS2 allows repeating "filter" /
 * "add" / "modify") and reports trailing commas, which the plugin's JSON parser rejects.
 */
export function parseJsonc(text: string): { value: JsonNode; warnings: string[] } {
  const warnings: string[] = [];
  let i = 0;
  const n = text.length;

  const fail = (msg: string): never => {
    const upTo = text.slice(0, i);
    const line = upTo.split('\n').length;
    const col = i - upTo.lastIndexOf('\n');
    throw new Error(`${msg} (line ${line}, column ${col})`);
  };

  const skip = (): void => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++;
      } else if (text[i] === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end < 0) fail('Unterminated comment');
        i = end + 2;
      } else return;
    }
  };

  const parseString = (): string => {
    i++; // opening quote
    let s = '';
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return s;
      }
      if (c === '\\') {
        const e = text[i + 1];
        i += 2;
        switch (e) {
          case 'n': s += '\n'; break;
          case 't': s += '\t'; break;
          case 'r': s += '\r'; break;
          case 'b': s += '\b'; break;
          case 'f': s += '\f'; break;
          case '/': s += '/'; break;
          case '\\': s += '\\'; break;
          case '"': s += '"'; break;
          case 'u': {
            const hex = text.slice(i, i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Bad \\u escape');
            s += String.fromCharCode(parseInt(hex, 16));
            i += 4;
            break;
          }
          default:
            fail(`Bad escape \\${e ?? ''}`);
        }
        continue;
      }
      s += c;
      i++;
    }
    return fail('Unterminated string');
  };

  const parseValue = (): JsonNode => {
    skip();
    const c = text[i];
    if (c === '{') {
      i++;
      const entries: [string, JsonNode][] = [];
      skip();
      if (text[i] === '}') {
        i++;
        return { entries };
      }
      for (;;) {
        skip();
        if (text[i] !== '"') fail('Expected a quoted key');
        const key = parseString();
        skip();
        if (text[i] !== ':') fail('Expected ":"');
        i++;
        entries.push([key, parseValue()]);
        skip();
        if (text[i] === ',') {
          i++;
          skip();
          if (text[i] === '}') {
            warnings.push('trailing comma before "}" — StripperCS2 (nlohmann json 3.11) refuses to load this file');
            i++;
            return { entries };
          }
          continue;
        }
        if (text[i] === '}') {
          i++;
          return { entries };
        }
        fail('Expected "," or "}"');
      }
    }
    if (c === '[') {
      i++;
      const items: JsonNode[] = [];
      skip();
      if (text[i] === ']') {
        i++;
        return items;
      }
      for (;;) {
        items.push(parseValue());
        skip();
        if (text[i] === ',') {
          i++;
          skip();
          if (text[i] === ']') {
            warnings.push('trailing comma before "]" — StripperCS2 (nlohmann json 3.11) refuses to load this file');
            i++;
            return items;
          }
          continue;
        }
        if (text[i] === ']') {
          i++;
          return items;
        }
        fail('Expected "," or "]"');
      }
    }
    if (c === '"') return parseString();
    const lit = /^(?:true|false|null)/.exec(text.slice(i, i + 5));
    if (lit) {
      i += lit[0].length;
      return lit[0] === 'true' ? true : lit[0] === 'false' ? false : null;
    }
    const num = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 40));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    return fail(i >= n ? 'Unexpected end of file' : `Unexpected character "${c}"`);
  };

  const value = parseValue();
  skip();
  if (i < n) fail('Unexpected content after the root value');
  return { value, warnings };
}

function entriesOf(node: JsonNode | undefined): [string, JsonNode][] {
  return isJsonObject(node) ? node.entries : [];
}

function toKv(node: JsonNode | undefined, ctx: string, warnings: string[]): { kvs: KV[]; io: JsonNode[]; ioObject?: JsonObject } {
  const kvs: KV[] = [];
  const io: JsonNode[] = [];
  let ioObject: JsonObject | undefined;
  for (const [key, value] of entriesOf(node)) {
    if (key === 'io') {
      if (Array.isArray(value)) io.push(...value);
      else if (isJsonObject(value)) ioObject = value;
      else warnings.push(`${ctx}: "io" must be an array (or an object in "replace")`);
      continue;
    }
    if (key.toLowerCase() === 'io') warnings.push(`${ctx}: key "${key}" is not "io" in lower case and is treated as a key value`);
    if (typeof value === 'string') kvs.push({ key, value });
    else if (typeof value === 'number' || typeof value === 'boolean') {
      kvs.push({ key, value: String(value) });
      warnings.push(`${ctx}: "${key}" is not a string; converted (StripperCS2 refuses to load non-string key values)`);
    } else warnings.push(`${ctx}: "${key}" has an unsupported value and was skipped`);
  }
  return { kvs, io, ioObject };
}

function toIo(node: JsonNode, ctx: string, warnings: string[]): IoSpec {
  const io: IoSpec = {};
  for (const [key, value] of entriesOf(node)) {
    if ((IO_STRING_FIELDS as readonly string[]).includes(key)) {
      if (typeof value === 'string') io[key as IoStringField] = value;
      else warnings.push(`${ctx}: io "${key}" must be a string`);
    } else if ((IO_NUMBER_FIELDS as readonly string[]).includes(key)) {
      if (typeof value === 'number') io[key as IoNumberField] = value;
      else warnings.push(`${ctx}: io "${key}" must be a number`);
    } else warnings.push(`${ctx}: unknown io key "${key}" ignored`);
  }
  return io;
}

function toIoList(nodes: JsonNode[], ctx: string, warnings: string[]): IoSpec[] {
  return nodes.filter((n) => isJsonObject(n)).map((n) => toIo(n, ctx, warnings));
}

/** Reads one StripperCS2 file (all "filter" / "add" / "modify" blocks, repeated or not) into actions for `target`. */
export function parseStripperFile(text: string, target: string): { actions: StripperAction[]; warnings: string[] } {
  const { value, warnings } = parseJsonc(text);
  if (!isJsonObject(value)) throw new Error('The root of a StripperCS2 file must be an object');
  const actions: StripperAction[] = [];

  for (const [name, node] of value.entries) {
    if (name === '$schema') continue;
    if (name !== 'filter' && name !== 'add' && name !== 'modify') {
      warnings.push(`unknown top level key "${name}" ignored`);
      continue;
    }
    // an array of actions, or a single object
    const list: JsonNode[] = Array.isArray(node) ? node : [node];
    list.forEach((item, idx) => {
      const ctx = `${name}[${idx}]`;
      if (!isJsonObject(item)) {
        warnings.push(`${ctx} is not an object and was skipped`);
        return;
      }
      if (name === 'filter') {
        const { kvs, io } = toKv(item, ctx, warnings);
        actions.push(newFilter({ target, match: kvs, io: toIoList(io, ctx, warnings) }));
      } else if (name === 'add') {
        const { kvs, io } = toKv(item, ctx, warnings);
        actions.push(newAdd({ target, keyvalues: kvs, io: toIoList(io, ctx, warnings) }));
      } else {
        const a = newModify({ target });
        for (const [section, body] of item.entries) {
          const sctx = `${ctx}.${section}`;
          if (section !== 'replace' && isJsonObject(body) && body.entries.some(([k, v]) => k === 'io' && isJsonObject(v))) {
            warnings.push(`${sctx}: "io" must be an array here (only "replace" takes a single object)`);
          }
          if (section === 'match') {
            const r = toKv(body, sctx, warnings);
            a.match = r.kvs;
            a.matchIo = toIoList(r.io, sctx, warnings);
          } else if (section === 'replace') {
            const r = toKv(body, sctx, warnings);
            a.replace = r.kvs;
            if (r.ioObject) a.replaceIo = toIo(r.ioObject, sctx, warnings);
            else if (r.io.length > 0) {
              warnings.push(`${sctx}: "io" must be an object, not an array; the first entry was used`);
              a.replaceIo = toIoList(r.io, sctx, warnings)[0];
            }
          } else if (section === 'delete') {
            const r = toKv(body, sctx, warnings);
            a.delete = r.kvs;
            a.deleteIo = toIoList(r.io, sctx, warnings);
          } else if (section === 'insert') {
            const r = toKv(body, sctx, warnings);
            a.insert = r.kvs;
            a.insertIo = toIoList(r.io, sctx, warnings);
          } else warnings.push(`${ctx}: unknown section "${section}" ignored`);
        }
        actions.push(a);
      }
    });
  }
  return { actions, warnings };
}
