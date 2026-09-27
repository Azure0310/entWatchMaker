import { friendlyName, type MapEntity } from './entity';
import type { EntityGraph } from './graph';
import type { EntWatchConfig } from './entwatch';

/**
 * Hammer ids only change when a mapper recreates entities, but when they do the config breaks.
 * CS2Fixes matches strictly on hammerid, so instead of name based configs the tool remembers
 * what each hammerid pointed at (classname + targetname) and re-resolves ids against a newer
 * map version.
 */

export interface EntityHint {
  classname?: string;
  targetname?: string;
}

export type HintMap = Map<string, EntityHint>;

/** Collects hints for every hammerid used by the config from the loaded map. */
export function hintsFromGraph(config: EntWatchConfig, graph: EntityGraph): HintMap {
  const hints: HintMap = new Map();
  const add = (hid: string) => {
    if (!hid || hints.has(hid)) return;
    const e = graph.byHammerId.get(hid)?.[0];
    if (e) hints.set(hid, { classname: e.classname, targetname: friendlyName(e.targetname) || undefined });
  };
  for (const item of config.items) {
    add(item.hammerid);
    for (const t of item.triggers) add(t);
    for (const h of item.handlers) add(h.hammerid);
  }
  return hints;
}

/**
 * Reads the `"hammerid": "123", // classname targetname` comments the serializer writes, so a
 * config file carries its own hints even without the original map.
 */
export function hintsFromJsonc(text: string): HintMap {
  const hints: HintMap = new Map();
  const re = /"(?:hammerid"\s*:\s*)?"?([0-9]+(?::[0-9]+)*)"\s*,?\s*\/\/\s*([A-Za-z_][\w]*)(?:\s+([^\s(][^(]*?))?\s*(?:\(templated\))?\s*$/gm;
  for (const m of text.matchAll(re)) {
    const [, hid, classname, name] = m;
    if (classname === 'NOT' || hints.has(hid)) continue;
    hints.set(hid, { classname: classname.toLowerCase(), targetname: name?.trim() || undefined });
  }
  return hints;
}

export interface RemapChange {
  from: string;
  to: string;
  entity: MapEntity;
  reason: string;
}

export interface RemapUnresolved {
  hammerid: string;
  hint: EntityHint | undefined;
  candidates: MapEntity[];
}

export interface RemapResult {
  config: EntWatchConfig;
  changes: RemapChange[];
  unresolved: RemapUnresolved[];
}

function stripTemplateSuffix(name: string): string {
  return name.replace(/_\d+$/, '');
}

function sameName(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const x = stripTemplateSuffix(friendlyName(a).toLowerCase());
  const y = stripTemplateSuffix(friendlyName(b).toLowerCase());
  return x === y;
}

/** Entities reachable from `root` within `depth` relation hops. */
function neighborhood(graph: EntityGraph, root: MapEntity, depth: number): MapEntity[] {
  const seen = new Set<number>([root.id]);
  let frontier = [root];
  const out: MapEntity[] = [];
  for (let d = 0; d < depth; d++) {
    const next: MapEntity[] = [];
    for (const e of frontier) {
      for (const rel of graph.relationsOf(e)) {
        if (seen.has(rel.other.id)) continue;
        seen.add(rel.other.id);
        out.push(rel.other);
        next.push(rel.other);
      }
    }
    frontier = next;
  }
  return out;
}

function resolveOne(graph: EntityGraph, hint: EntityHint | undefined, anchor: MapEntity | null): { chosen: MapEntity | null; candidates: MapEntity[]; reason: string } {
  if (!hint?.classname) return { chosen: null, candidates: [], reason: '' };
  const byClass = graph.entities.filter((e) => e.classname === hint.classname);
  if (hint.targetname) {
    const named = byClass.filter((e) => sameName(hint.targetname, e.targetname));
    if (named.length === 1) return { chosen: named[0], candidates: named, reason: 'classname + targetname' };
    if (named.length > 1 && anchor) {
      const near = neighborhood(graph, anchor, 3);
      const local = named.filter((e) => near.includes(e));
      if (local.length === 1) return { chosen: local[0], candidates: named, reason: 'targetname near the item weapon' };
    }
    if (named.length > 1) return { chosen: null, candidates: named, reason: '' };
  }
  // unnamed entity: look around the item's weapon
  if (anchor) {
    const near = neighborhood(graph, anchor, 2);
    const local = byClass.filter((e) => near.includes(e) && (!hint.targetname || !e.targetname));
    if (local.length === 1) return { chosen: local[0], candidates: local, reason: 'only entity of that class wired to the item weapon' };
    if (local.length > 1) return { chosen: null, candidates: local, reason: '' };
  }
  if (byClass.length === 1 && !hint.targetname) return { chosen: byClass[0], candidates: byClass, reason: 'only entity of that class in the map' };
  return { chosen: null, candidates: byClass.slice(0, 12), reason: '' };
}

/** True when the entity still looks like what the hint describes. */
export function hintMatches(hint: EntityHint | undefined, e: MapEntity): boolean {
  if (!hint?.classname) return true;
  if (hint.classname !== e.classname) return false;
  if (hint.targetname && !sameName(hint.targetname, e.targetname)) return false;
  return true;
}

/** Hammerids in the config that are missing from the map, or now point at a different entity. */
export function staleHammerIds(config: EntWatchConfig, graph: EntityGraph, hints: HintMap): string[] {
  const out = new Set<string>();
  const check = (hid: string) => {
    if (!hid) return;
    const e = graph.byHammerId.get(hid)?.[0];
    if (!e || !hintMatches(hints.get(hid), e)) out.add(hid);
  };
  for (const item of config.items) {
    check(item.hammerid);
    item.triggers.forEach(check);
    item.handlers.forEach((h) => check(h.hammerid));
  }
  return [...out];
}

/**
 * Replaces hammerids that no longer exist in `graph` (or now belong to a different entity)
 * using the hints. Items are resolved first so their weapon can anchor the search for unnamed
 * buttons / filters.
 */
export function remapConfig(config: EntWatchConfig, graph: EntityGraph, hints: HintMap): RemapResult {
  const changes: RemapChange[] = [];
  const unresolved: RemapUnresolved[] = [];
  const decided = new Map<string, string | null>();

  const resolve = (hid: string, anchor: MapEntity | null): string => {
    if (!hid) return hid;
    const existing = graph.byHammerId.get(hid)?.[0];
    const hint = hints.get(hid);
    if (existing && hintMatches(hint, existing)) return hid;
    if (decided.has(hid)) return decided.get(hid) ?? hid;
    const r = resolveOne(graph, hint, anchor);
    if (r.chosen) {
      decided.set(hid, r.chosen.hammerId);
      changes.push({ from: hid, to: r.chosen.hammerId, entity: r.chosen, reason: r.reason });
      return r.chosen.hammerId;
    }
    decided.set(hid, null);
    unresolved.push({ hammerid: hid, hint, candidates: r.candidates });
    return hid;
  };

  const items = config.items.map((item) => {
    const newWeaponId = resolve(item.hammerid, null);
    const anchor = graph.byHammerId.get(newWeaponId)?.[0] ?? null;
    return {
      ...item,
      hammerid: newWeaponId,
      triggers: item.triggers.map((t) => resolve(t, anchor)),
      handlers: item.handlers.map((h) => ({ ...h, hammerid: resolve(h.hammerid, anchor) })),
    };
  });
  return { config: { items }, changes, unresolved };
}

/** Replaces one hammerid everywhere in the config (used when the user picks a candidate). */
export function replaceHammerId(config: EntWatchConfig, from: string, to: string): EntWatchConfig {
  return {
    items: config.items.map((item) => ({
      ...item,
      hammerid: item.hammerid === from ? to : item.hammerid,
      triggers: item.triggers.map((t) => (t === from ? to : t)),
      handlers: item.handlers.map((h) => (h.hammerid === from ? { ...h, hammerid: to } : h)),
    })),
  };
}
