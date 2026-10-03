/**
 * EntWatch (CS2Fixes) map config model: <mapname>.jsonc under
 * addons/cs2fixes/configs/entwatch/maps/.
 *
 * Schema follows CS2Fixes src/entwatch.cpp (EWItem / EWItemHandler constructors).
 */

export type HandlerType = 'button' | 'counterup' | 'counterdown' | 'other';

/** EWHandlerMode: 0/1 none, 2 cooldown, 3 max uses, 4 cooldown after uses, 5 counter value */
export type HandlerMode = 0 | 1 | 2 | 3 | 4 | 5;

export const HANDLER_MODES: { value: HandlerMode; label: string }[] = [
  { value: 1, label: 'None' },
  { value: 2, label: 'Cooldown' },
  { value: 3, label: 'MaxUses' },
  { value: 4, label: 'CooldownAfterUses' },
  { value: 5, label: 'CounterValue' },
];

export const ENTWATCH_COLORS = [
  'white', 'darkred', 'team', 'green', 'lightgreen', 'olive', 'red', 'gray', 'yellow', 'silver', 'blue', 'darkblue',
  'purple', 'red2', 'orange',
] as const;

export type EntWatchColor = (typeof ENTWATCH_COLORS)[number] | string;

export interface HandlerConfig {
  /** Local editor id, never serialized. */
  uid: string;
  name?: string;
  type: HandlerType;
  hammerid: string;
  event?: string;
  mode: HandlerMode;
  cooldown?: number;
  maxuses?: number;
  /** [counter offset, counter max offset] */
  offset?: [number, number];
  message: boolean;
  ui: boolean;
  templated?: boolean;
}

export interface ItemConfig {
  uid: string;
  name: string;
  shortname: string;
  hammerid: string;
  message: boolean;
  ui: boolean;
  /** undefined = let CS2Fixes auto detect (false for knives). */
  transfer?: boolean;
  color: EntWatchColor;
  triggers: string[];
  templated?: boolean;
  handlers: HandlerConfig[];
}

export interface EntWatchConfig {
  items: ItemConfig[];
}

let uidCounter = 0;
export function newUid(prefix = 'u'): string {
  uidCounter += 1;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function newHandler(partial: Partial<HandlerConfig> = {}): HandlerConfig {
  return {
    uid: newUid('h'),
    type: 'button',
    hammerid: '',
    event: 'OnPressed',
    mode: 2,
    cooldown: 0,
    maxuses: 0,
    message: true,
    ui: true,
    ...partial,
  };
}

// ---------------------------------------------------------------------------------------------
// What each mode uses (CS2Fixes EWItemHandler::Use / UseCounter / UpdateHudText)
// ---------------------------------------------------------------------------------------------

/** counterup / counterdown: CS2Fixes forces their event to OutValue and reads their uses from the math_counter's min / max. */
export function isCounterHandler(h: Pick<HandlerConfig, 'type'>): boolean {
  return h.type === 'counterup' || h.type === 'counterdown';
}

/** The cooldown only counts in mode 2 (Cooldown), 3 (MaxUses, between uses) and 4 (CooldownAfterUses). */
export function usesCooldown(h: Pick<HandlerConfig, 'mode'>): boolean {
  return h.mode === 2 || h.mode === 3 || h.mode === 4;
}

/** maxuses only counts in modes 3 / 4, and never for counters (their min / max decide). */
export function usesMaxUses(h: Pick<HandlerConfig, 'type' | 'mode'>): boolean {
  return (h.mode === 3 || h.mode === 4) && !isCounterHandler(h);
}

/** Mode 5 shows a counter's value: CS2Fixes never prints a use in it, so message means nothing there. */
export function usesMessage(h: Pick<HandlerConfig, 'mode'>): boolean {
  return h.mode !== 5;
}

/** A plain +use hook: {"type": "button", "hammerid": "..."} (CS2Fixes only stops other players using it). */
export function isPlainButton(h: Pick<HandlerConfig, 'type' | 'mode' | 'event' | 'message' | 'ui'>): boolean {
  return h.type === 'button' && h.mode <= 1 && !h.event && !h.message && !h.ui;
}

/**
 * The handler as CS2Fixes sees it: cooldown 0 where the mode ignores it, maxuses 0 unless mode 3 /
 * 4 on a non-counter, no event on counters, message off in mode 5. The writer outputs these values
 * and leaves out what the mode does not read, like the GFL configs.
 */
export function effectiveHandler(h: HandlerConfig): HandlerConfig {
  return {
    ...h,
    event: isCounterHandler(h) ? undefined : h.event,
    cooldown: usesCooldown(h) ? (h.cooldown ?? 0) : 0,
    maxuses: usesMaxUses(h) ? (h.maxuses ?? 0) : 0,
    message: usesMessage(h) ? h.message : false,
  };
}

export function newItem(partial: Partial<ItemConfig> = {}): ItemConfig {
  return {
    uid: newUid('i'),
    name: '',
    shortname: '',
    hammerid: '',
    message: true,
    ui: true,
    color: 'white',
    triggers: [],
    handlers: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------------------------

export interface SerializeOptions {
  /** Called to produce an end-of-line comment for a hammerid (e.g. classname/targetname). */
  describeHammerId?: (hammerid: string) => string | undefined;
  /** Emit comments at all. */
  comments?: boolean;
  indent?: string;
}

function q(s: string): string {
  return JSON.stringify(s);
}

function num(n: number | undefined, fallback = 0): string {
  const v = n === undefined || Number.isNaN(n) ? fallback : n;
  return Number.isInteger(v) ? String(v) : String(v);
}

function line(parts: string[], comment: string | undefined, indent: string, last: boolean): string {
  const body = indent + parts.join('') + (last ? '' : ',');
  return comment ? `${body} // ${comment}` : body;
}

/**
 * Writes the config as JSONC in the same layout the GFL configs use. Comments describe which
 * entity each hammerid refers to so the file stays readable without the tool.
 */
export function serializeEntWatchConfig(config: EntWatchConfig, opts: SerializeOptions = {}): string {
  const ind = opts.indent ?? '    ';
  const comments = opts.comments ?? true;
  const describe = (hid: string): string | undefined => (comments && opts.describeHammerId ? opts.describeHammerId(hid) : undefined);
  const out: string[] = ['['];

  config.items.forEach((item, itemIndex) => {
    const lastItem = itemIndex === config.items.length - 1;
    const i1 = ind;
    const i2 = ind + ind;
    const i3 = ind + ind + ind;
    const i4 = ind + ind + ind + ind;
    out.push(`${i1}{`);
    out.push(`${i2}"name": ${q(item.name)},`);
    out.push(`${i2}"shortname": ${q(item.shortname || item.name)},`);
    out.push(line([`"hammerid": ${q(item.hammerid)}`], describe(item.hammerid), i2, false));
    out.push(`${i2}"message": ${item.message},`);
    out.push(`${i2}"ui": ${item.ui},`);
    if (item.transfer !== undefined) out.push(`${i2}"transfer": ${item.transfer},`);
    const hasTriggers = item.triggers.length > 0;
    const hasHandlers = item.handlers.length > 0;
    const hasTemplated = item.templated !== undefined;
    out.push(`${i2}"color": ${q(item.color)}${hasTriggers || hasHandlers || hasTemplated ? ',' : ''}`);
    if (hasTemplated) {
      out.push(`${i2}"templated": ${item.templated}${hasTriggers || hasHandlers ? ',' : ''}`);
    }
    if (hasTriggers) {
      const comments = item.triggers.map((t) => describe(t));
      if (comments.some((c) => c)) {
        out.push(`${i2}"triggers": [`);
        item.triggers.forEach((t, ti) => {
          out.push(line([q(t)], comments[ti], i3, ti === item.triggers.length - 1));
        });
        out.push(`${i2}]${hasHandlers ? ',' : ''}`);
      } else {
        // the GFL layout: "triggers": ["992"],
        out.push(`${i2}"triggers": [${item.triggers.map(q).join(', ')}]${hasHandlers ? ',' : ''}`);
      }
    }
    if (hasHandlers) {
      out.push(`${i2}"handlers": [`);
      item.handlers.forEach((h, hi) => {
        const lastHandler = hi === item.handlers.length - 1;
        out.push(`${i3}{`);
        const rows: { text: string; comment?: string }[] = [];
        if (h.name) rows.push({ text: `"name": ${q(h.name)}` });
        // event handlers are written without "type" like the GFL configs (CS2Fixes treats any
        // unknown/missing type as "other")
        if (h.type !== 'other') rows.push({ text: `"type": ${q(h.type)}` });
        rows.push({ text: `"hammerid": ${q(h.hammerid)}`, comment: describe(h.hammerid) });
        if (isPlainButton(h)) {
          if (h.templated !== undefined) rows.push({ text: `"templated": ${h.templated}` });
          rows.forEach((row, ri) => out.push(line([row.text], row.comment, i4, ri === rows.length - 1)));
          out.push(`${i3}}${lastHandler ? '' : ','}`);
          return;
        }
        // only what the mode reads, as the GFL configs write it: counters never carry an event or
        // maxuses (CS2Fixes takes OutValue and their min / max), mode 5 (a value) has no cooldown
        // and announces nothing, and modes without a cooldown / max uses write 0
        const counter = isCounterHandler(h);
        const eff = effectiveHandler(h);
        if (!counter && h.event) rows.push({ text: `"event": ${q(h.event)}` });
        rows.push({ text: `"mode": ${h.mode}` });
        if (counter && h.offset && (h.offset[0] !== 0 || h.offset[1] !== 0)) {
          rows.push({ text: `"offset": [${num(h.offset[0])}, ${num(h.offset[1])}]` });
        }
        if (h.mode !== 5) {
          rows.push({ text: `"cooldown": ${num(eff.cooldown)}` });
          if (!counter) rows.push({ text: `"maxuses": ${num(eff.maxuses)}` });
          rows.push({ text: `"message": ${eff.message}` });
        }
        rows.push({ text: `"ui": ${h.ui}` });
        if (h.templated !== undefined) rows.push({ text: `"templated": ${h.templated}` });
        rows.forEach((row, ri) => out.push(line([row.text], row.comment, i4, ri === rows.length - 1)));
        out.push(`${i3}}${lastHandler ? '' : ','}`);
      });
      out.push(`${i2}]`);
    }
    out.push(`${i1}}${lastItem ? '' : ','}`);
  });

  out.push(']');
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------
// Parsing (JSONC)
// ---------------------------------------------------------------------------------------------

/** Removes // and /* *\/ comments and trailing commas so JSON.parse accepts the text. */
export function stripJsonComments(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  let inString = false;
  while (i < n) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  // trailing commas
  return out.replace(/,(\s*[\]}])/g, '$1');
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function parseEntWatchConfig(text: string): { config: EntWatchConfig; warnings: string[] } {
  const warnings: string[] = [];
  const data = JSON.parse(stripJsonComments(text)) as unknown;
  const list: unknown[] = Array.isArray(data) ? data : typeof data === 'object' && data !== null ? Object.values(data) : [];
  const items: ItemConfig[] = [];
  list.forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null) return;
    const r = raw as Record<string, unknown>;
    if (r.hammerid === undefined) {
      warnings.push(`Item #${index + 1} has no hammerid and was skipped`);
      return;
    }
    if (typeof r.hammerid === 'number') warnings.push(`Item #${index + 1}: hammerid should be a string, converted`);
    const handlers: HandlerConfig[] = [];
    const rawHandlers = r.handlers;
    const handlerList: unknown[] = Array.isArray(rawHandlers)
      ? rawHandlers
      : typeof rawHandlers === 'object' && rawHandlers !== null
        ? Object.values(rawHandlers)
        : [];
    for (const hr of handlerList) {
      if (typeof hr !== 'object' || hr === null) continue;
      const h = hr as Record<string, unknown>;
      const typeRaw = asString(h.type, 'other').toLowerCase();
      const type: HandlerType = typeRaw === 'button' ? 'button' : typeRaw === 'counterup' ? 'counterup' : typeRaw === 'counterdown' ? 'counterdown' : 'other';
      let offset: [number, number] | undefined;
      if (Array.isArray(h.offset)) {
        offset = [asNumber(h.offset[0], 0), asNumber(h.offset[1], 0)];
      } else if (typeof h.offset === 'number') {
        offset = [h.offset, 0];
      }
      const modeRaw = asNumber(h.mode, 1);
      const mode = (modeRaw >= 0 && modeRaw <= 5 ? modeRaw : 1) as HandlerMode;
      handlers.push({
        uid: newUid('h'),
        name: typeof h.name === 'string' ? h.name : undefined,
        type,
        hammerid: asString(h.hammerid),
        event: typeof h.event === 'string' ? h.event : undefined,
        mode,
        cooldown: asNumber(h.cooldown, 0),
        maxuses: asNumber(h.maxuses, 0),
        offset,
        // CS2Fixes defaults both to false when the keys are absent
        message: asBool(h.message, false),
        ui: asBool(h.ui, false),
        templated: typeof h.templated === 'boolean' ? h.templated : undefined,
      });
    }
    const triggers = Array.isArray(r.triggers) ? r.triggers.map((t) => asString(t)).filter((t) => t.length > 0) : [];
    items.push({
      uid: newUid('i'),
      name: asString(r.name),
      shortname: asString(r.shortname, asString(r.name)),
      hammerid: asString(r.hammerid),
      message: asBool(r.message, true),
      ui: asBool(r.ui, true),
      transfer: typeof r.transfer === 'boolean' ? r.transfer : undefined,
      color: asString(r.color ?? r.colour, 'white'),
      triggers,
      templated: typeof r.templated === 'boolean' ? r.templated : undefined,
      handlers,
    });
  });
  return { config: { items }, warnings };
}
