import type { EntityGraph } from './graph';
import { friendlyName, type EntityConnection, type MapEntity } from './entity';
import { isFilter, isGate, isUseEntity } from './roles';

/**
 * Infers an item's cooldown from the map's I/O. Mappers usually implement cooldowns as
 *   button OnPressed -> button Lock, then Unlock with a delay      (or `wait` on the button)
 *   relay  OnTrigger -> relay Disable, then Enable with a delay
 *   branch OnFalse   -> branch SetValue 1, then SetValue 0 with a delay  (logic_branch / compare / counter)
 * so the delay of the re-enabling / resetting input is the cooldown in seconds.
 */

export interface CooldownGuess {
  seconds: number;
  /** Human readable evidence, e.g. "fire_filter OnPass → fire_button Unlock (+45s)". */
  reason: string;
  /** Which entity carries the evidence. */
  entity: MapEntity;
}

const REENABLE_INPUTS = new Set(['unlock', 'enable', 'open', 'unlockbutton', 'unlockuse']);
const DISABLE_INPUTS = new Set(['lock', 'disable', 'close', 'lockbutton', 'lockuse']);
/** Inputs that store a value on a gate; an immediate one plus a delayed one back is a cooldown. */
export const VALUE_INPUTS = new Set(['setvalue', 'setvaluenofire', 'setvaluecompare', 'setcomparevalue', 'setvaluetest']);
const VALUE_CLASSES = new Set(['logic_branch', 'logic_compare', 'math_counter']);

function label(e: MapEntity): string {
  return friendlyName(e.targetname) || e.classname;
}

function isSelfTarget(c: EntityConnection, e: MapEntity): boolean {
  const t = c.target.toLowerCase();
  if (t === '!self') return true;
  return e.targetname.length > 0 && friendlyName(t) === friendlyName(e.targetname).toLowerCase();
}

/** Every connection aimed at `e` (from other entities, or from itself via !self / its own name). */
function aimedAt(graph: EntityGraph, e: MapEntity): { from: MapEntity; c: EntityConnection }[] {
  const out = graph.incomingConnections(e).map(({ from, connection }) => ({ from, c: connection }));
  for (const c of e.connections) if (isSelfTarget(c, e) && !out.some((x) => x.c === c)) out.push({ from: e, c });
  return out;
}

/** Re-enabling inputs (Unlock/Enable/...) aimed at `e`, with their delays. */
function reenableDelays(graph: EntityGraph, e: MapEntity): CooldownGuess[] {
  const out: CooldownGuess[] = [];
  for (const { from, c } of aimedAt(graph, e)) {
    if (!REENABLE_INPUTS.has(c.input.toLowerCase()) || !(c.delay > 0)) continue;
    out.push({ seconds: c.delay, reason: `${label(from)} ${c.output} → ${label(e)} ${c.input} (+${c.delay}s)`, entity: e });
  }
  return out;
}

/**
 * "SetValue 1" now and "SetValue 0" after a delay (from the same output) on a branch / compare /
 * counter: the gate refuses the next use until the delayed reset, i.e. a cooldown.
 */
function valueResetDelays(graph: EntityGraph, e: MapEntity): CooldownGuess[] {
  if (!VALUE_CLASSES.has(e.classname)) return [];
  const groups = new Map<string, { from: MapEntity; c: EntityConnection }[]>();
  for (const x of aimedAt(graph, e)) {
    if (!VALUE_INPUTS.has(x.c.input.toLowerCase())) continue;
    const key = `${x.from.id}|${x.c.output.toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(x);
    else groups.set(key, [x]);
  }
  const out: CooldownGuess[] = [];
  for (const list of groups.values()) {
    const immediate = list.filter((x) => !(x.c.delay > 0));
    const delayed = list.filter((x) => x.c.delay > 0);
    for (const d of delayed) {
      const pair = immediate.find((i) => i.c.param !== d.c.param);
      if (!pair) continue;
      out.push({
        seconds: d.c.delay,
        reason: `${label(d.from)} ${d.c.output} → ${label(e)} ${pair.c.input} ${pair.c.param || '""'} then ${d.c.input} ${d.c.param || '""'} (+${d.c.delay}s)`,
        entity: e,
      });
    }
  }
  return out;
}

/** True when `e` itself is disabled/locked and re-enabled after a delay (a cooldown gate). */
export function hasSelfCooldown(graph: EntityGraph, e: MapEntity): boolean {
  if (valueResetDelays(graph, e).length > 0) return true;
  return reenableDelays(graph, e).length > 0 && hasDisable(graph, e);
}

/** True when something also disables/locks `e` (so the re-enable really is a cooldown). */
function hasDisable(graph: EntityGraph, e: MapEntity): boolean {
  return aimedAt(graph, e).some(({ c }) => DISABLE_INPUTS.has(c.input.toLowerCase()));
}

function best(list: CooldownGuess[]): CooldownGuess | null {
  if (list.length === 0) return null;
  return list.reduce((a, b) => (b.seconds > a.seconds ? b : a));
}

/**
 * Looks at the entity itself, then at the use-entities feeding it and the gates it fires,
 * one hop each way. Returns the most plausible cooldown or null.
 */
export function inferCooldown(graph: EntityGraph, e: MapEntity, depth = 0, seen = new Set<number>()): CooldownGuess | null {
  if (seen.has(e.id) || depth > 2) return null;
  seen.add(e.id);

  // 1. this entity is locked/disabled/armed and re-enabled/reset after a delay
  const own = [...reenableDelays(graph, e), ...valueResetDelays(graph, e)];
  if (own.length > 0 && (hasDisable(graph, e) || isUseEntity(e) || valueResetDelays(graph, e).length > 0)) {
    return best(own);
  }

  // 2. a button's `wait` (seconds before it can be pressed again); -1 = once only
  const wait = parseFloat(e.props.wait ?? '');
  const waitGuess: CooldownGuess | null =
    (e.classname === 'func_button' || e.classname === 'func_rot_button') && Number.isFinite(wait) && wait > 1
      ? { seconds: wait, reason: `${label(e)} wait = ${wait}`, entity: e }
      : null;

  const around: CooldownGuess[] = [];
  // 3. use-entities that fire into this one (button -> filter/relay), and the filter in front of a
  //    relay handler (button -> filter -> relay, where the filter locks / unlocks the button)
  for (const { from } of graph.incomingConnections(e)) {
    if (isUseEntity(from) || (isFilter(from) && !isFilter(e))) {
      const g = inferCooldown(graph, from, depth + 1, seen);
      if (g) around.push(g);
    }
  }
  // 4. gates this entity fires (filter -> relay that disables itself)
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind !== 'output') continue;
    const other = rel.other;
    if (isGate(other) || isFilter(other) || other.classname === 'math_counter' || isUseEntity(other)) {
      const g = inferCooldown(graph, other, depth + 1, seen);
      if (g) around.push(g);
    }
  }
  // 5. children parented to this entity that are re-enabled with a delay (triggers/hurts)
  if (depth === 0) {
    for (const rel of graph.relationsOf(e)) {
      if (rel.kind === 'child' && hasDisable(graph, rel.other)) around.push(...reenableDelays(graph, rel.other));
    }
  }

  const b = best(around);
  if (b && (!waitGuess || b.seconds >= waitGuess.seconds)) return b;
  if (waitGuess) return waitGuess;
  return own.length > 0 ? best(own) : null;
}
