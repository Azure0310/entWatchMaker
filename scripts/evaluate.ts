/**
 * Runs the tool's suggestion for the weapons of every map it can load and compares the result
 * with the GFL EntWatch configs field by field.
 *
 *   npx tsx scripts/evaluate.ts <configs/entwatch dir> <map folder | workshop dir>... [--out dir]
 *
 * A folder without .vpk / .vmap files (e.g. steamapps/workshop/content/730) is expanded to its
 * sub folders. When a workshop package holds several maps, every map that has a config is
 * evaluated (the loader alone would only read the biggest one). Writes report.md, details.md and
 * results.json into --out (default: eval).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadLocalMap } from './loadLocal';
import { fileByteSource } from './nodeByteSource';
import { classifyVpkFileName, VpkArchive } from '../src/formats/vpk';
import { loadMapFromVpk } from '../src/model/loadMap';
import { EntityGraph } from '../src/model/graph';
import { friendlyName, type MapEntity, type ParsedMap } from '../src/model/entity';
import { parseEntWatchConfig, type HandlerConfig, type ItemConfig } from '../src/model/entwatch';
import { suggestItemForWeapon } from '../src/model/suggest';
import { isKnife } from '../src/model/triggers';
import { isHousekeepingInput } from '../src/model/roles';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : 'eval';
const positional = args.filter((a, i) => !a.startsWith('--') && (outIndex < 0 || i !== outIndex + 1));
const [configDir, ...targets] = positional;
if (!configDir || targets.length === 0) {
  console.error('usage: npx tsx scripts/evaluate.ts <configs/entwatch dir> <map folder | workshop dir>... [--out dir]');
  process.exit(2);
}

const configs = new Map<string, string>();
for (const f of readdirSync(configDir)) if (f.toLowerCase().endsWith('.jsonc')) configs.set(f.slice(0, -6).toLowerCase(), path.join(configDir, f));

const isMapFile = (f: string) => /\.(vpk|vmap)$/i.test(f);
const folders: string[] = [];
for (const t of targets) {
  if (!statSync(t).isDirectory() || readdirSync(t).some(isMapFile)) folders.push(t);
  else for (const d of readdirSync(t)) if (statSync(path.join(t, d)).isDirectory()) folders.push(path.join(t, d));
}

/**
 * Maps to evaluate in a folder: each nested maps/*.vpk that has a config, or else whatever the
 * loader picks. `loaderPick` is the nested map the loader would read on its own (the biggest).
 */
async function candidateMaps(folder: string): Promise<{ load: () => Promise<ParsedMap>; loaderPick?: string }[]> {
  const files = readdirSync(folder);
  const dirVpk = files.find((f) => f.toLowerCase().endsWith('.vpk') && classifyVpkFileName(f).kind !== 'archive');
  if (dirVpk) {
    try {
      const c = classifyVpkFileName(dirVpk);
      const archives = new Map<number, Awaited<ReturnType<typeof fileByteSource>>>();
      if (c.kind === 'dir') {
        for (const f of files) {
          const cf = classifyVpkFileName(f);
          if (cf.kind === 'archive' && cf.base === c.base) archives.set(cf.index, await fileByteSource(path.join(folder, f)));
        }
      }
      const outer = await VpkArchive.open(await fileByteSource(path.join(folder, dirVpk)), archives);
      const nested = outer.entries.filter((e) => e.ext === 'vpk' && e.length > 0 && e.dir.toLowerCase().startsWith('maps'));
      const loaderPick = [...nested].sort((a, b) => b.length - a.length)[0]?.name;
      const withConfig = nested.filter((e) => configs.has(e.name.toLowerCase()));
      if (withConfig.length > 0) return withConfig.map((e) => ({ load: () => loadMapFromVpk(outer.entrySource(e), new Map()), loaderPick }));
    } catch {
      // not a package we can look into; let the loader report it
    }
  }
  return [{ load: () => loadLocalMap(folder) }];
}

// ---- comparison model ---------------------------------------------------------------------------
interface HandlerView {
  type: string;
  event: string;
  mode: number;
  cooldown: number;
  maxuses: number;
  message: boolean;
  ui: boolean;
}
const FIELDS = ['type', 'event', 'mode', 'cooldown', 'maxuses', 'message', 'ui'] as const;
type Field = (typeof FIELDS)[number];
/** Fields that decide whether the item behaves the same; message/ui are display choices. */
const CORE: Field[] = ['type', 'event', 'mode', 'cooldown', 'maxuses'];

function view(h: HandlerConfig): HandlerView {
  const counter = h.type === 'counterup' || h.type === 'counterdown';
  return {
    type: h.type,
    // CS2Fixes forces OutValue for counters, so their event does not matter
    event: counter ? '' : (h.event ?? '').toLowerCase(),
    mode: h.mode,
    cooldown: h.cooldown ?? 0,
    maxuses: h.maxuses ?? 0,
    message: h.message,
    ui: h.ui,
  };
}
const same = (f: Field, a: HandlerView, b: HandlerView) => (f === 'cooldown' ? Math.abs(a.cooldown - b.cooldown) < 0.01 : a[f] === b[f]);

interface SetCmp {
  gfl: string[];
  tool: string[];
  matched: string[];
  missed: string[];
  extra: string[];
}
function compareSets(gfl: string[], tool: string[]): SetCmp {
  const g = [...new Set(gfl)];
  const t = [...new Set(tool)];
  return { gfl: g, tool: t, matched: g.filter((x) => t.includes(x)), missed: g.filter((x) => !t.includes(x)), extra: t.filter((x) => !g.includes(x)) };
}

interface ItemResult {
  name: string;
  hammerid: string;
  weapon: string | null;
  handlers: SetCmp;
  triggers: SetCmp;
  fieldDiffs: { hammerid: string; field: Field; gfl: string; tool: string }[];
  fieldChecks: Record<Field, { same: number; total: number }>;
  structural: boolean;
  exact: boolean;
  item: { name: boolean; color: boolean; transfer: boolean };
  /** What would differ in game (CS2Fixes) from the GFL config; empty = usable as is. */
  inGame: string[];
}

// ---- in-game equivalence --------------------------------------------------------------------------
/** `a` fires `b` through non-housekeeping inputs, directly or through one entity in between. */
function fires(graph: EntityGraph, a: MapEntity, b: MapEntity, hops = 2): boolean {
  let frontier = [a];
  const seen = new Set([a.id]);
  for (let d = 0; d < hops; d++) {
    const next: MapEntity[] = [];
    for (const x of frontier) {
      for (const c of x.connections) {
        if (isHousekeepingInput(c.input)) continue;
        for (const t of graph.connectionTargets(x, c)) {
          if (t.id === b.id) return true;
          if (!seen.has(t.id)) {
            seen.add(t.id);
            next.push(t);
          }
        }
      }
    }
    frontier = next;
  }
  return false;
}

const isCounterType = (h: HandlerConfig) => h.type === 'counterup' || h.type === 'counterdown';
/** CS2Fixes prints a use in chat when `message` is on, except for a counter in mode 5 (it only shows the value). */
const announces = (h: HandlerConfig) => h.message && !(isCounterType(h) && h.mode === 5);
/**
 * The cooldown CS2Fixes shows / waits for in the handler's mode. Up to 2 s it makes no difference
 * in game: the 1 s leeway lets every use message through and the HUD barely shows it.
 */
const shownCooldown = (h: HandlerConfig) => {
  const cd = [2, 3, 4].includes(h.mode) ? (h.cooldown ?? 0) : 0;
  return cd <= 2 ? 0 : cd;
};

/**
 * What would behave differently in CS2Fixes than the GFL config. Choices that only differ in
 * style are accepted: a plain +use hook plus the handler it fires counts like the button counted
 * on its own, and a filter handing the use on like the gate behind it (either way round). Checked:
 *   - every button GFL hooks is hooked (CS2Fixes blocks the +use of other players on them)
 *   - every GFL handler has a counterpart that fires on the same use; no other handlers (extra
 *     chat messages / HUD entries, or a map button only the holder could press)
 *   - uses GFL announces / shows on the HUD are announced / shown
 *   - the cooldown within 1 s (CS2Fixes' own leeway for use messages) and the same max uses, as far
 *     as the mode uses them (a counter's uses come from its min / max)
 *   - the same triggers (ebanned players cannot touch them). CS2Fixes hooks every hammerid in any
 *     item's "triggers", so a trigger listed under another item of the map is the same in game.
 * Returns "kind: hammerid" strings.
 */
function inGameProblems(graph: EntityGraph, cfg: ItemConfig, tool: ItemConfig, mapTriggers: { gfl: Set<string>; tool: Set<string> }): string[] {
  const problems: string[] = [];
  const get = (id: string) => graph.byHammerId.get(id)?.[0];
  /** Uses shown on the HUD: a counter's range, or maxuses in mode 3 / 4. */
  const shownUses = (h: HandlerConfig) => {
    if (isCounterType(h)) {
      const e = get(h.hammerid);
      const range = e ? parseFloat(e.props.max ?? '0') - parseFloat(e.props.min ?? '0') : NaN;
      return Number.isFinite(range) ? Math.round(range) : -1;
    }
    return [3, 4].includes(h.mode) ? (h.maxuses ?? 0) : 0;
  };
  const gIds = new Set(cfg.handlers.map((h) => h.hammerid));
  const used = new Set<string>();
  const pairs: [HandlerConfig, HandlerConfig][] = [];
  for (const h of cfg.handlers) {
    let t = tool.handlers.find((x) => x.hammerid === h.hammerid && !used.has(x.hammerid));
    if (!t) {
      const he = get(h.hammerid);
      t = tool.handlers.find((x) => {
        if (used.has(x.hammerid) || gIds.has(x.hammerid)) return false;
        const xe = get(x.hammerid);
        return !!he && !!xe && (fires(graph, he, xe) || fires(graph, xe, he));
      });
    }
    if (!t) {
      problems.push(`GFL handler has no counterpart: ${h.hammerid}`);
      continue;
    }
    used.add(t.hammerid);
    pairs.push([h, t]);
  }
  // the follow-up of a plain +use hook reports the use the GFL button handler reports
  const followUps = tool.handlers.filter((x) => {
    if (used.has(x.hammerid)) return false;
    const xe = get(x.hammerid);
    return pairs.some(([, t]) => {
      const te = get(t.hammerid);
      return t.type === 'button' && t.mode <= 1 && !!te && !!xe && fires(graph, te, xe);
    });
  });
  for (const x of tool.handlers) if (!used.has(x.hammerid) && !followUps.includes(x)) problems.push(`extra handler: ${x.hammerid}`);
  for (const h of cfg.handlers) {
    if (h.type === 'button' && !tool.handlers.some((x) => x.hammerid === h.hammerid && x.type === 'button')) problems.push(`button not hooked: ${h.hammerid}`);
  }
  for (const [h, t] of pairs) {
    // a plain +use hook leaves the message / HUD / numbers to the handlers its press fires
    const plain = t.type === 'button' && t.mode <= 1;
    const te = get(t.hammerid);
    const firedByT = plain && te ? tool.handlers.filter((x) => x !== t && get(x.hammerid) && fires(graph, te, get(x.hammerid)!)) : [];
    const carrier = plain && (h.mode > 1 || h.message || h.ui) ? (firedByT.find((x) => followUps.includes(x)) ?? firedByT[0] ?? t) : t;
    if (announces(h) && !announces(t) && !firedByT.some(announces)) problems.push(`use not announced: ${h.hammerid}`);
    if (h.ui && !t.ui && !firedByT.some((x) => x.ui)) problems.push(`not shown on the HUD: ${h.hammerid}`);
    const counters = isCounterType(h) && isCounterType(carrier);
    if (!counters && h.hammerid === carrier.hammerid && h.event && carrier.event && h.event.toLowerCase() !== carrier.event.toLowerCase()) problems.push(`event: ${h.hammerid}`);
    const gc = shownCooldown(h);
    const tc = shownCooldown(carrier);
    if (Math.abs(gc - tc) > 1) problems.push(`${gc === 0 ? 'cooldown not in GFL' : tc === 0 ? 'cooldown missing' : 'cooldown differs'}: ${h.hammerid}`);
    const gu = shownUses(h);
    const tu = shownUses(carrier);
    if (gu !== tu) problems.push(`${gu === 0 ? 'max uses not in GFL' : tu === 0 ? 'max uses missing' : 'max uses differ'}: ${h.hammerid}`);
  }
  const missed = cfg.triggers.filter((id) => !mapTriggers.tool.has(id));
  const extra = tool.triggers.filter((id) => !mapTriggers.gfl.has(id));
  if (missed.length > 0) problems.push(`trigger missed: ${missed.join(' ')}`);
  if (extra.length > 0) problems.push(`extra trigger: ${extra.join(' ')}`);
  return problems;
}
interface MapResult {
  folder: string;
  mapName: string;
  config: string;
  items: ItemResult[];
  extraWeapons: number;
  foundRatio: number;
  /** Set when the loader on its own would have read a different map of the package. */
  loaderPick?: string;
}

const describe = (graph: EntityGraph, hid: string) => {
  const e = graph.byHammerId.get(hid)?.[0];
  return e ? `${hid} ${e.classname} ${friendlyName(e.targetname) || '(unnamed)'}` : `${hid} (not in map)`;
};
const showView = (v: HandlerView) => `${v.type}${v.event ? ' ' + v.event : ''} m${v.mode} cd${v.cooldown} max${v.maxuses}`;

const weaponOf = (graph: EntityGraph, cfg: ItemConfig): MapEntity | undefined => {
  const list = graph.byHammerId.get(cfg.hammerid) ?? [];
  return list.find((e) => e.classname.startsWith('weapon_')) ?? list[0];
};

function evaluateItem(graph: EntityGraph, cfg: ItemConfig, tool: ItemConfig | null, mapTriggers: { gfl: Set<string>; tool: Set<string> }): ItemResult {
  const weapon = weaponOf(graph, cfg);
  const empty = Object.fromEntries(FIELDS.map((f) => [f, { same: 0, total: 0 }])) as ItemResult['fieldChecks'];
  if (!weapon || !tool) {
    return { name: cfg.name, hammerid: cfg.hammerid, weapon: null, handlers: compareSets(cfg.handlers.map((h) => h.hammerid), []), triggers: compareSets(cfg.triggers, []), fieldDiffs: [], fieldChecks: empty, structural: false, exact: false, item: { name: false, color: false, transfer: false }, inGame: ['weapon not in the map'] };
  }
  const handlers = compareSets(cfg.handlers.map((h) => h.hammerid), tool.handlers.map((h) => h.hammerid));
  const triggers = compareSets(cfg.triggers, tool.triggers);
  const fieldDiffs: ItemResult['fieldDiffs'] = [];
  for (const hid of handlers.matched) {
    const g = view(cfg.handlers.find((h) => h.hammerid === hid)!);
    const t = view(tool.handlers.find((h) => h.hammerid === hid)!);
    for (const f of FIELDS) {
      empty[f].total++;
      if (same(f, g, t)) empty[f].same++;
      else fieldDiffs.push({ hammerid: hid, field: f, gfl: String(g[f]), tool: String(t[f]) });
    }
  }
  const structural = handlers.missed.length === 0 && handlers.extra.length === 0 && triggers.missed.length === 0 && triggers.extra.length === 0;
  const exact = structural && !fieldDiffs.some((d) => CORE.includes(d.field));
  const knife = isKnife(weapon);
  return {
    name: cfg.name,
    hammerid: cfg.hammerid,
    weapon: `${weapon.classname} ${friendlyName(weapon.targetname) || '(unnamed)'}`,
    handlers,
    triggers,
    fieldDiffs,
    fieldChecks: empty,
    structural,
    exact,
    item: {
      name: cfg.name.trim().toLowerCase() === tool.name.trim().toLowerCase(),
      color: cfg.color.toLowerCase() === tool.color.toLowerCase(),
      // unset transfer means CS2Fixes' default: off for knives
      transfer: (cfg.transfer ?? !knife) === (tool.transfer ?? !knife),
    },
    inGame: inGameProblems(graph, cfg, tool, mapTriggers),
  };
}

// ---- run ------------------------------------------------------------------------------------------
const results: MapResult[] = [];
const skipped: { folder: string; reason: string }[] = [];
const details: string[] = [];
for (const folder of folders) {
  for (const candidate of await candidateMaps(folder)) {
    let map: ParsedMap;
    try {
      map = await candidate.load();
    } catch (err) {
      skipped.push({ folder, reason: `load failed: ${(err as Error).message.split('\n')[0]}` });
      continue;
    }
    evaluateMap(folder, map, candidate.loaderPick);
  }
}

function evaluateMap(folder: string, map: ParsedMap, loaderPick: string | undefined): void {
  if (map.stats.entities === 0) {
    skipped.push({ folder, reason: 'no entities' });
    return;
  }
  const configPath = configs.get(map.mapName.toLowerCase());
  if (!configPath) {
    skipped.push({ folder, reason: `no GFL config for ${map.mapName} (${map.stats.weapons} weapons)` });
    return;
  }
  let config;
  try {
    config = parseEntWatchConfig(readFileSync(configPath, 'utf8')).config;
  } catch (err) {
    skipped.push({ folder, reason: `config parse failed: ${(err as Error).message}` });
    return;
  }
  const graph = new EntityGraph(map.entities);
  const tools = config.items.map((it) => {
    const weapon = weaponOf(graph, it);
    return weapon ? suggestItemForWeapon(weapon, graph).item : null;
  });
  const mapTriggers = { gfl: new Set(config.items.flatMap((it) => it.triggers)), tool: new Set(tools.flatMap((t) => t?.triggers ?? [])) };
  const items = config.items.map((it, i) => evaluateItem(graph, it, tools[i], mapTriggers));
  const ids = config.items.flatMap((it) => [it.hammerid, ...it.handlers.map((h) => h.hammerid), ...it.triggers]);
  const foundRatio = ids.length ? ids.filter((id) => graph.byHammerId.has(id)).length / ids.length : 1;
  const covered = new Set(config.items.map((it) => it.hammerid));
  const extraWeapons = map.entities.filter((e) => e.classname.startsWith('weapon_') && !covered.has(e.hammerId)).length;
  const otherPick = loaderPick && loaderPick.toLowerCase() !== map.mapName.toLowerCase() ? loaderPick : undefined;
  results.push({ folder, mapName: map.mapName, config: path.basename(configPath), items, extraWeapons, foundRatio, loaderPick: otherPick });
  console.error(`${map.mapName}: ${items.filter((i) => i.exact).length}/${items.length} exact`);

  details.push(`## ${map.mapName} (${path.basename(folder)})`);
  for (const it of items) {
    if (it.exact && it.inGame.length === 0) continue;
    details.push(`- **${it.name}** #${it.hammerid} ${it.weapon ?? '(weapon NOT FOUND)'}${it.inGame.length === 0 ? ' — behaves the same in game' : ''}`);
    if (!it.weapon) continue;
    if (it.inGame.length > 0) details.push(`  - in game: ${it.inGame.join('; ')}`);
    for (const h of it.handlers.missed) details.push(`  - handler missed: ${describe(graph, h)}`);
    for (const h of it.handlers.extra) details.push(`  - handler extra: ${describe(graph, h)}`);
    for (const t of it.triggers.missed) details.push(`  - trigger missed: ${describe(graph, t)}`);
    for (const t of it.triggers.extra) details.push(`  - trigger extra: ${describe(graph, t)}`);
    const diffs = it.fieldDiffs.filter((d) => CORE.includes(d.field));
    for (const hid of [...new Set(diffs.map((d) => d.hammerid))]) {
      const g = config.items.find((c) => c.hammerid === it.hammerid)!.handlers.find((h) => h.hammerid === hid)!;
      details.push(`  - handler ${hid} fields: GFL \`${showView(view(g))}\` / tool: ${diffs.filter((d) => d.hammerid === hid).map((d) => `${d.field}=${d.tool}`).join(', ')}`);
    }
  }
  details.push('');
}

// ---- aggregate ------------------------------------------------------------------------------------
interface Totals {
  maps: number;
  items: number;
  found: number;
  exact: number;
  structural: number;
  hG: number;
  hT: number;
  hM: number;
  tG: number;
  tT: number;
  tM: number;
  fields: Record<Field, { same: number; total: number }>;
  name: number;
  color: number;
  transfer: number;
  extraWeapons: number;
  inGame: number;
  /** Items per kind of in-game difference ("cooldown missing: 123" -> "cooldown missing"). */
  problems: Map<string, number>;
}
const problemKind = (p: string) => p.split(':')[0].trim();
function totals(rs: MapResult[]): Totals {
  const t: Totals = { maps: rs.length, items: 0, found: 0, exact: 0, structural: 0, hG: 0, hT: 0, hM: 0, tG: 0, tT: 0, tM: 0, fields: Object.fromEntries(FIELDS.map((f) => [f, { same: 0, total: 0 }])) as Totals['fields'], name: 0, color: 0, transfer: 0, extraWeapons: 0, inGame: 0, problems: new Map() };
  for (const r of rs) {
    t.extraWeapons += r.extraWeapons;
    for (const it of r.items) {
      t.items++;
      if (!it.weapon) continue;
      t.found++;
      if (it.exact) t.exact++;
      if (it.structural) t.structural++;
      if (it.inGame.length === 0) t.inGame++;
      for (const k of new Set(it.inGame.map(problemKind))) t.problems.set(k, (t.problems.get(k) ?? 0) + 1);
      t.hG += it.handlers.gfl.length;
      t.hT += it.handlers.tool.length;
      t.hM += it.handlers.matched.length;
      t.tG += it.triggers.gfl.length;
      t.tT += it.triggers.tool.length;
      t.tM += it.triggers.matched.length;
      for (const f of FIELDS) {
        t.fields[f].same += it.fieldChecks[f].same;
        t.fields[f].total += it.fieldChecks[f].total;
      }
      if (it.item.name) t.name++;
      if (it.item.color) t.color++;
      if (it.item.transfer) t.transfer++;
    }
  }
  return t;
}
const pct = (a: number, b: number) => (b === 0 ? '-' : `${Math.round((100 * a) / b)}%`);
const frac = (a: number, b: number) => `${a}/${b} (${pct(a, b)})`;

const trusted = results.filter((r) => r.foundRatio >= 0.9);
const all = totals(results);
const ok = totals(trusted);
const out: string[] = [];
out.push('# EntWatch estimate vs GFL configs');
out.push('');
out.push(`maps evaluated: ${results.length} (config hammerids found ≥ 90%: ${trusted.length}), skipped folders: ${skipped.length}`);
out.push('');
out.push('| metric | all maps | maps with ≥ 90% ids found |');
out.push('| --- | --- | --- |');
const row = (label: string, f: (t: Totals) => string) => out.push(`| ${label} | ${f(all)} | ${f(ok)} |`);
row('items (weapon found / config items)', (t) => frac(t.found, t.items));
row('**items that behave like the config in game** (CS2Fixes; style differences allowed, cooldown ±1 s)', (t) => frac(t.inGame, t.found));
row('items identical (handlers, triggers, type/event/mode/cooldown/maxuses)', (t) => frac(t.exact, t.found));
row('items with the same handler and trigger ids', (t) => frac(t.structural, t.found));
row('handler recall (config handlers the tool proposes)', (t) => frac(t.hM, t.hG));
row('handler precision (tool handlers that are in the config)', (t) => frac(t.hM, t.hT));
row('trigger recall', (t) => frac(t.tM, t.tG));
row('trigger precision', (t) => frac(t.tM, t.tT));
for (const f of FIELDS) row(`matched handlers: same ${f}`, (t) => frac(t.fields[f].same, t.fields[f].total));
row('item name identical', (t) => frac(t.name, t.found));
row('item color identical', (t) => frac(t.color, t.found));
row('item transfer identical (unset = off for knives)', (t) => frac(t.transfer, t.found));
row('weapons not in the config (tool would add an item)', (t) => String(t.extraWeapons));
out.push('');
out.push('## What differs in game');
out.push('Items per kind of difference (an item can have several).');
out.push('');
out.push('| difference | items (all maps) | items (≥ 90% ids found) |');
out.push('| --- | --- | --- |');
for (const [k, n] of [...all.problems.entries()].sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} | ${ok.problems.get(k) ?? 0} |`);
out.push('');
out.push('## Per map');
out.push('| map | folder | ids found | in game | items exact | same ids | handlers recall | handlers precision | triggers recall | triggers precision | same event / mode / cooldown / maxuses |');
out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of [...results].sort((a, b) => a.mapName.localeCompare(b.mapName))) {
  const t = totals([r]);
  const fv = (f: Field) => pct(t.fields[f].same, t.fields[f].total);
  out.push(`| ${r.mapName} | ${path.basename(r.folder)} | ${pct(r.foundRatio, 1)} | ${t.inGame}/${t.found} | ${t.exact}/${t.found} | ${t.structural}/${t.found} | ${frac(t.hM, t.hG)} | ${frac(t.hM, t.hT)} | ${frac(t.tM, t.tG)} | ${frac(t.tM, t.tT)} | ${fv('event')} / ${fv('mode')} / ${fv('cooldown')} / ${fv('maxuses')} |`);
}
out.push('');
const misPicked = results.filter((r) => r.loaderPick);
if (misPicked.length) {
  out.push('## Packages where the loader reads another map');
  for (const r of misPicked) out.push(`- ${path.basename(r.folder)}: config map ${r.mapName}, the loader alone reads ${r.loaderPick} (biggest nested map)`);
  out.push('');
}
out.push('## Skipped folders');
for (const s of skipped) out.push(`- ${path.basename(s.folder)}: ${s.reason}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'report.md'), out.join('\n') + '\n');
writeFileSync(path.join(outDir, 'details.md'), '# Items that differ from the GFL config\n\n' + details.join('\n') + '\n');
writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ results, skipped }, null, 1));
console.error(`wrote ${path.join(outDir, 'report.md')}, details.md, results.json (${results.length} maps, ${skipped.length} skipped)`);
