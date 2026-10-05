import type { EntityGraph } from './graph';
import { friendlyName, type EntityConnection, type MapEntity } from './entity';
import { KNOWN_OUTPUTS } from './suggest';
import { VALUE_INPUTS } from './cooldown';

/**
 * Picks which output of an entity EntWatch should watch as the item's "event".
 *
 * Priors come from the 211 GFL CS2 ZE configs (2656 handlers): OnPass 593, OnTrigger 356,
 * OnPressed 375 (buttons), OnEqualTo 54, OnUser1 30, OnUser4 16, OnTrue 15, OnPlayerUse 5.
 * On top of that the chain each output starts is inspected: the output that ends up
 * unlocking / re-enabling something after a delay is the ability itself (the cooldown chain),
 * which is what a mapper wires behind the "use" of an item.
 */

export interface EventGuess {
  event: string;
  score: number;
  reason: string;
}

const REENABLE = new Set(['unlock', 'enable', 'open', 'unlockbutton', 'unlockuse']);
const LOCK = new Set(['lock', 'disable', 'close', 'lockbutton', 'lockuse']);
const HOUSEKEEPING = new Set([...REENABLE, ...LOCK, 'kill', 'killhierarchy']);

function prior(classname: string, output: string): number {
  const o = output.toLowerCase();
  const cls = classname;
  if (cls.startsWith('filter_')) return o === 'onpass' ? 5 : o === 'onfail' ? 1 : 0.5;
  if (cls === 'func_button' || cls === 'func_rot_button' || cls === 'func_physical_button') return o === 'onpressed' ? 5 : o === 'onin' ? 2 : 0.5;
  if (cls === 'momentary_rot_button') return o === 'onpressed' ? 4 : o === 'onfullyopen' || o === 'onfullyclosed' ? 2 : 0.5;
  if (cls.startsWith('func_physbox') || cls.startsWith('prop_physics')) return o === 'onplayeruse' ? 5 : o === 'ondamaged' ? 2 : 0.5;
  if (cls === 'logic_relay') return o === 'ontrigger' ? 4 : o.startsWith('onuser') ? 2 : 0.5;
  if (cls === 'logic_compare') return o === 'onequalto' ? 4 : o === 'ongreaterthan' || o === 'onlessthan' ? 2 : 1;
  if (cls === 'logic_branch') return o === 'ontrue' ? 3.5 : o === 'onfalse' ? 2.5 : 0.5;
  if (cls === 'logic_case') return /^oncase\d\d$/.test(o) ? 3 : o === 'ondefault' ? 2 : 0.5;
  if (cls === 'logic_timer') return o === 'ontimer' ? 3 : 1;
  if (cls === 'game_ui') return o === 'pressedattack' ? 3.5 : o === 'playeron' ? 2.5 : o.startsWith('pressed') ? 2 : 0.5;
  if (cls === 'math_counter') return o === 'onhitmax' || o === 'onhitmin' ? 2.5 : o === 'outvalue' ? 1 : 0.5;
  if (cls === 'point_template' || cls === 'env_entity_maker') return o === 'onentityspawned' ? 3 : 1;
  if (cls.startsWith('trigger_')) return o === 'onstarttouch' ? 2.5 : o === 'ontrigger' ? 2 : 1;
  if (cls.startsWith('weapon_')) return 0.5;
  if (o.startsWith('onuser')) return 1.5;
  return 1;
}

interface ChainInfo {
  reachesDelayedReenable: boolean;
  reachesLock: boolean;
  effects: number;
  delayed: EntityConnection | null;
}

/** Follows everything the given output starts, a few hops deep. */
function analyseChain(graph: EntityGraph, e: MapEntity, output: string): ChainInfo {
  const info: ChainInfo = { reachesDelayedReenable: false, reachesLock: false, effects: 0, delayed: null };
  const seen = new Set<number>();
  const effectTargets = new Set<string>();
  // SetValue now + SetValue back after a delay on a branch/compare/counter is a cooldown too
  const valueSets = new Map<string, { immediate: boolean; delayed: EntityConnection | null }>();
  const walk = (from: MapEntity, conns: EntityConnection[], depth: number) => {
    for (const c of conns) {
      const input = c.input.toLowerCase();
      const targets = graph.connectionTargets(from, c);
      const selfOnly = targets.length === 0 ? c.target.toLowerCase() === '!self' : targets.every((t) => t.id === e.id);
      if (REENABLE.has(input) && c.delay > 0) {
        info.reachesDelayedReenable = true;
        if (!info.delayed || c.delay > info.delayed.delay) info.delayed = c;
      }
      if (VALUE_INPUTS.has(input)) {
        const key = targets.length > 0 ? targets.map((t) => t.id).join(',') : `${from.id}:${c.target.toLowerCase()}`;
        const v = valueSets.get(key) ?? { immediate: false, delayed: null };
        if (c.delay > 0) {
          if (!v.delayed || c.delay > v.delayed.delay) v.delayed = c;
        } else v.immediate = true;
        valueSets.set(key, v);
      }
      if (LOCK.has(input)) info.reachesLock = true;
      if (!HOUSEKEEPING.has(input) || !selfOnly) effectTargets.add(`${c.target.toLowerCase()}|${input}`);
      if (depth >= 3) continue;
      for (const t of targets) {
        if (t.id === e.id || seen.has(t.id)) continue;
        seen.add(t.id);
        walk(t, t.connections, depth + 1);
      }
    }
  };
  walk(e, e.connections.filter((c) => c.output === output), 0);
  for (const v of valueSets.values()) {
    if (!v.immediate || !v.delayed) continue;
    info.reachesDelayedReenable = true;
    if (!info.delayed || v.delayed.delay > info.delayed.delay) info.delayed = v.delayed;
  }
  info.effects = effectTargets.size;
  return info;
}

/** All plausible events for `e`, best first. */
export function suggestEvents(graph: EntityGraph, e: MapEntity): EventGuess[] {
  const outputs = [...new Set(e.connections.map((c) => c.output).filter((o) => o.length > 0))];
  const guesses: EventGuess[] = [];
  /** Outputs that lead to the cooldown chain: they win a tie. */
  const toCooldown = new Set<string>();
  for (const o of outputs) {
    const info = analyseChain(graph, e, o);
    let score = prior(e.classname, o);
    const why: string[] = [];
    if (info.reachesDelayedReenable && info.delayed) {
      score += 4;
      toCooldown.add(o);
      why.push(`leads to ${info.delayed.input} after ${info.delayed.delay}s (cooldown chain)`);
    } else if (info.reachesLock) {
      score += 1;
      why.push('locks something');
    }
    score += Math.min(info.effects, 8) * 0.25;
    if (info.effects > 0) why.push(`${info.effects} effect${info.effects > 1 ? 's' : ''}`);
    if (info.effects === 0) {
      score -= 2;
      why.push('only housekeeping on itself');
    }
    guesses.push({ event: o, score, reason: why.join(', ') || 'class default' });
  }
  if (guesses.length === 0) {
    const known = KNOWN_OUTPUTS[e.classname] ?? [];
    known.forEach((o, i) => guesses.push({ event: o, score: prior(e.classname, o) - i * 0.01, reason: 'class default (no connections in map)' }));
  }
  // A press that only asks a script (OnPressed → RunScriptInput CheckOwner) is answered through the
  // entity's own OnUserN when the script lets the use through: that output, locking the entity or
  // starting its cooldown, is the use (ze_genso_of_last_v4, ze_goldeneye_64)
  const answered = guesses.some((g) => /^onuser[1-4]$/i.test(g.event) && (toCooldown.has(g.event) || g.reason.startsWith('locks something')));
  if (answered) {
    for (const g of guesses) {
      const conns = e.connections.filter((c) => c.output === g.event && !HOUSEKEEPING.has(c.input.toLowerCase()));
      const asksScript = conns.length > 0 && conns.every((c) => c.input.toLowerCase() === 'runscriptinput' && graph.connectionTargets(e, c).every((t) => t.classname === 'point_script' || t.classname === 'logic_script'));
      if (!asksScript) continue;
      g.score -= 4;
      g.reason += ', only asks a script that answers through OnUser';
    }
  }
  // on a tie the output that leads to the cooldown chain is the use (ze_genso_of_last_v4 hearth_but:
  // OnPressed only asks a script, which fires OnUser4 with the effects and the 65 s Unlock)
  guesses.sort((a, b) => b.score - a.score || Number(toCooldown.has(b.event)) - Number(toCooldown.has(a.event)) || a.event.localeCompare(b.event));
  return guesses;
}

export function describeEntityForEvent(e: MapEntity): string {
  return friendlyName(e.targetname) || e.classname;
}
