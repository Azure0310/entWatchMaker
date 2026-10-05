import type { EntityGraph } from './graph';
import { friendlyName, type EntityConnection, type MapEntity } from './entity';
import { causedOutputs, hasUseOutput, HOOKABLE_TRIGGERS, isCounter, isFilter, isGate, isHousekeepingInput, isUseEntity, isUseLike } from './roles';

/**
 * Infers an item's cooldown from the map's I/O. Mappers usually implement cooldowns as
 *   button OnPressed -> button Lock, then Unlock with a delay      (or `wait` on the button)
 *   relay  OnTrigger -> relay Disable, then Enable with a delay
 *   branch OnFalse   -> branch SetValue 1, then SetValue 0 with a delay  (logic_branch / compare / counter)
 * so the delay of the re-enabling / resetting input is the cooldown in seconds.
 *
 * Only what the use itself sets off counts: the chain is followed from the press (and from the
 * handler's event) with the delays added up, and the cooldown is the time until the gates on that
 * path (the button, filter, relay, branch the use goes through) are open again. A zombie ability
 * that disables every item relay for 8 seconds, or a boss relay that re-arms an item branch, is
 * wiring of something else and is ignored.
 */

export interface CooldownGuess {
  seconds: number;
  /** Human readable evidence, e.g. "fire_filter OnPass → fire_button Unlock (45s after the use)". */
  reason: string;
  /** Which entity carries the evidence. */
  entity: MapEntity;
}

const REENABLE_INPUTS = new Set(['unlock', 'enable', 'open', 'unlockbutton', 'unlockuse']);
const DISABLE_INPUTS = new Set(['lock', 'disable', 'close', 'lockbutton', 'lockuse']);
/** Inputs that store a value on a gate; an immediate one plus a delayed one back is a cooldown. */
export const VALUE_INPUTS = new Set(['setvalue', 'setvaluenofire', 'setvaluecompare', 'setcomparevalue', 'setvaluetest']);
const VALUE_CLASSES = new Set(['logic_branch', 'logic_compare', 'math_counter']);
/**
 * Delays up to this long guard against double presses (a button's reset, a relay re-enabled right
 * away); the GFL configs write no cooldown for them (22 of 26 such handlers), and CS2Fixes gives a
 * 1 second leeway anyway.
 */
const ANTI_SPAM_SECONDS = 2;
/** func_button's default "Delay Before Reset" (base.fgd): a button left at it has no cooldown of its own. */
const DEFAULT_BUTTON_WAIT = 3;
const MAX_CHAIN_DEPTH = 6;

function label(e: MapEntity): string {
  return friendlyName(e.targetname) || e.classname;
}

function isSelfTarget(c: EntityConnection, e: MapEntity): boolean {
  const t = c.target.toLowerCase();
  if (t === '!self') return true;
  return e.targetname.length > 0 && friendlyName(t) === friendlyName(e.targetname).toLowerCase();
}

/** The entities a connection reaches, including `from` itself (the graph leaves out self links). */
function targetsOf(graph: EntityGraph, from: MapEntity, c: EntityConnection): MapEntity[] {
  const list = graph.connectionTargets(from, c);
  return isSelfTarget(c, from) && !list.includes(from) ? [...list, from] : list;
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

// ---- the chain a use sets off -------------------------------------------------------------------

interface Step {
  from: MapEntity;
  c: EntityConnection;
  /** Seconds after the use at which the input arrives (the delays along the chain added up). */
  t: number;
  targets: MapEntity[];
}

/**
 * Inputs that only store a value (SetValueCompare / SetValueTest store and fire, so they carry on),
 * and Activate: a game_ui fires its key outputs when the holder presses keys later, not right away.
 */
const STORE_INPUTS = new Set(['setvalue', 'setvaluenofire', 'setcomparevalue', 'sethitmax', 'sethitmin', 'setmaxvaluenofire', 'setminvaluenofire', 'activate']);

const COUNTER_LIMIT_OUTPUTS = /^on(hitmax|hitmin|changedfrommax|changedfrommin)$/i;

/** Arming inputs (Lock, SetValue, ...) and housekeeping stop a chain; Trigger / Test / Add carry it on. */
function carriesOn(input: string): boolean {
  return !isHousekeepingInput(input) && !STORE_INPUTS.has(input.toLowerCase());
}

/** Everything `starts` set off when they fire an output matching `first`, in time order of arrival. */
function useTimeline(graph: EntityGraph, starts: { e: MapEntity; first: (output: string) => boolean }[]): Step[] {
  const steps: Step[] = [];
  const queue = starts.map((s) => ({ e: s.e, ok: s.first, t: 0, depth: 0 }));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const { e, ok, t, depth } = queue.shift()!;
    for (const c of e.connections) {
      if (!ok(c.output)) continue;
      const at = t + (c.delay > 0 ? c.delay : 0);
      const targets = targetsOf(graph, e, c);
      steps.push({ from: e, c, t: at, targets });
      if (depth >= MAX_CHAIN_DEPTH) continue;
      // enabling a logic_timer fires its OnTimer one refire time later (a timer that unlocks the button)
      if (c.input.toLowerCase() === 'enable') {
        for (const x of targets) {
          const refire = x.classname === 'logic_timer' && x.props.userandomtime !== '1' ? parseFloat(x.props.refiretime ?? '') : NaN;
          if (!(refire > 0) || seen.has(`${x.id}|timer`)) continue;
          seen.add(`${x.id}|timer`);
          queue.push({ e: x, ok: (o) => /^ontimer$/i.test(o), t: at + refire, depth: depth + 1 });
        }
      }
      if (!carriesOn(c.input)) continue;
      for (const x of targets) {
        const key = `${x.id}|${c.input.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const caused = causedOutputs(c.input) ?? (() => true);
        // a counter's OnHitMax / OnHitMin fire after several uses (an overheat, the last charge),
        // not on this one: its OutValue / OnGetValue do
        const next = isCounter(x) ? (o: string) => caused(o) && !COUNTER_LIMIT_OUTPUTS.test(o) : caused;
        queue.push({ e: x, ok: next, t: at, depth: depth + 1 });
      }
    }
  }
  return steps;
}

/**
 * The use path in front of `e`: the use entities (buttons, game_ui, touch triggers) feeding it
 * through carrying inputs up to 3 hops back, with the output that leads on to `e`, and the entities
 * between them and `e`. A feeder no press leads through (a boss relay that also tests the item's
 * filter) is not part of it.
 */
function inFront(graph: EntityGraph, e: MapEntity): { ids: Set<number>; roots: { root: MapEntity; output: string }[] } {
  const roots: { root: MapEntity; output: string }[] = [];
  /** entity id -> the entities (closer to `e`) it feeds */
  const feeds = new Map<number, Set<number>>();
  const seen = new Set<number>([e.id]);
  let frontier = [e];
  for (let d = 0; d < 3 && frontier.length > 0; d++) {
    const next: MapEntity[] = [];
    for (const x of frontier) {
      for (const { from, connection } of graph.incomingConnections(x)) {
        if (!carriesOn(connection.input) || from.id === e.id) continue;
        let fed = feeds.get(from.id);
        if (!fed) feeds.set(from.id, (fed = new Set()));
        fed.add(x.id);
        if (isUseLike(from)) {
          if (!roots.some((r) => r.root.id === from.id && r.output === connection.output)) roots.push({ root: from, output: connection.output });
        } else if (!seen.has(from.id)) {
          seen.add(from.id);
          next.push(from);
        }
      }
    }
    frontier = next;
  }
  const ids = new Set<number>();
  const stack = roots.map((r) => r.root.id);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === e.id || ids.has(id)) continue;
    ids.add(id);
    for (const t of feeds.get(id) ?? []) stack.push(t);
  }
  return { ids, roots };
}

/**
 * Entities that can hold a use back: +use entities, relays / branches / cases, filters. Counters and
 * touch triggers only in front of the handler; further on a counter is a boss's health or a score
 * and a trigger an effect zone. A logic_timer never holds a press back (it repeats an effect).
 */
function canGate(e: MapEntity, inFrontOfHandler: boolean): boolean {
  if (e.classname === 'logic_timer') return false;
  if (isUseEntity(e) || isGate(e) || isFilter(e)) return true;
  return inFrontOfHandler && (isCounter(e) || HOOKABLE_TRIGGERS.has(e.classname));
}

interface GateEvents {
  gate: MapEntity;
  /** When the use locks / disables / arms it. */
  closes: number[];
  /** When the use unlocks / enables / resets it, with the evidence. */
  opens: { t: number; reason: string }[];
  /** Locked and unlocked (Lock / Disable, Unlock / Enable), not only a stored value changed. */
  locked: boolean;
}

/** Closings and reopenings of everything the steps reach, per entity. */
function gateEvents(steps: Step[]): Map<number, GateEvents> {
  const map = new Map<number, GateEvents>();
  const of = (x: MapEntity) => {
    let g = map.get(x.id);
    if (!g) map.set(x.id, (g = { gate: x, closes: [], opens: [], locked: false }));
    return g;
  };
  for (const s of steps) {
    const input = s.c.input.toLowerCase();
    for (const x of s.targets) {
      const why = (extra = '') => `${label(s.from)} ${s.c.output} → ${label(x)} ${s.c.input}${extra} (${round(s.t)}s after the use)`;
      if (DISABLE_INPUTS.has(input)) {
        of(x).closes.push(s.t);
        of(x).locked = true;
      } else if (REENABLE_INPUTS.has(input)) of(x).opens.push({ t: s.t, reason: why() });
      else if (VALUE_INPUTS.has(input) && VALUE_CLASSES.has(x.classname)) {
        // "SetValue 1" now and "SetValue 0" later: armed until the delayed reset
        const armed = steps.find((o) => o.t < s.t && VALUE_INPUTS.has(o.c.input.toLowerCase()) && o.c.param !== s.c.param && o.targets.includes(x));
        if (armed) {
          of(x).closes.push(armed.t);
          of(x).opens.push({ t: s.t, reason: why(` ${s.c.param || '""'}`) });
        }
      }
    }
  }
  return map;
}

/**
 * When a gate is open again for good: the first reopening after its last closing that is longer
 * than the anti-spam guard. 'closed' when the use closes it and nothing in the chain reopens it.
 */
function reopening(ev: GateEvents | undefined, closedByItself: boolean): { t: number; reason: string } | 'closed' | null {
  const lastClose = ev && ev.closes.length > 0 ? Math.max(...ev.closes) : closedByItself ? 0 : null;
  if (lastClose === null) return null;
  const after = (ev?.opens ?? []).filter((o) => o.t >= lastClose).sort((a, b) => a.t - b.t);
  if (after.length === 0) return ev && ev.closes.length > 0 ? 'closed' : null;
  return after.find((o) => o.t > ANTI_SPAM_SECONDS) ?? null;
}

/** Outputs to follow for `e` when the handler event is not known. */
function defaultUseOutputs(e: MapEntity): (output: string) => boolean {
  if (/button/.test(e.classname)) return (o) => /^on(pressed|in)$/i.test(o);
  if (isUseEntity(e)) return (o) => /^(onplayeruse|ondamaged|pressed|oncase\d\d)/i.test(o);
  if (isFilter(e)) return (o) => /^onpass$/i.test(o);
  if (e.classname === 'logic_relay') return (o) => /^ontrigger$/i.test(o);
  if (e.classname === 'logic_branch') return (o) => /^on(true|false)$/i.test(o);
  return () => true;
}

/** func_button `wait` above the default: the button cannot be pressed again for that long. */
function buttonWait(e: MapEntity): number | null {
  if (e.classname !== 'func_button' && e.classname !== 'func_rot_button') return null;
  const wait = parseFloat(e.props.wait ?? '');
  return Number.isFinite(wait) && wait > DEFAULT_BUTTON_WAIT ? wait : null;
}

const round = (s: number) => (Math.abs(s - Math.round(s)) <= 0.05 ? Math.round(s) : Math.round(s * 100) / 100);

/**
 * Infers the cooldown of handler `e` (firing `event` when known). Returns the time until every gate
 * the use goes through is open again, or null when the use locks nothing (or only for a moment).
 */
export function inferCooldown(graph: EntityGraph, e: MapEntity, event?: string): CooldownGuess | null {
  const front = inFront(graph, e);
  const isFront = (x: MapEntity) => x.id === e.id || front.ids.has(x.id);
  const own = { e, first: event ? (o: string) => o.toLowerCase() === event.toLowerCase() : defaultUseOutputs(e) };
  const fromRoots = front.roots.map((r) => ({ e: r.root, first: (o: string) => o.toLowerCase() === r.output.toLowerCase() }));
  // a button that resets slower than the default is held back for its `wait`
  const waits: CooldownGuess[] = [];
  for (const r of [e, ...front.roots.map((x) => x.root)]) {
    const wait = buttonWait(r);
    if (wait !== null) waits.push({ seconds: wait, reason: `${label(r)} wait = ${wait}`, entity: r });
  }

  // a button that fires nothing itself is locked and unlocked by what the key press fires elsewhere
  // (ze_santassination_p: the game_ui's relay locks the button for the cooldown)
  const lockers: typeof fromRoots = [];
  if (isUseEntity(e) && !hasUseOutput(e)) {
    for (const { from, connection } of graph.incomingConnections(e)) {
      if (DISABLE_INPUTS.has(connection.input.toLowerCase()) && !lockers.some((l) => l.e.id === from.id)) {
        lockers.push({ e: from, first: (o: string) => o.toLowerCase() === connection.output.toLowerCase() });
      }
    }
  }

  // First what the handler's own event sets off, then with the press in front of it as well (the
  // same press may also fire other abilities, whose resets are not this handler's cooldown), then
  // what locks a button that fires nothing.
  let stillClosed: MapEntity[] = [];
  for (const starts of [[own], [own, ...fromRoots], ...(lockers.length > 0 ? [lockers] : [])]) {
    const steps = useTimeline(graph, starts);
    // the use path: e, what feeds it, and whatever the chain carries on to
    const path = new Set<number>([e.id, ...front.ids]);
    for (const s of steps) if (carriesOn(s.c.input)) for (const x of s.targets) path.add(x.id);
    const events = gateEvents(steps);
    const found: CooldownGuess[] = [...waits];
    stillClosed = [];
    const gates = new Map<number, MapEntity>();
    for (const id of path) {
      const x = graph.byId.get(id);
      if (x) gates.set(id, x);
    }
    // off the path, something the use both locks and unlocks: a button the game_ui locks, a combo
    // relay the ultimate disables (not a boss branch it only arms)
    const lockedOffPath = (ev: GateEvents | undefined) => !!ev && ev.locked && ev.opens.length > 0;
    for (const ev of events.values()) if (lockedOffPath(ev)) gates.set(ev.gate.id, ev.gate);
    for (const x of gates.values()) {
      const onPath = path.has(x.id);
      if (!canGate(x, isFront(x))) continue;
      const ev = events.get(x.id);
      if (!onPath && !lockedOffPath(ev)) continue;
      // buttons also lock themselves (spawnflags, wait -1), so a delayed Unlock counts on its own
      const r = reopening(ev, onPath && isUseEntity(x));
      if (r === 'closed') {
        if (isFront(x) || isUseEntity(x)) stillClosed.push(x);
      } else if (r) found.push({ seconds: r.t, reason: r.reason, entity: x });
    }
    if (found.length === 0) continue;
    // the item is ready when every gate is open: the latest reopening, preferring the gates the
    // use goes through before the handler (a relay further on may be reset by another ability too)
    const pool = found.some((g) => isFront(g.entity)) ? found.filter((g) => isFront(g.entity)) : found;
    const best = pool.reduce((a, b) => (b.seconds > a.seconds ? b : a));
    return { ...best, seconds: round(best.seconds) };
  }
  // the use locks the button (or a gate in front) and something else opens it again: a minigame
  // that ends, a respawned item. The delay of that reopening is the best guess.
  const elsewhere = stillClosed
    .flatMap((x) => [...reenableDelays(graph, x), ...valueResetDelays(graph, x)])
    .filter((g) => g.seconds > ANTI_SPAM_SECONDS);
  if (elsewhere.length === 0) return null;
  const best = elsewhere.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  return { ...best, seconds: round(best.seconds), reason: `${best.reason}; the use locks it and other wiring opens it again` };
}

/** Outcomes of a choice (a case, a branch, a compare, a filter that fails): they happen only sometimes. */
const CHOICE_OUTPUTS = /^(oncase\d+|ondefault|ontrue|onfalse|onequalto|onnotequalto|onlessthan|ongreaterthan|onfail)$/i;
/** Seconds within which a single-use item kills or locks itself: with its effect, not at the end of a stage. */
const USED_UP_WITHIN = 15;

/**
 * Single use: with the use (within 15 s, not through another entity's choice), the use kills
 * the handler or the button it hangs on, or locks / disables it and nothing in the map opens it
 * again (no Unlock / Enable / Toggle anywhere). The GFL configs write such items as mode 3 with
 * maxuses 1 (ze_zertinan summons: the filter locks the button; ze_steyliff_grove elixirs: the
 * button kills itself). A stage button or relay in front of the handler that later kills itself,
 * or a random case that sometimes kills the button (Mimic Materia), is not.
 */
export function usedUp(graph: EntityGraph, e: MapEntity, event?: string): { reason: string } | null {
  const front = inFront(graph, e);
  const own = { e, first: event ? (o: string) => o.toLowerCase() === event.toLowerCase() : defaultUseOutputs(e) };
  const fromRoots = front.roots.map((r) => ({ e: r.root, first: (o: string) => o.toLowerCase() === r.output.toLowerCase() }));
  const buttons = new Set([e.id, ...front.roots.filter((r) => isUseEntity(r.root)).map((r) => r.root.id)]);
  const steps = useTimeline(graph, [own, ...fromRoots]);
  /** Part of every use, right away: not a later effect, not another entity's choice. */
  const rightAway = (s: Step) => s.t <= USED_UP_WITHIN && (s.from.id === e.id || !CHOICE_OUTPUTS.test(s.c.output));
  for (const s of steps) {
    if (!rightAway(s) || !/^kill(hierarchy)?$/i.test(s.c.input)) continue;
    const x = s.targets.find((t) => buttons.has(t.id));
    if (x) return { reason: `${label(s.from)} ${s.c.output} → ${label(x)} ${s.c.input} (${round(s.t)}s after the use)` };
  }
  for (const ev of gateEvents(steps).values()) {
    const x = ev.gate;
    if (!buttons.has(x.id) || !ev.locked || reopening(ev, false) !== 'closed') continue;
    // an Unlock that can fire only once (the pickup trigger_once, an "only once" output) arms the item before its use
    const reopens = graph.incomingConnections(x).filter(({ from, connection }) => (REENABLE_INPUTS.has(connection.input.toLowerCase()) || /^toggle/i.test(connection.input)) && from.classname !== 'trigger_once' && connection.timesToFire !== 1);
    if (reopens.length > 0) continue;
    const s = steps.find((st) => rightAway(st) && st.targets.includes(x) && DISABLE_INPUTS.has(st.c.input.toLowerCase()));
    if (s) return { reason: `${label(s.from)} ${s.c.output} → ${label(x)} ${s.c.input}, and nothing opens it again` };
  }
  return null;
}

// ---- counters ------------------------------------------------------------------------------------

export interface CounterUse {
  type: 'counterup' | 'counterdown';
  /** Set when reaching the limit locks the item for a while (CS2Fixes mode 4, CooldownAfterUses). */
  afterUses: CooldownGuess | null;
  /** Evidence, e.g. "fire_filter OnPass → Subtract 1 per use". */
  reason: string;
}

/** The step an Add / Subtract makes (+n / -n), or null for other inputs. */
function stepOf(c: EntityConnection): number | null {
  const input = c.input.toLowerCase();
  if (input !== 'add' && input !== 'subtract') return null;
  const n = c.param.trim() === '' ? 1 : parseFloat(c.param);
  if (!Number.isFinite(n)) return null;
  return input === 'add' ? n : -n;
}

/**
 * Whether a math_counter counts the item's uses: the item's use chain (what a button / game_ui
 * fires) steps it by one per use, nothing drives it over time (a logic_timer, a loop of its own),
 * and the source does not take the step back later (a combo meter that drops again). CS2Fixes
 * announces the uses of such a counter in mode 3 (MaxUses); a counter that holds a charge or an
 * amount is a value (mode 5), and CS2Fixes never prints its uses. On the evaluated maps this
 * matches 57 of the 58 counters GFL writes in mode 3 / 4 and all 22 it writes in mode 5.
 */
export function counterUse(graph: EntityGraph, counter: MapEntity): CounterUse | null {
  if (!isCounter(counter)) return null;
  const incoming = aimedAt(graph, counter);
  const changes = (c: EntityConnection) => stepOf(c) !== null || VALUE_INPUTS.has(c.input.toLowerCase());
  if (incoming.some(({ from, c }) => from.classname === 'logic_timer' && changes(c))) return null;
  if (incoming.some(({ from, c }) => from.id === counter.id && stepOf(c) !== null)) return null;
  const steps = incoming.filter(({ from, c }) => from.id !== counter.id && stepOf(c) !== null);
  if (steps.length === 0) return null;
  // the use: steps from what a button / game_ui leads to (a stage relay refilling it is not one)
  const pressed = (x: MapEntity) => isUseEntity(x) || inFront(graph, x).roots.some((r) => isUseEntity(r.root));
  const touched = (x: MapEntity) => isUseLike(x) || inFront(graph, x).roots.length > 0;
  const byPress = steps.filter(({ from }) => pressed(from));
  const byTouch = steps.filter(({ from }) => touched(from));
  const pool = byPress.length > 0 ? byPress : byTouch.length > 0 ? byTouch : steps;
  const takesBack = (from: MapEntity) => {
    const signs = steps.filter((s) => s.from.id === from.id).map((s) => Math.sign(stepOf(s.c)!));
    return signs.includes(1) && signs.includes(-1);
  };
  const counted = pool.filter(({ from }) => !takesBack(from));
  if (counted.length === 0) return null;
  const values = counted.map(({ c }) => stepOf(c)!);
  if (!values.every((v) => Math.abs(v) === 1)) return null;
  if (!values.every((v) => v > 0) && !values.every((v) => v < 0)) return null;
  const type = values[0] > 0 ? 'counterup' : 'counterdown';
  const first = counted[0];
  return {
    type,
    afterUses: cooldownAfterUses(graph, counter, type),
    reason: `${label(first.from)} ${first.c.output} → ${first.c.input} ${first.c.param || '1'} per use`,
  };
}

/**
 * Mode 4 (CooldownAfterUses): reaching the limit (OnHitMax counting up, OnHitMin counting down)
 * locks the item, and a delayed Unlock / Enable or a reset of the counter frees it again.
 */
function cooldownAfterUses(graph: EntityGraph, counter: MapEntity, type: CounterUse['type']): CooldownGuess | null {
  const limit = type === 'counterup' ? 'OnHitMax' : 'OnHitMin';
  const steps = useTimeline(graph, [{ e: counter, first: (o) => o.toLowerCase() === limit.toLowerCase() }]);
  const events = gateEvents(steps);
  const found: CooldownGuess[] = [];
  for (const s of steps) {
    if (!(s.t > ANTI_SPAM_SECONDS)) continue;
    const input = s.c.input.toLowerCase();
    for (const x of s.targets) {
      const reset = x.id === counter.id && (VALUE_INPUTS.has(input) || stepOf(s.c) !== null);
      const reopened = REENABLE_INPUTS.has(input) && canGate(x, true) && (events.get(x.id)?.closes.some((t) => t <= s.t) ?? false);
      if (!reset && !reopened) continue;
      const reason = `${label(counter)} ${limit} → … ${label(s.from)} ${s.c.output} → ${label(x)} ${s.c.input}${s.c.param ? ' ' + s.c.param : ''} (${round(s.t)}s after the last use)`;
      found.push({ seconds: s.t, reason, entity: x });
    }
  }
  if (found.length === 0) return null;
  const best = found.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  return { ...best, seconds: round(best.seconds) };
}
