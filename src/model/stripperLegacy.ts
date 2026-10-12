/**
 * Conversion of CS:GO Stripper:Source configs (addons/stripper/maps/<map>.cfg,
 * global_filters.cfg) into StripperCS2 actions.
 *
 * The CS:GO format is a list of sections ("filter:" / "remove:", "add:", "modify:") each followed by
 * `{ "key" "value" ... }` blocks; a modify block holds "match:", "replace:", "delete:" and "insert:"
 * sub-blocks. Outputs there are ordinary key values ("OnTrigger" "relay,Trigger,,0,-1", or with the
 * ESC character as separator), while StripperCS2 has a separate "io" list with one field per part,
 * so outputs are recognised and split. Values written as "/pattern/" are regexes in both formats.
 *
 * What changes between the games is reported as warnings (and on the action's note):
 *  - "hammerid" becomes "hammeruniqueid"; ported maps usually have new ids, so check the match count
 *  - .mdl / .vmt paths become .vmdl / .vmat; brush models ("*12") have no CS2 equivalent
 *  - AddOutput that adds an output ("OnX target:input:param:delay:times") is not vanilla CS2
 */

import { MAIN_LUMP, exactValue, isRegexValue, newAdd, newFilter, newModify, type IoSpec, type KV, type ModifyAction, type StripperAction } from './stripper';

type Token = { kind: 'str'; text: string; line: number } | { kind: 'word'; text: string; line: number } | { kind: 'open' | 'close'; line: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '\n') {
      line++;
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === ';' || c === '#' || (c === '/' && text[i + 1] === '/')) {
      while (i < n && text[i] !== '\n') i++;
    } else if (c === '{') {
      tokens.push({ kind: 'open', line });
      i++;
    } else if (c === '}') {
      tokens.push({ kind: 'close', line });
      i++;
    } else if (c === '"') {
      const start = line;
      let s = '';
      i++;
      // Stripper:Source has no escapes inside quotes; a string ends at the next quote or line end
      while (i < n && text[i] !== '"' && text[i] !== '\n') s += text[i++];
      if (text[i] === '"') i++;
      tokens.push({ kind: 'str', text: s, line: start });
    } else {
      let s = '';
      while (i < n && !/[\s{}"]/.test(text[i])) s += text[i++];
      tokens.push({ kind: 'word', text: s, line });
    }
  }
  return tokens;
}

/** True when the text reads as a CS:GO Stripper:Source config rather than StripperCS2 jsonc. */
export function isLegacyStripperText(text: string): boolean {
  const body = text
    .split('\n')
    .filter((l) => !/^\s*(?:;|#|\/\/)/.test(l))
    .join('\n')
    .trim();
  if (body.startsWith('{') && /^\{\s*("|\})/.test(body)) return false;
  return /^\s*(?:filter|remove|add|modify)\s*:/im.test(body);
}

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

const ESC = '\x1b';

function splitOutput(value: string): string[] {
  return value.split(value.includes(ESC) ? ESC : ',');
}

const NUM = /^-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?$|^-?\.\d+$/;

/** True when a plain (non-regex) value has the shape of an output: target,input,param,delay,times. */
function isOutputValue(value: string): boolean {
  const parts = splitOutput(value);
  return parts.length === 5 && (parts[3].trim() === '' || NUM.test(parts[3].trim())) && (parts[4].trim() === '' || NUM.test(parts[4].trim()));
}

/** Keys that name an output: OnTrigger, OnStartTouch, OutValue, OnUser1 ... */
function isOutputKey(key: string): boolean {
  return /^(?:on|out)[a-z0-9_]/i.test(key);
}

const CATCH_ALL = new Set(['', '.*', '.+', '^.*$', '^.+$', '.*?', '(.*)']);

export interface LegacyConversion {
  actions: StripperAction[];
  warnings: string[];
}

interface Ctx {
  /** Warnings for the action being converted (also written to its note). */
  notes: Set<string>;
  where: string;
  warnings: string[];
}

function warn(ctx: Ctx, msg: string): void {
  ctx.notes.add(msg);
  ctx.warnings.push(`${ctx.where}: ${msg}`);
}

function numberOf(text: string): number | undefined {
  const t = text.trim();
  return NUM.test(t) ? Number(t) : undefined;
}

/**
 * An output key value as an io spec. `full` (add / insert) spells out every field the way the game
 * reads it; otherwise (match / delete / filter) the spec selects outputs the way Stripper:Source's
 * whole-string comparison did.
 */
function outputToIo(key: string, value: string, full: boolean, ctx: Ctx): IoSpec {
  if (isRegexValue(value)) {
    const inner = value.slice(1, -1);
    if (CATCH_ALL.has(inner)) return { outputname: key };
    const parts = splitOutput(inner);
    if (parts.length === 5) {
      const io: IoSpec = { outputname: key };
      const field = (p: string): string | undefined => (CATCH_ALL.has(p) ? undefined : `/^(?:${p})$/`);
      const [target, input, param, delay, times] = parts;
      if (field(target)) io.targetname = field(target);
      if (field(input)) io.inputname = field(input);
      if (field(param)) io.overrideparam = field(param);
      if (numberOf(delay) !== undefined) io.delay = numberOf(delay);
      if (numberOf(times) !== undefined) io.timestofire = Math.trunc(numberOf(times) as number);
      return io;
    }
    warn(ctx, `regex ${value} on output ${key} cannot be split into fields; it now selects every ${key} output`);
    return { outputname: key };
  }
  const [target, input, param, delay, times] = splitOutput(value).map((p) => p.trim());
  const io: IoSpec = { outputname: key, targetname: full ? target : exactValue(target), inputname: full ? input : exactValue(input) };
  const d = numberOf(delay) ?? 0;
  const t = Math.trunc(numberOf(times) ?? -1);
  if (full) {
    if (param !== '') io.overrideparam = param;
    if (d !== 0) io.delay = d;
    if (t !== -1) io.timestofire = t;
  } else {
    // the CS:GO comparison was on the whole string, so every part takes part in the match
    io.overrideparam = exactValue(param);
    io.delay = d;
    io.timestofire = t;
  }
  if (/^addoutput$/i.test(input) && /^\s*on\w+\s+[^:\s]*:/i.test(param)) {
    warn(ctx, `${key} → AddOutput "${param}" adds an output, which vanilla CS2 AddOutput does not support (CS2Fixes does)`);
  }
  return io;
}

// ---------------------------------------------------------------------------------------------
// Key values
// ---------------------------------------------------------------------------------------------

/** Swaps a file extension: at the end of a plain value, or written as `\.ext` inside a regex. */
function convertPath(value: string, from: string, to: string): string {
  if (isRegexValue(value)) return value.replace(new RegExp(`\\\\\\.${from}(?![a-z0-9])`, 'gi'), `\\.${to}`);
  return value.replace(new RegExp(`\\.${from}$`, 'i'), `.${to}`);
}

/** One key value of the CS:GO config in StripperCS2 terms. */
function convertKv(kv: KV, ctx: Ctx): KV {
  let { key, value } = kv;
  const lower = key.toLowerCase();
  if (lower === 'hammerid') {
    key = 'hammeruniqueid';
    warn(ctx, 'hammerid → hammeruniqueid; ids usually change when a map is ported, check the match count');
  }
  if (lower === 'model') {
    if (/^\*\d+$/.test(value)) warn(ctx, `brush model "${value}" has no CS2 equivalent`);
    else if (/\.mdl\/?$/i.test(value) || /\\\.mdl/i.test(value)) {
      const next = convertPath(value, 'mdl', 'vmdl');
      if (next !== value) {
        warn(ctx, `model ${value} → ${next}`);
        value = next;
      }
    }
  } else if (/\.vmt\/?$/i.test(value)) {
    const next = convertPath(value, 'vmt', 'vmat');
    if (next !== value) {
      warn(ctx, `${key} ${value} → ${next}`);
      value = next;
    }
  } else if (lower === 'message' && /\.(?:wav|mp3)$/i.test(value)) {
    warn(ctx, `sound file "${value}": CS2 plays sound events, not files`);
  }
  return { key, value };
}

/** Splits a block's key values into plain key values and outputs. */
function splitBlock(kvs: KV[], full: boolean, ctx: Ctx): { kvs: KV[]; io: IoSpec[] } {
  const out: KV[] = [];
  const io: IoSpec[] = [];
  for (const kv of kvs) {
    const regex = isRegexValue(kv.value);
    if (isOutputKey(kv.key) && (regex ? true : isOutputValue(kv.value))) io.push(outputToIo(kv.key, kv.value, full, ctx));
    else out.push(convertKv(kv, ctx));
  }
  return { kvs: out, io };
}

function noteFor(ctx: Ctx): string | undefined {
  return ctx.notes.size > 0 ? `CS:GO: ${[...ctx.notes].join('; ')}` : undefined;
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

type Section = 'filter' | 'add' | 'modify';
const SUBSECTIONS = ['match', 'replace', 'delete', 'insert'] as const;
type Subsection = (typeof SUBSECTIONS)[number];

/** Converts a whole Stripper:Source config into StripperCS2 actions for `target`. */
export function convertLegacyStripper(text: string, target: string = MAIN_LUMP): LegacyConversion {
  const tokens = tokenize(text);
  const warnings: string[] = [];
  const actions: StripperAction[] = [];
  let pos = 0;
  let section: Section | null = null;
  const count: Record<Section, number> = { filter: 0, add: 0, modify: 0 };

  const fail = (msg: string, tok?: Token): never => {
    throw new Error(`${msg}${tok ? ` (line ${tok.line})` : ''}`);
  };

  /** A header word: "filter:" or "filter" followed by a ":" word. */
  const header = (): string | null => {
    const t = tokens[pos];
    if (t?.kind !== 'word') return null;
    if (t.text.endsWith(':') && t.text.length > 1) {
      pos++;
      return t.text.slice(0, -1).toLowerCase();
    }
    if (tokens[pos + 1]?.kind === 'word' && (tokens[pos + 1] as { text: string }).text === ':') {
      pos += 2;
      return t.text.toLowerCase();
    }
    return null;
  };

  /** `{ "key" "value" ... }` with pos on the "{". */
  const pairs = (): KV[] => {
    const open = tokens[pos];
    if (open?.kind !== 'open') fail('Expected "{"', open);
    pos++;
    const kvs: KV[] = [];
    for (;;) {
      const t = tokens[pos];
      if (!t) return fail('Missing "}"', open);
      if (t.kind === 'close') {
        pos++;
        return kvs;
      }
      if (t.kind === 'open') fail('Unexpected "{"', t);
      const v = tokens[pos + 1];
      if (t.kind === 'word' && (!v || v.kind !== 'str')) fail(`Unexpected "${t.text}"`, t);
      if (!v || (v.kind !== 'str' && v.kind !== 'word')) fail(`Key "${(t as { text: string }).text}" has no value`, t);
      kvs.push({ key: (t as { text: string }).text, value: (v as { text: string }).text });
      pos += 2;
    }
  };

  const modifyBlock = (ctx: Ctx): ModifyAction => {
    const open = tokens[pos];
    pos++;
    const a = newModify({ target });
    const seen = new Set<Subsection>();
    for (;;) {
      const t = tokens[pos];
      if (!t) return fail('Missing "}"', open);
      if (t.kind === 'close') {
        pos++;
        break;
      }
      const name = header();
      if (!name || !(SUBSECTIONS as readonly string[]).includes(name)) return fail('Expected match: / replace: / delete: / insert:', t);
      const sub = name as Subsection;
      if (seen.has(sub)) warn(ctx, `repeated "${sub}:" merged`);
      seen.add(sub);
      const kvs = pairs();
      if (sub === 'match') {
        const r = splitBlock(kvs, false, ctx);
        a.match.push(...r.kvs);
        a.matchIo.push(...r.io);
      } else if (sub === 'delete') {
        const r = splitBlock(kvs, false, ctx);
        a.delete.push(...r.kvs);
        a.deleteIo.push(...r.io);
      } else if (sub === 'insert') {
        const r = splitBlock(kvs, true, ctx);
        a.insert.push(...r.kvs);
        a.insertIo.push(...r.io);
      } else {
        const r = splitBlock(kvs, true, ctx);
        a.replace.push(...r.kvs);
        if (r.io.length > 0) {
          // Stripper:Source replaced the value of the first output with that name; StripperCS2
          // rewrites the outputs the match selected, so select them by name too
          const first = r.io[0];
          if (r.io.length > 1) warn(ctx, 'only one output can be replaced per modify; the first replace output was used');
          const { outputname, ...rest } = first;
          if (!a.matchIo.some((m) => m.outputname === outputname)) a.matchIo.push({ outputname });
          a.replaceIo = rest;
        }
      }
    }
    return a;
  };

  while (pos < tokens.length) {
    const t = tokens[pos];
    if (t.kind === 'open') {
      if (!section) fail('A block before any "filter:" / "add:" / "modify:"', t);
      const s = section as Section;
      const ctx: Ctx = { notes: new Set(), where: `${s}[${count[s]}]`, warnings };
      count[s]++;
      let action: StripperAction;
      if (s === 'modify') {
        action = modifyBlock(ctx);
      } else {
        const r = splitBlock(pairs(), s === 'add', ctx);
        action = s === 'filter' ? newFilter({ target, match: r.kvs, io: r.io }) : newAdd({ target, keyvalues: r.kvs, io: r.io });
        if (s === 'filter' && r.kvs.length === 0 && r.io.length === 0) warn(ctx, 'empty filter, it would remove every entity');
      }
      const note = noteFor(ctx);
      if (note) action.note = note;
      actions.push(action);
      continue;
    }
    const start = tokens[pos];
    const name = header();
    if (name === 'filter' || name === 'remove') section = 'filter';
    else if (name === 'add' || name === 'modify') section = name;
    else fail(`Unexpected ${start.kind === 'close' ? '"}"' : `"${(start as { text: string }).text}"`}`, start);
  }
  return { actions, warnings };
}
