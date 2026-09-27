import type { EntityGraph } from './graph';
import { friendlyName, type EntityConnection, type MapEntity } from './entity';

/**
 * Infers an item's cooldown from the map's I/O. Mappers usually implement cooldowns as
 *   button OnPressed -> button Lock, then Unlock with a delay      (or `wait` on the button)
 *   relay  OnTrigger -> relay Disable, then Enable with a delay
 * so the delay of the re-enabling input is the cooldown in seconds.
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
const USE_CLASSES = new Set(['func_button', 'func_rot_button', 'momentary_rot_button', 'func_physbox', 'func_physbox_multiplayer', 'func_physical_button', 'game_ui']);
const GATE_CLASSES = new Set(['logic_relay', 'logic_branch', 'logic_case', 'logic_compare', 'logic_timer', 'filter_activator_name', 'filter_activator_class', 'filter_multi', 'math_counter']);

function label(e: MapEntity): string {
  return friendlyName(e.targetname) || e.classname;
}

function isSelfTarget(c: EntityConnection, e: MapEntity): boolean {
  const t = c.target.toLowerCase();
  if (t === '!self') return true;
  return e.targetname.length > 0 && friendlyName(t) === friendlyName(e.targetname.toLowerCase());
}

/** Re-enabling inputs (Unlock/Enable/...) aimed at `e`, with their delays. */
function reenableDelays(graph: EntityGraph, e: MapEntity): CooldownGuess[] {
  const out: CooldownGuess[] = [];
  const consider = (from: MapEntity, c: EntityConnection) => {
    if (!REENABLE_INPUTS.has(c.input.toLowerCase()) || !(c.delay > 0)) return;
    out.push({ seconds: c.delay, reason: `${label(from)} ${c.output} → ${label(e)} ${c.input} (+${c.delay}s)`, entity: e });
  };
  for (const { from, connection } of graph.incomingConnections(e)) consider(from, connection);
  for (const c of e.connections) if (isSelfTarget(c, e)) consider(e, c);
  return out;
}

/** True when `e` itself is disabled/locked and re-enabled after a delay (a cooldown gate). */
export function hasSelfCooldown(graph: EntityGraph, e: MapEntity): boolean {
  return reenableDelays(graph, e).length > 0 && hasDisable(graph, e);
}

/** True when something also disables/locks `e` (so the re-enable really is a cooldown). */
function hasDisable(graph: EntityGraph, e: MapEntity): boolean {
  for (const { connection } of graph.incomingConnections(e)) if (DISABLE_INPUTS.has(connection.input.toLowerCase())) return true;
  for (const c of e.connections) if (isSelfTarget(c, e) && DISABLE_INPUTS.has(c.input.toLowerCase())) return true;
  return false;
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

  // 1. this entity is locked/disabled and re-enabled after a delay
  const own = reenableDelays(graph, e);
  if (own.length > 0 && (hasDisable(graph, e) || USE_CLASSES.has(e.classname))) {
    return best(own);
  }

  // 2. a button's `wait` (seconds before it can be pressed again); -1 = once only
  const wait = parseFloat(e.props.wait ?? '');
  const waitGuess: CooldownGuess | null =
    (e.classname === 'func_button' || e.classname === 'func_rot_button') && Number.isFinite(wait) && wait > 1
      ? { seconds: wait, reason: `${label(e)} wait = ${wait}`, entity: e }
      : null;

  const around: CooldownGuess[] = [];
  // 3. use-entities that fire into this one (button -> filter/relay)
  for (const { from } of graph.incomingConnections(e)) {
    if (USE_CLASSES.has(from.classname)) {
      const g = inferCooldown(graph, from, depth + 1, seen);
      if (g) around.push(g);
    }
  }
  // 4. gates this entity fires (filter -> relay that disables itself)
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind !== 'output') continue;
    const other = rel.other;
    if (GATE_CLASSES.has(other.classname) || USE_CLASSES.has(other.classname)) {
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
