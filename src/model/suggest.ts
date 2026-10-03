import type { EntityGraph } from './graph';
import { friendlyName, isWeaponEntity, type MapEntity } from './entity';
import type { HandlerConfig, HandlerMode, HandlerType, ItemConfig } from './entwatch';
import { newHandler, newItem } from './entwatch';
import { analyzeUse, cooldownCounterOf, counterLimit, counterUse, hasSelfCooldown, inferCooldown } from './cooldown';
import { suggestEvents } from './events';
import { abilityReach, findSelectionTriggers, isKnife, stripsVia, switchedOnBy } from './triggers';
import { HOOKABLE_TRIGGERS, abilityOutputs, hasUseOutput, isArmInput, isCounter, isFilter, isGameUi, isGate, isHousekeepingInput, isUseEntity, isUseLike } from './roles';
import { minDistance, origin } from './position';

export { HOOKABLE_TRIGGERS } from './roles';

/** Outputs entity classes are known to fire (used for the event picker). */
export const KNOWN_OUTPUTS: Record<string, string[]> = {
  func_button: ['OnPressed', 'OnDamaged', 'OnIn', 'OnOut', 'OnUseLocked'],
  func_rot_button: ['OnPressed', 'OnIn', 'OnOut', 'OnUseLocked'],
  momentary_rot_button: ['OnPressed', 'OnUnpressed', 'OnFullyClosed', 'OnFullyOpen', 'OnReachedPosition', 'Position'],
  func_physbox: ['OnPlayerUse', 'OnDamaged', 'OnBreak', 'OnHealthChanged', 'OnPhysGunPickup', 'OnPhysGunDrop', 'OnMotionEnabled'],
  func_physbox_multiplayer: ['OnPlayerUse', 'OnDamaged', 'OnBreak', 'OnHealthChanged'],
  func_breakable: ['OnBreak', 'OnHealthChanged', 'OnTakeDamage'],
  prop_physics: ['OnPlayerUse', 'OnBreak', 'OnHealthChanged', 'OnTakeDamage', 'OnPhysGunPickup', 'OnPhysGunDrop'],
  prop_physics_multiplayer: ['OnPlayerUse', 'OnBreak', 'OnHealthChanged', 'OnTakeDamage'],
  prop_dynamic: ['OnBreak', 'OnHealthChanged', 'OnTakeDamage', 'OnAnimationBegun', 'OnAnimationDone'],
  game_ui: [
    'PlayerOn', 'PlayerOff', 'PressedAttack', 'PressedAttack2', 'PressedForward', 'PressedBack', 'PressedMoveLeft',
    'PressedMoveRight', 'UnpressedAttack', 'UnpressedAttack2', 'UnpressedForward', 'UnpressedBack', 'UnpressedMoveLeft',
    'UnpressedMoveRight', 'XAxis', 'YAxis', 'AttackAxis', 'Attack2Axis',
  ],
  filter_activator_name: ['OnPass', 'OnFail'],
  filter_activator_class: ['OnPass', 'OnFail'],
  filter_activator_context: ['OnPass', 'OnFail'],
  filter_activator_team: ['OnPass', 'OnFail'],
  filter_activator_model: ['OnPass', 'OnFail'],
  filter_activator_attribute_int: ['OnPass', 'OnFail'],
  filter_activator_mass_greater: ['OnPass', 'OnFail'],
  filter_damage_type: ['OnPass', 'OnFail'],
  filter_multi: ['OnPass', 'OnFail'],
  logic_relay: ['OnTrigger', 'OnSpawn'],
  logic_case: ['OnCase01', 'OnCase02', 'OnCase03', 'OnCase04', 'OnCase05', 'OnCase06', 'OnCase07', 'OnCase08', 'OnCase09', 'OnCase10', 'OnCase11', 'OnCase12', 'OnCase13', 'OnCase14', 'OnCase15', 'OnCase16', 'OnDefault', 'OnUsed'],
  logic_branch: ['OnTrue', 'OnFalse'],
  logic_compare: ['OnEqualTo', 'OnNotEqualTo', 'OnLessThan', 'OnGreaterThan'],
  logic_timer: ['OnTimer', 'OnTimerHigh', 'OnTimerLow'],
  logic_auto: ['OnMapSpawn', 'OnMultiNewRound', 'OnNewGame', 'OnMultiNewMap', 'OnBackgroundMap', 'OnDemoMapSpawn'],
  logic_eventlistener: ['OnEventFired'],
  math_counter: ['OutValue', 'OnHitMin', 'OnHitMax', 'OnGetValue', 'OnChangedFromMin', 'OnChangedFromMax'],
  trigger_multiple: ['OnStartTouch', 'OnEndTouch', 'OnTrigger', 'OnStartTouchAll', 'OnEndTouchAll', 'OnTouching', 'OnNotTouching'],
  trigger_once: ['OnStartTouch', 'OnTrigger'],
  trigger_push: ['OnStartTouch', 'OnEndTouch', 'OnTrigger'],
  trigger_hurt: ['OnHurt', 'OnHurtPlayer', 'OnStartTouch', 'OnEndTouch'],
  trigger_teleport: ['OnStartTouch', 'OnEndTouch'],
  trigger_gravity: ['OnStartTouch', 'OnEndTouch'],
  trigger_look: ['OnTrigger', 'OnStartTouch', 'OnEndTouch'],
  point_template: ['OnEntitySpawned', 'OnUser1', 'OnUser2', 'OnUser3', 'OnUser4'],
  env_entity_maker: ['OnEntitySpawned', 'OnEntityFailedSpawn'],
  func_door: ['OnOpen', 'OnClose', 'OnFullyOpen', 'OnFullyClosed', 'OnBlockedOpening', 'OnBlockedClosing', 'OnLockedUse'],
  func_door_rotating: ['OnOpen', 'OnClose', 'OnFullyOpen', 'OnFullyClosed', 'OnBlockedOpening', 'OnBlockedClosing', 'OnLockedUse'],
  func_movelinear: ['OnFullyOpen', 'OnFullyClosed'],
  func_tracktrain: ['OnStart', 'OnNext', 'OnArrivedAtDestinationNode'],
  ambient_generic: ['OnSoundFinished'],
  logic_script: [],
};

const GENERIC_OUTPUTS = ['OnUser1', 'OnUser2', 'OnUser3', 'OnUser4', 'OnKilled'];

const labelOf = (x: MapEntity) => friendlyName(x.targetname) || x.classname;

/** All output names an entity could plausibly fire: best guesses first, then class defaults. */
export function outputChoices(e: MapEntity, graph?: EntityGraph): string[] {
  const set = new Set<string>();
  if (graph) for (const g of suggestEvents(graph, e)) set.add(g.event);
  for (const c of e.connections) if (c.output) set.add(c.output);
  for (const o of KNOWN_OUTPUTS[e.classname] ?? []) set.add(o);
  for (const o of GENERIC_OUTPUTS) set.add(o);
  return [...set];
}

export interface HandlerSuggestion {
  type: HandlerType;
  event?: string;
  mode: HandlerMode;
  reason: string;
  cooldown?: number;
  cooldownReason?: string;
  eventReason?: string;
  maxuses?: number;
  maxusesReason?: string;
  /** false when CS2Fixes would not print the use anyway (a counter shown as a value, mode 5). */
  message?: boolean;
  /** Why a counter counts uses (mode 3 / 4) or shows a value (mode 5). */
  modeReason?: string;
}

/**
 * Uses allowed by the entity's own outputs: when the output EntWatch watches (`event`) fires
 * only N times ("Only once" in Hammer), the ability can be used N times. Housekeeping outputs
 * (Kill / Lock / Disable, ...) and other outputs (a one-off OnUser1 for a boss) do not count.
 * The GFL configs write such items as mode 3 with maxuses N.
 */
function fireLimit(e: MapEntity, event: string | undefined): { uses: number; reason: string } | null {
  if (!event) return null;
  let best: { uses: number; reason: string } | null = null;
  for (const c of e.connections) {
    if (c.output.toLowerCase() !== event.toLowerCase()) continue;
    if (!(c.timesToFire > 0) || isHousekeepingInput(c.input)) continue;
    if (!best || c.timesToFire < best.uses) best = { uses: c.timesToFire, reason: `${c.output} → ${c.target} ${c.input} fires ${c.timesToFire === 1 ? 'only once' : `${c.timesToFire} times`}` };
  }
  return best;
}

/**
 * Cooldowns up to this many seconds are an attack the holder fires again and again: the GFL configs
 * switch its chat message off (53 of 62 mode 2 handlers), and with a longer ability next to it up to
 * {@link SHORT_SIBLING_COOLDOWN} seconds (Healmage 8 s next to 40 s).
 */
const SPAM_COOLDOWN = 5;
const SHORT_SIBLING_COOLDOWN = 10;

/**
 * Guesses handler type/event, and the cooldown from Lock/Unlock style wiring when a graph is
 * given. With a graph the event is the output whose chain leads to the delayed Unlock/Enable.
 * The mode follows what the use does, as the GFL configs write it: 2 with a cooldown, 3 when the
 * ability can be used N times (an output that fires N times, a counter that stops it, a use that
 * removes it), and 1 when nothing holds the next use back (cooldown 0, chat off: every use would
 * be printed).
 */
export function suggestHandler(e: MapEntity, graph?: EntityGraph): HandlerSuggestion {
  const s = suggestHandlerBase(e);
  if (graph && s.type !== 'counterup' && s.type !== 'counterdown') {
    const top = suggestEvents(graph, e)[0];
    if (top) {
      s.event = top.event;
      s.eventReason = top.reason;
    }
    const use = analyzeUse(graph, e, s.event);
    if (use.cooldown) {
      s.cooldown = use.cooldown.seconds;
      s.cooldownReason = use.cooldown.reason;
      s.mode = 2;
    }
    const limit = fireLimit(e, s.event) ?? counterLimit(graph, e, s.event) ?? (use.closedForGood[0] ? { uses: 1, reason: use.closedForGood[0].reason } : null);
    if (limit) {
      s.maxuses = limit.uses;
      s.maxusesReason = limit.reason;
      s.mode = 3;
    } else if (!use.cooldown) {
      if (use.closedUntilOther.length > 0) {
        s.mode = 2;
        s.cooldown = 0;
        s.cooldownReason = `the use locks ${use.closedUntilOther.map(labelOf).join(', ')} and only other wiring opens it again: fill in the cooldown`;
      } else {
        s.mode = 1;
        s.cooldown = 0;
        s.message = false;
        s.modeReason = 'nothing the use sets off holds the next use back: no cooldown (mode 1; chat off, every use would be printed)';
      }
    }
    if (s.mode === 2 && use.cooldown && use.cooldown.seconds <= SPAM_COOLDOWN) {
      s.message = false;
      s.modeReason = `a ${use.cooldown.seconds}s cooldown is an attack used over and over: chat off`;
    }
  } else if (graph) {
    // a counter the use steps by one counts uses: CS2Fixes announces each in mode 3 / 4 (its max
    // uses come from the counter's min / max); anything else is shown as a value (mode 5, silent)
    const use = counterUse(graph, e);
    if (use) {
      s.type = use.type;
      if (use.afterUses) {
        s.mode = 4;
        s.cooldown = use.afterUses.seconds;
        s.cooldownReason = use.afterUses.reason;
        s.modeReason = `counts uses (${use.reason}) and locks the item when they run out`;
      } else {
        s.mode = 3;
        s.modeReason = `counts uses (${use.reason})`;
        const cd = inferCooldown(graph, e, 'OutValue');
        if (cd) {
          s.cooldown = cd.seconds;
          s.cooldownReason = cd.reason;
        }
      }
    } else {
      s.message = false;
      s.modeReason = 'holds a charge or an amount (a timer, other steps than one per use): shown as a value, CS2Fixes prints no uses for it';
    }
  }
  return s;
}

function suggestHandlerBase(e: MapEntity): HandlerSuggestion {
  const cls = e.classname;
  const outputs = new Set(e.connections.map((c) => c.output));
  const pick = (...candidates: string[]): string | undefined => candidates.find((c) => outputs.has(c)) ?? candidates[0];

  if (cls === 'math_counter') {
    if (outputs.has('OnHitMax') && !outputs.has('OnHitMin')) return { type: 'counterup', mode: 5, reason: 'math_counter with OnHitMax' };
    if (outputs.has('OnHitMin')) return { type: 'counterdown', mode: 5, reason: 'math_counter with OnHitMin' };
    return { type: 'counterdown', mode: 5, reason: 'math_counter' };
  }
  if (cls === 'func_button' || cls === 'func_rot_button' || cls === 'momentary_rot_button') {
    return { type: 'button', event: pick('OnPressed', 'OnIn'), mode: 2, reason: 'button entity' };
  }
  if (cls === 'func_physbox' || cls === 'func_physbox_multiplayer' || cls.startsWith('prop_physics')) {
    return { type: 'button', event: pick('OnPlayerUse', 'OnDamaged'), mode: 2, reason: 'use-able physics entity' };
  }
  if (isGameUi(e)) {
    const ab = abilityOutputs(e);
    const event =
      ab.find((a) => /attack$/i.test(a.key))?.output ??
      ab[0]?.output ??
      (cls === 'game_ui' ? pick('PressedAttack', 'PlayerOn', 'PressedAttack2') : pick('OnCase01', 'OnDefault'));
    return { type: 'other', event, mode: 2, reason: cls === 'game_ui' ? 'game_ui' : 'game_ui script (logic_case)' };
  }
  if (cls.startsWith('filter_')) {
    return { type: 'other', event: pick('OnPass', 'OnFail'), mode: 2, reason: 'filter' };
  }
  if (cls === 'logic_relay') return { type: 'other', event: 'OnTrigger', mode: 2, reason: 'relay' };
  if (cls === 'logic_case') return { type: 'other', event: pick('OnCase01', 'OnDefault'), mode: 2, reason: 'logic_case' };
  if (cls === 'logic_branch') return { type: 'other', event: pick('OnTrue', 'OnFalse'), mode: 2, reason: 'logic_branch' };
  if (cls === 'logic_compare') return { type: 'other', event: pick('OnEqualTo', 'OnGreaterThan', 'OnLessThan'), mode: 2, reason: 'logic_compare' };
  if (cls === 'logic_timer') return { type: 'other', event: 'OnTimer', mode: 2, reason: 'timer' };
  if (cls.startsWith('trigger_')) return { type: 'other', event: pick('OnStartTouch', 'OnTrigger'), mode: 2, reason: 'trigger' };
  if (cls === 'point_template' || cls === 'env_entity_maker') return { type: 'other', event: 'OnEntitySpawned', mode: 2, reason: 'spawner' };
  if (cls.startsWith('weapon_')) return { type: 'button', event: 'OnPlayerPickup', mode: 1, reason: 'weapon' };
  const first = e.connections[0]?.output;
  return { type: 'other', event: first ?? 'OnUser1', mode: 2, reason: first ? 'first connection output' : 'default' };
}

const COLOR_HINTS: [RegExp, string][] = [
  [/fire|flame|burn|lava|inferno|ifrit|phoenix/i, 'red'],
  [/ice|frost|freeze|snow|blizzard|shiva|water|aqua|ocean/i, 'blue'],
  [/heal|cure|holy|light|angel|life|regen|medic/i, 'white'],
  [/earth|rock|stone|quake|sand|titan/i, 'orange'],
  [/wind|air|tornado|storm|gale|speed|haste|jump/i, 'green'],
  [/electr|thunder|lightning|volt|shock|bolt/i, 'blue'],
  [/poison|bio|toxic|venom|plague/i, 'olive'],
  [/gravity|void|dark|shadow|black|death|necro|sleep|dream|stun|silence|confus/i, 'purple'],
  [/ultima|meteor|nuke|bomb|explo|rocket|missile/i, 'darkred'],
  [/barrier|shield|wall|protect|guard|armor/i, 'yellow'],
  [/time|slow|stop|clock|chrono/i, 'gray'],
  [/gold|money|treasure|coin/i, 'orange'],
  [/laser|beam|cannon|gun|minigun|turret/i, 'silver'],
];

export function suggestColor(name: string): string {
  for (const [re, color] of COLOR_HINTS) if (re.test(name)) return color;
  return 'white';
}

const WEAPON_WORDS = new Set([
  'weapon', 'item', 'materia', 'pickup', 'knife', 'p90', 'ak47', 'm4a1', 'deagle', 'elite', 'glock', 'usp', 'nova', 'xm1014',
  'mag7', 'sawedoff', 'negev', 'm249', 'awp', 'ssg08', 'scar20', 'g3sg1', 'mp5sd', 'mp7', 'mp9', 'mac10', 'ump45', 'bizon',
  'tec9', 'cz75a', 'fiveseven', 'p250', 'hkp2000', 'revolver', 'famas', 'galilar', 'aug', 'sg556', 'm4a1_silencer', 'usp_silencer',
  'taser', 'healthshot', 'decoy', 'flashbang', 'hegrenade', 'smokegrenade', 'molotov', 'incgrenade', 'ent', 'entity', 'wep', 'gun',
]);

/** "materia_fire_weapon" -> "Materia Fire" */
export function suggestItemName(e: MapEntity): { name: string; shortname: string } {
  const raw = friendlyName(e.targetname) || e.classname.replace(/^weapon_/, '');
  const words = raw
    .replace(/\[PR#\]/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0)
    .filter((w) => !WEAPON_WORDS.has(w.toLowerCase()))
    .filter((w) => !/^\d+$/.test(w));
  const pretty = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const name = (words.length > 0 ? words : [raw]).map(pretty).join(' ').trim() || e.classname;
  const shortname = name.length <= 12 ? name : (words[0] ? pretty(words[0]) : name.slice(0, 12));
  return { name, shortname };
}

const ENABLE_INPUTS = new Set(['enable', 'unlock', 'open', 'turnon', 'start']);
const SKIP_CLASSES = new Set([
  'worldspawn', 'point_template', 'env_entity_maker', 'info_target', 'info_teleport_destination', 'prop_dynamic', 'prop_dynamic_override',
  'prop_static', 'light', 'light_spot', 'light_omni', 'env_sprite', 'env_sprite_clientside', 'info_particle_system', 'env_soundscape',
  'ambient_generic', 'snd_event_point', 'func_brush', 'func_movelinear', 'func_door', 'func_door_rotating', 'func_tracktrain', 'path_track',
  'phys_constraint', 'phys_hinge', 'point_clientcommand', 'point_servercommand', 'game_text', 'env_shake', 'env_fade', 'env_hudhint',
  'point_entity_finder', 'point_script', 'logic_script', 'point_teleport', 'logic_measure_movement', 'env_physexplosion', 'env_explosion',
  'logic_auto', 'point_viewcontrol', 'env_entity_igniter',
]);

/**
 * True when the trigger is one a holder touches to fire the item (its outputs feed the item's
 * handlers / cooldown chain) rather than an effect zone the item switches on. Listing an effect
 * zone in "triggers" would make ebanned players immune to it, so those are rejected.
 */
export function isActivationTrigger(graph: EntityGraph, trig: MapEntity, chain: Set<number>): { ok: boolean; reason: string } {
  if (!HOOKABLE_TRIGGERS.has(trig.classname)) return { ok: false, reason: `${trig.classname} is not hooked by CS2Fixes (only trigger_teleport/multiple/once)` };
  const switchedOn = graph.incomingConnections(trig).some(({ from, connection }) => chain.has(from.id) && ENABLE_INPUTS.has(connection.input.toLowerCase()));
  // firing into a handler counts; killing/stripping the weapon itself does not activate anything
  const feedsChain = graph
    .relationsOf(trig)
    .some((r) => r.kind === 'output' && chain.has(r.other.id) && !isWeaponEntity(r.other) && !/^kill/i.test(r.connection?.input ?? ''));
  const cooldownChain = suggestEvents(graph, trig).some((g) => g.reason.includes('cooldown chain'));
  if (switchedOn && !feedsChain) return { ok: false, reason: 'effect zone switched on by the item; listing it would make ebanned players immune to it' };
  if (feedsChain) return { ok: true, reason: 'touching it fires the item handlers' };
  if (cooldownChain) return { ok: true, reason: 'touching it starts a cooldown chain' };
  return { ok: false, reason: 'does not fire the item (nothing it outputs reaches a handler)' };
}

function isInteresting(e: MapEntity): boolean {
  return isUseEntity(e) || isFilter(e) || isGate(e) || isCounter(e) || e.classname.startsWith('trigger_');
}

interface Candidate {
  entity: MapEntity;
  why: string;
  /** 1 direct, 2 sibling (parent / template / lump), 3 one hop from a use-entity or filter, 4 proximity fallback */
  tier: number;
  /** The game_ui key whose output fires it (PressedAttack, PressedAttack2, ...). */
  key?: { ui: MapEntity; key: string };
  /** Enabled by the weapon's OnPlayerPickup: a one-shot / per-holder gate. */
  pickupEnabled?: boolean;
  /** Reached through a gate that only handed the use on and was itself fed by a use entity. */
  fedVia?: boolean;
}

/**
 * What a gate does with its outputs. A combo step only arms / disarms other logic (Enable the
 * next step, Disable itself); a pass-through only hands the use on to other gates (Trigger /
 * Compare); a switch only stores values other logic reads and shows it (a particle, a sound: the
 * mode the next attack uses); anything else is an effect and makes the gate a handler candidate.
 */
function gateRole(graph: EntityGraph, x: MapEntity): { role: 'chain-step' | 'pass-through' | 'switch' | 'effects'; passOn: MapEntity[] } {
  let effects = 0;
  let feedback = 0;
  let storesOnOthers = 0;
  const passOn: MapEntity[] = [];
  const ownName = friendlyName(x.targetname).toLowerCase();
  for (const c of x.connections) {
    const targets = graph.connectionTargets(x, c);
    // the graph leaves out links to itself, also when the gate names itself instead of !self
    const self =
      c.target.toLowerCase() === '!self' || (ownName.length > 0 && friendlyName(c.target).toLowerCase() === ownName) || (targets.length > 0 && targets.every((t) => t.id === x.id));
    const logicOnly = targets.length > 0 && targets.every((t) => t.id === x.id || isGate(t) || isCounter(t) || isFilter(t));
    if (isArmInput(c.input) && (self || logicOnly)) {
      if (!self && VALUE_STORE_INPUTS.test(c.input)) storesOnOthers++;
      continue;
    }
    if (!self && logicOnly && !isGameUi(x)) {
      for (const t of targets) if (t.id !== x.id && !passOn.includes(t)) passOn.push(t);
      continue;
    }
    if (targets.length > 0 && (FEEDBACK_INPUTS.has(c.input.toLowerCase()) || targets.every((t) => FEEDBACK_CLASSES.has(t.classname)))) {
      feedback++;
      continue;
    }
    effects++;
  }
  if (effects > 0) return { role: 'effects', passOn };
  if (feedback > 0) return { role: storesOnOthers > 0 && passOn.length === 0 ? 'switch' : 'effects', passOn };
  return { role: passOn.length > 0 ? 'pass-through' : 'chain-step', passOn };
}

const VALUE_STORE_INPUTS = /^(setvalue|setvaluenofire|setcomparevalue|setvaluecompare)$/i;

/**
 * The relays / cases / counters a filter hands the use on to, when that is all it does: every
 * non-housekeeping output lands on logic. Null when the filter has effects of its own (then it is
 * the ability and the gates behind it only repeat its event).
 */
function filterPassOn(graph: EntityGraph, f: MapEntity): MapEntity[] | null {
  const passOn: MapEntity[] = [];
  for (const c of f.connections) {
    if (isHousekeepingInput(c.input)) continue;
    for (const t of graph.connectionTargets(f, c)) {
      if (t.id === f.id) continue;
      if (!(isGate(t) || isCounter(t) || isFilter(t)) || isGameUi(t)) return null;
      if (!passOn.includes(t)) passOn.push(t);
    }
  }
  const gates = passOn.filter((t) => !isFilter(t));
  return gates.length > 0 ? gates : null;
}

/**
 * Counters the filter adds to / subtracts from that no other filter counts: the item's own use
 * or ammo count. A counter shared by several items' filters (a combo meter) is not.
 */
function itemCounters(graph: EntityGraph, f: MapEntity): MapEntity[] {
  const out: MapEntity[] = [];
  for (const c of f.connections) {
    if (!/^(add|subtract)$/i.test(c.input)) continue;
    for (const t of graph.connectionTargets(f, c)) {
      if (!isCounter(t) || out.includes(t)) continue;
      const shared = graph.incomingConnections(t).some(({ from, connection }) => from.id !== f.id && isFilter(from) && !isHousekeepingInput(connection.input));
      if (!shared) out.push(t);
    }
  }
  return out;
}

/** True when something locks `e` and something unlocks it again (a gated button). */
function isLockedAndUnlocked(graph: EntityGraph, e: MapEntity): boolean {
  const inputs = new Set(graph.incomingConnections(e).map(({ connection }) => connection.input.toLowerCase()));
  return inputs.has('lock') && inputs.has('unlock');
}

/** Gates that pick one outcome of the use (enough sun or not, the case for this level). */
const CHOICE_CLASSES = new Set(['logic_compare', 'logic_branch', 'logic_case']);

/** `e` locks / disables a button or other +use entity, or has cooldown wiring of its own. */
function startsCooldown(graph: EntityGraph, e: MapEntity): boolean {
  if (hasSelfCooldown(graph, e)) return true;
  return e.connections.some((c) => /^(lock|disable)$/i.test(c.input) && graph.connectionTargets(e, c).some(isUseEntity));
}

const FEEDBACK_CLASSES = new Set([
  'prop_dynamic', 'prop_dynamic_override', 'info_particle_system', 'env_sprite', 'env_sprite_clientside', 'point_worldtext', 'game_text',
  'ambient_generic', 'point_soundevent', 'snd_event_point', 'env_fade', 'env_shake', 'env_screenoverlay', 'env_hudhint', 'env_instructor_hint',
]);
const FEEDBACK_INPUTS = new Set(['color', 'alpha', 'startsound', 'stopsound', 'playsound', 'setsourceentity', 'startglowing', 'stopglowing', 'setglowcolor', 'setmessage', 'setintmessage', 'display', 'showhudhint']);

/** Keys in the order the GFL configs list their handlers: the main attack first. */
const KEY_ORDER = ['attack', 'attack2', 'use', 'reload', 'forward', 'back', 'moveleft', 'moveright', 'jump', 'duck', 'speed', 'walk'];

function keyRank(key: string): number {
  const i = KEY_ORDER.indexOf(key.replace(/^(pressed|unpressed)/i, '').toLowerCase());
  return 1 + (i < 0 ? KEY_ORDER.length : i);
}

/** "rynnak3" -> "rynnak", "fire_relay_2" -> "fire_relay"; and the number ("" when there is none). */
function levelSuffix(x: MapEntity): { base: string; n: number } {
  const name = friendlyName(x.targetname).toLowerCase();
  const m = /^(.*?)[_\-\s]*(\d+)$/.exec(name);
  return m && m[1] ? { base: m[1], n: parseInt(m[2], 10) } : { base: name, n: 0 };
}

/**
 * Copies of one ability for the item's levels: gates on the same key whose names differ only by a
 * number and that all start disabled (the level picked at pickup enables one, ze_tesv_skyrim_p
 * Dovahkiin: rynnak / rynnak2 / rynnak3). The GFL configs list the first one only.
 */
function levelVariants(chosen: Candidate[]): { keep: Candidate; drop: Candidate }[] {
  const out: { keep: Candidate; drop: Candidate }[] = [];
  const groups = new Map<string, Candidate[]>();
  for (const c of chosen) {
    if (!c.key || !isGate(c.entity) || c.entity.props.startdisabled !== '1') continue;
    const { base } = levelSuffix(c.entity);
    if (!base) continue;
    const k = `${c.key.ui.id}|${c.key.key}|${c.entity.classname}|${base}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce((a, b) => (levelSuffix(b.entity).n < levelSuffix(a.entity).n ? b : a));
    for (const c of group) if (c !== keep) out.push({ keep, drop: c });
  }
  return out;
}

/**
 * A gate fired by the same press (the same entity and output) as a counter that counts the uses:
 * the counter reports the use with its count and cooldown, the gate would print it a second time.
 * The GFL configs never list both (1 item in 1775 has a use counter and an event handler).
 */
function countedTwice(graph: EntityGraph, chosen: Candidate[]): { counter: Candidate; drop: Candidate }[] {
  const feeders = (x: MapEntity) =>
    new Set(graph.incomingConnections(x).filter(({ connection }) => !isHousekeepingInput(connection.input)).map(({ from, connection }) => `${from.id}|${connection.output.toLowerCase()}`));
  const out: { counter: Candidate; drop: Candidate }[] = [];
  for (const k of chosen) {
    if (!isCounter(k.entity) || !counterUse(graph, k.entity)) continue;
    const fk = feeders(k.entity);
    for (const g of chosen) {
      if (g === k || !(isGate(g.entity) || isFilter(g.entity)) || out.some((o) => o.drop === g)) continue;
      if ([...feeders(g.entity)].some((f) => fk.has(f))) out.push({ counter: k, drop: g });
    }
  }
  return out;
}

const NAME_NOISE = new Set([
  'relay', 'rel', 'r', 'case', 'compare', 'branch', 'logic', 'item', 'items', 'weapon', 'wep', 'wpn', 'button', 'btn', 'filter',
  'counter', 'timer', 'trigger', 'trig', 'ui', 'the', 'ability', 'skill', 'use', 'attack', 'attk', 'atk', 'zombie', 'zm', 'human',
]);

/**
 * Names for abilities sharing one key, from what sets their targetnames apart: shout_fire /
 * shout_freeze / shout_push -> Fire / Freeze / Push (as GFL names them). Nothing when a name would
 * be a number or a filler word.
 */
function abilityNames(ents: MapEntity[]): (string | undefined)[] {
  const words = ents.map((x) => friendlyName(x.targetname).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const common = new Set(words[0].filter((w) => words.every((ws) => ws.includes(w))));
  const own = words.map((ws) => ws.filter((w) => !common.has(w) && !NAME_NOISE.has(w) && /^[a-z]{3,}$/.test(w)));
  const pretty = own.map((ws) => ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  if (pretty.some((n) => !n) || new Set(pretty).size !== pretty.length) return ents.map(() => undefined);
  return pretty;
}

/** `e` only answers the player: flashes a model, plays a sound, shows a text. */
function feedbackOnly(graph: EntityGraph, e: MapEntity): boolean {
  const effects = e.connections.filter((c) => !isHousekeepingInput(c.input));
  return effects.length > 0 && effects.every((c) => FEEDBACK_INPUTS.has(c.input.toLowerCase()) || graph.connectionTargets(e, c).every((t) => FEEDBACK_CLASSES.has(t.classname)));
}

/**
 * Builds an item entry for a weapon entity and proposes handlers from related entities.
 *
 * Candidates come from, in order of confidence:
 *   1. entities parented to the weapon, targets of its outputs (for OnPlayerPickup only the
 *      game_ui it activates and the gates it enables), entities naming it (filtername),
 *      triggers that Kill it;
 *   2. siblings: children of the weapon's parent (weapon and button both parented to a prop),
 *      members of the same point_template, entities compiled into the same template lump;
 *   3. one hop from buttons / physboxes / game_ui (per pressed key) / filters found so far;
 *   4. if nothing usable turned up: entities of interest within 200 units of the weapon.
 * Buttons are taken when a player using them fires something; game_ui keys hand over to the
 * relays behind them; filters need outputs and a button feeding them; relays / cases / counters
 * need a use-entity feeding them (housekeeping inputs such as Kill / Disable do not count), their
 * own cooldown wiring, or an OnPlayerPickup that arms them.
 */
export function suggestItemForWeapon(e: MapEntity, graph: EntityGraph): { item: ItemConfig; notes: string[] } {
  const notes: string[] = [];
  const { name, shortname } = suggestItemName(e);
  const item = newItem({
    name,
    shortname,
    hammerid: e.hammerId,
    color: suggestColor(friendlyName(e.targetname)),
    // left to CS2Fixes' auto detection (name suffix); nothing to gain from writing it
    templated: undefined,
  });
  const label = (x: MapEntity) => friendlyName(x.targetname) || x.classname;

  const candidates: Candidate[] = [];
  const byId = new Map<number, Candidate>();
  const consider = (other: MapEntity, why: string, tier: number, extra: Partial<Candidate> = {}) => {
    if (other.id === e.id || SKIP_CLASSES.has(other.classname) || isWeaponEntity(other)) return;
    const existing = byId.get(other.id);
    if (existing) {
      if (extra.key && !existing.key) existing.key = extra.key;
      if (extra.pickupEnabled) existing.pickupEnabled = true;
      return;
    }
    const c: Candidate = { entity: other, why, tier, ...extra };
    candidates.push(c);
    byId.set(other.id, c);
  };

  // ---- tier 1: direct relations -------------------------------------------------------------
  const PICKUP_OUTPUTS = new Set(['OnPlayerPickup', 'OnNPCPickup', 'OnCacheInteraction']);
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind === 'child') consider(rel.other, `parented to weapon (${rel.label})`, 1);
    else if (rel.kind === 'output' && rel.connection) {
      if (PICKUP_OUTPUTS.has(rel.connection.output)) {
        // picking the weapon up arms its game_ui, or enables its one-shot relay
        const input = rel.connection.input.toLowerCase();
        if (isGameUi(rel.other)) consider(rel.other, `activated by the weapon's ${rel.label}`, 1);
        else if (rel.other.classname === 'logic_relay' && ENABLE_INPUTS.has(input)) consider(rel.other, `enabled by the weapon's ${rel.label}`, 1, { pickupEnabled: true });
        continue;
      }
      consider(rel.other, `weapon output ${rel.label}`, 1);
    } else if (rel.kind === 'keyref-in') consider(rel.other, `references weapon via ${rel.label}`, 1);
    else if (rel.kind === 'input' && rel.other.classname.startsWith('trigger_')) consider(rel.other, `fires ${rel.label} on weapon`, 1);
  }

  // ---- tier 2: siblings ----------------------------------------------------------------------
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind !== 'parent') continue;
    const parent = rel.other;
    const sibs = graph.relationsOf(parent).filter((r) => r.kind === 'child' && r.other.id !== e.id);
    if (sibs.length > 0) notes.push(`weapon is parented to ${label(parent)}; ${sibs.length} sibling(s) there`);
    for (const r of sibs) consider(r.other, `parented to ${label(parent)} together with the weapon`, 2);
  }
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind !== 'template-in') continue;
    const tpl = rel.other;
    const members = graph.relationsOf(tpl).filter((r) => r.kind === 'template' && r.other.id !== e.id);
    notes.push(`weapon is spawned by ${label(tpl)} with ${members.length} other template member(s)`);
    for (const r of members) consider(r.other, `same point_template (${label(tpl)})`, 2);
  }
  if (e.source.templated) {
    const lumpMates = graph.entities.filter((x) => x.id !== e.id && x.source.templated && x.source.container === e.source.container && x.source.file === e.source.file);
    if (lumpMates.length > 0 && lumpMates.length <= 60) {
      const interesting = lumpMates.filter(isInteresting);
      notes.push(`template lump ${e.source.container}: ${lumpMates.length} entities (${interesting.map((x) => x.classname).join(', ') || 'nothing usable'})`);
      for (const x of interesting) consider(x, `same template lump (${e.source.container})`, 2);
    }
  }

  // ---- tier 3: one hop from use-entities, game_ui keys, touch triggers and filters -------------
  const expanded = new Set<number>();
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const x = c.entity;
    if (expanded.has(x.id)) continue;
    // a game_ui reached through a physbox (tier 3) still needs its keys followed; nothing else at tier 3 is expanded
    if (c.tier > 3 || (c.tier === 3 && !isGameUi(x))) continue;
    expanded.add(x.id);
    if (isGameUi(x)) {
      for (const ab of abilityOutputs(x)) {
        for (const conn of x.connections) {
          if (conn.output !== ab.output || isHousekeepingInput(conn.input)) continue;
          for (const t of graph.connectionTargets(x, conn)) consider(t, `${label(x)} ${ab.output} (${ab.key}) → ${conn.input}`, 3, { key: { ui: x, key: ab.key } });
        }
      }
    } else if (isUseEntity(x)) {
      for (const rel of graph.relationsOf(x)) {
        if (rel.kind === 'output' && rel.connection && !isHousekeepingInput(rel.connection.input)) consider(rel.other, `${label(x)} ${rel.label}`, 3);
        if (rel.kind === 'child') consider(rel.other, `parented to ${label(x)}`, 3);
      }
    } else if (HOOKABLE_TRIGGERS.has(x.classname) || isFilter(x)) {
      for (const rel of graph.relationsOf(x)) {
        if (rel.kind === 'output' && rel.connection && !isHousekeepingInput(rel.connection.input)) consider(rel.other, `${label(x)} ${rel.label}`, 3);
      }
    }
  }

  // ---- tier 4: proximity fallback ------------------------------------------------------------
  const usable = () =>
    candidates.some((c) => (isUseEntity(c.entity) && hasUseOutput(c.entity)) || (isFilter(c.entity) && c.entity.connections.length > 0) || isGate(c.entity) || isCounter(c.entity));
  if (!usable() && origin(e)) {
    const near = graph.entities
      .filter((x) => x.id !== e.id && isInteresting(x) && (!e.source.templated || x.source.container === e.source.container))
      .map((x) => ({ x, d: minDistance(graph, e, x) }))
      .filter((p): p is { x: MapEntity; d: number } => p.d !== null && p.d <= 200)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);
    if (near.length > 0) notes.push(`nothing wired to the weapon; looked at ${near.length} entities within 200 units`);
    for (const p of near) consider(p.x, `within ${Math.round(p.d)} units of the weapon`, 4);
  }

  // ---- selection -----------------------------------------------------------------------------
  const included = new Set<number>();
  /** `x` is fed (through a non-housekeeping input, a key reference or parenting) by an included entity matching `pred`. */
  const feeds = (x: MapEntity, pred: (from: MapEntity) => boolean) =>
    graph.incomingConnections(x).some(({ from, connection }) => included.has(from.id) && !isHousekeepingInput(connection.input) && pred(from)) ||
    graph.relationsOf(x).some((r) => (r.kind === 'keyref' || r.kind === 'parent') && included.has(r.other.id) && pred(r.other));
  const fedByIncluded = (x: MapEntity) => feeds(x, () => true);
  // a relay behind an already chosen filter/relay would just repeat that handler's event
  // (a game_ui logic_case is a use entity, not such a gate)
  const redundant = (x: MapEntity) => feeds(x, (from) => (isFilter(from) || isGate(from) || isCounter(from)) && !isGameUi(from));
  const chosen: { c: Candidate; extra?: string }[] = [];
  const skipped: string[] = [];
  const byOrder = [...candidates].sort((a, b) => a.tier - b.tier);
  const uis: Candidate[] = [];

  for (const c of byOrder) {
    const x = c.entity;
    if (!isUseEntity(x) || !x.hammerId) continue;
    // a button that fires nothing itself but is locked and unlocked by the item's logic is still
    // the +use the item is gated on (ze_santassination_p: the game_ui locks it for the cooldown)
    if (!hasUseOutput(x) && !(!isGameUi(x) && isLockedAndUnlocked(graph, x))) {
      const outs = [...new Set(x.connections.map((k) => k.output))];
      skipped.push(`${label(x)} (${x.classname}, using it fires nothing${outs.length > 0 ? `; only ${outs.join('/')} housekeeping` : '; no outputs'})`);
      continue;
    }
    included.add(x.id);
    if (isGameUi(x)) uis.push(c);
    else chosen.push({ c });
  }
  // touch triggers that start the chain count as feeders (they are confirmed as activation triggers below)
  const touchFeeders = byOrder.filter((c) => HOOKABLE_TRIGGERS.has(c.entity.classname) && c.entity.connections.some((k) => /^on(start)?touch|^ontrigger/i.test(k.output)));
  for (const c of touchFeeders) included.add(c.entity.id);
  const behindFilters: Candidate[] = [];
  for (const c of byOrder) {
    const x = c.entity;
    if (!isFilter(x) || !x.hammerId || included.has(x.id)) continue;
    if (x.connections.length === 0) {
      skipped.push(`${label(x)} (filter with no outputs; it is part of the knife-removal wiring, not a handler)`);
      continue;
    }
    if (c.tier === 1 || fedByIncluded(x)) {
      // a filter that only checks the user and hands the use on to relays / counters is not the
      // ability: the gates behind it are (GFL lists those, e.g. button → filter → relay)
      const passOn = filterPassOn(graph, x);
      if (passOn) {
        skipped.push(`${label(x)} (filter only checks the user and hands the use on to ${passOn.map(label).join(', ')})`);
        for (const t of passOn) {
          consider(t, `behind ${label(x)} (${c.why})`, 3, { key: c.key, fedVia: true });
          const nc = byId.get(t.id);
          if (nc) {
            nc.fedVia = true;
            if (!behindFilters.includes(nc)) behindFilters.push(nc);
          }
        }
        continue;
      }
      // a counter only this filter counts (uses / ammo of this item) reports the use better than
      // the filter: the GFL configs list the counter (21 of 27 such chains)
      const counters = itemCounters(graph, x);
      if (counters.length > 0) {
        skipped.push(`${label(x)} (filter counted by ${counters.map(label).join(', ')}, which reports the use)`);
        for (const t of counters) {
          consider(t, `counts ${label(x)} (${c.why})`, 3, { key: c.key, fedVia: true });
          const nc = byId.get(t.id);
          if (nc) {
            nc.fedVia = true;
            if (!behindFilters.includes(nc)) behindFilters.push(nc);
          }
        }
        continue;
      }
      included.add(x.id);
      chosen.push({ c });
    } else skipped.push(`${label(x)} (filter, not fed by a button)`);
  }
  const isGateCandidate = (o: Candidate) => (isGate(o.entity) || isCounter(o.entity)) && !isGameUi(o.entity);
  const gateCount = candidates.filter(isGateCandidate).length;
  const gateQueue = [...byOrder, ...behindFilters.filter((b) => !byOrder.includes(b))].filter(isGateCandidate);
  const decided = new Set<number>();
  while (gateQueue.length > 0) {
    const c = gateQueue.shift()!;
    const x = c.entity;
    if (!x.hammerId || included.has(x.id) || decided.has(x.id)) continue;
    decided.add(x.id);
    const strip = stripsVia(graph, x, 1);
    if (strip) {
      skipped.push(`${label(x)} (${x.classname}, strips the player: selection wiring rather than an ability; ${strip.via})`);
      continue;
    }
    if (redundant(x) && !c.pickupEnabled) {
      skipped.push(`${label(x)} (${x.classname}, sits behind a handler that already reports the use)`);
      continue;
    }
    const fed = feeds(x, isUseLike) || c.fedVia === true;
    const selfCd = hasSelfCooldown(graph, x);
    // a counter holding an amount the use only checks (GetValue → compare: enough sun to plant?) is
    // not the ability, and CS2Fixes would not announce it: the use goes on through what it fires
    if (isCounter(x) && !counterUse(graph, x)) {
      const readOn = x.connections
        .filter((k) => /^ongetvalue$/i.test(k.output) && !isHousekeepingInput(k.input))
        .flatMap((k) => graph.connectionTargets(x, k))
        .filter((t, i, all) => (isGate(t) || isFilter(t)) && all.indexOf(t) === i);
      if (readOn.length > 0) {
        skipped.push(`${label(x)} (math_counter holding an amount the use only checks; the use goes on through ${readOn.map(label).join(', ')})`);
        for (const t of readOn) {
          if (byId.has(t.id)) continue;
          consider(t, `behind ${label(x)} (${c.why})`, 3, { key: c.key, fedVia: fed || undefined });
          const nc = byId.get(t.id);
          if (nc) gateQueue.push(nc);
        }
        continue;
      }
    }
    const { role, passOn } = gateRole(graph, x);
    // a counter that only locks or kills things when it runs out is the item's use count
    if (role === 'chain-step' && !(isCounter(x) && c.fedVia)) {
      skipped.push(`${label(x)} (${x.classname}, only arms or disarms other logic: a step of a key combo, not an ability)`);
      continue;
    }
    // a switch without a cooldown of its own (minas TNT: the attack key flips whether the blast
    // pushes, and a particle shows it) is not listed by GFL; one with a cooldown is (amdaporkeep)
    if (role === 'switch' && !selfCd) {
      skipped.push(`${label(x)} (${x.classname}, only flips values other logic reads and shows it: a mode switch, not an ability)`);
      continue;
    }
    if (role === 'pass-through' && !selfCd) {
      // the gate it hands the use to is the one that does something: judge that one instead. Of
      // the outcomes of a compare / branch, the one that locks the item or starts its cooldown is
      // the ability; one that only flashes a model or plays a sound answers "not ready"
      const ability = CHOICE_CLASSES.has(x.classname) ? passOn.filter((t) => startsCooldown(graph, t)) : [];
      const replies = ability.length > 0 ? passOn.filter((t) => !ability.includes(t) && feedbackOnly(graph, t)) : [];
      const next = passOn.filter((t) => !replies.includes(t));
      skipped.push(`${label(x)} (${x.classname}, only hands the use on to ${next.map(label).join(', ')}${replies.length > 0 ? `; ${replies.map(label).join(', ')} only answers "not ready"` : ''})`);
      for (const t of next) {
        if (byId.has(t.id)) continue;
        consider(t, `behind ${label(x)} (${c.why})`, 3, { key: c.key, fedVia: fed || undefined });
        const nc = byId.get(t.id);
        if (nc) gateQueue.push(nc);
      }
      continue;
    }
    if (x.classname === 'logic_timer' && !fed) {
      skipped.push(`${label(x)} (logic_timer, a periodic effect rather than a use)`);
      continue;
    }
    if (fed || selfCd || c.pickupEnabled || (c.tier <= 2 && gateCount === 1)) {
      // N uses, then the counter it steps holds the item back: the counter reports both (mode 4)
      const counter = isCounter(x) ? null : cooldownCounterOf(graph, x);
      if (counter && counter.hammerId && !included.has(counter.id)) {
        consider(counter, `counts the uses of ${label(x)} (${c.why})`, 3, { key: c.key, fedVia: true });
        const nc = byId.get(counter.id);
        if (nc) {
          decided.add(counter.id);
          included.add(counter.id);
          chosen.push({ c: nc, extra: `counts the uses of ${label(x)} and holds the item back at its limit` });
          skipped.push(`${label(x)} (${x.classname}, steps ${label(counter)}, which counts its uses and starts the cooldown at its limit: the counter reports the use)`);
          continue;
        }
      }
      included.add(x.id);
      chosen.push({
        c,
        extra: c.key
          ? `fired by ${label(c.key.ui)} on ${c.key.key}`
          : fed
            ? 'fed by a button/trigger'
            : selfCd
              ? 'has its own cooldown wiring'
              : c.pickupEnabled
                ? 'armed by the weapon pickup'
                : 'only gate in the group',
      });
    } else skipped.push(`${label(x)} (${x.classname}, not fed by the item and no cooldown pattern)`);
  }
  // a one-shot relay armed by the pickup replaces the pass-through filter in front of it
  for (const g of chosen.filter(({ c }) => c.pickupEnabled)) {
    for (let i = chosen.length - 1; i >= 0; i--) {
      const f = chosen[i].c.entity;
      if (!isFilter(f)) continue;
      const effects = f.connections.filter((k) => !isHousekeepingInput(k.input));
      const onlyToGate = effects.length > 0 && effects.every((k) => graph.connectionTargets(f, k).every((t) => t.id === g.c.entity.id));
      if (onlyToGate) {
        chosen.splice(i, 1);
        included.delete(f.id);
        skipped.push(`${label(f)} (filter only passes the use on to ${label(g.c.entity)}, which reports it)`);
      }
    }
  }
  // the game_ui itself reports the press only when nothing behind its keys qualified
  for (const c of uis) {
    const ui = c.entity;
    const behind = chosen.filter(({ c: o }) => o.key?.ui.id === ui.id || feeds(o.entity, (from) => from.id === ui.id));
    if (behind.length === 0) chosen.push({ c, extra: 'no relay behind its key outputs, so the ui reports the press itself' });
    else notes.push(`game_ui ${label(ui)}: ${behind.map(({ c: o }) => `${o.key?.key ?? 'output'} → ${label(o.entity)}`).join(', ')}`);
  }
  // ---- the shape GFL gives the list --------------------------------------------------------------
  for (const v of levelVariants(chosen.map(({ c }) => c))) {
    const at = chosen.findIndex(({ c }) => c === v.drop);
    if (at >= 0) chosen.splice(at, 1);
    skipped.push(`${label(v.drop.entity)} (a copy of ${label(v.keep.entity)} for another item level: starts disabled, fired by the same key; GFL lists one)`);
  }
  for (const d of countedTwice(graph, chosen.map(({ c }) => c))) {
    const at = chosen.findIndex(({ c }) => c === d.drop);
    if (at >= 0) chosen.splice(at, 1);
    skipped.push(`${label(d.drop.entity)} (the same press steps ${label(d.counter.entity)}, which already reports the use with its count)`);
  }
  // +use entities first, then the rest, keys in the order Attack, Attack2, ... (stable otherwise)
  const rank = (c: Candidate) => (isUseEntity(c.entity) && !isGameUi(c.entity) ? -1 : c.key ? keyRank(c.key.key) : 0);
  chosen.sort((a, b) => rank(a.c) - rank(b.c));
  // several abilities on one key (a shout that cycles fire / freeze / push) are told apart by name
  const names = new Map<Candidate, string>();
  const byKey = new Map<string, Candidate[]>();
  for (const { c } of chosen) {
    if (!c.key) continue;
    const k = `${c.key.ui.id}|${c.key.key}`;
    byKey.set(k, [...(byKey.get(k) ?? []), c]);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    abilityNames(group.map((c) => c.entity)).forEach((n, i) => n && names.set(group[i], n));
  }

  const triggers: string[] = [];
  const chainIds = new Set<number>([e.id, ...chosen.map(({ c }) => c.entity.id)]);
  // knife / class items: triggers that spawn, strip or land on the knife (found by position, not by name)
  const selection = isKnife(e) ? findSelectionTriggers(graph, e) : [];
  const selectionIds = new Set(selection.map((s) => s.trigger.id));
  // Triggers wired into the item itself (a zone the holder touches, a hurt zone parented to the
  // weapon) are never listed: "triggers" keeps ebanned players from touching them, so they would
  // become immune to its effect zones, and an ebanned player cannot hold the item anyway. The GFL
  // configs list none of them (0 of 44 on the evaluated maps).
  for (const c of byOrder) {
    if (!c.entity.classname.startsWith('trigger_') || !c.entity.hammerId) continue;
    if (selectionIds.has(c.entity.id)) continue; // reported below
    const verdict = isActivationTrigger(graph, c.entity, chainIds);
    if (!verdict.ok) included.delete(c.entity.id);
    skipped.push(`trigger ${label(c.entity)} (${verdict.ok ? `${verdict.reason}; part of the item, not a trigger to keep ebanned players off` : verdict.reason})`);
  }

  for (const { c, extra } of chosen) {
    const ent = c.entity;
    const s = suggestHandler(ent, graph);
    const h: HandlerConfig = newHandler({
      name: names.get(c),
      type: s.type,
      hammerid: ent.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
      cooldown: s.cooldown ?? 0,
      maxuses: s.maxuses ?? 0,
      ...(s.message === false ? { message: false } : {}),
      // CS2Fixes auto-detects templated entities from the _N name suffix; the only value worth
      // writing is "false" for a shared (non-templated) handler of a templated weapon
      templated: e.source.templated && !ent.source.templated ? false : undefined,
    });
    item.handlers.push(h);
    notes.push(`handler ${label(ent)} (${s.type}${s.event ? ' ' + s.event : ''}): ${c.why}${extra ? '; ' + extra : ''}`);
    if (h.templated === false) notes.push(`templated=false: the weapon is spawned by a template but ${label(ent)} is a single map entity`);
    if (s.modeReason) notes.push(`mode ${s.mode}: ${s.modeReason}`);
    if (s.eventReason && s.event) notes.push(`event ${s.event}: ${s.eventReason}`);
    if (s.cooldownReason) notes.push(`cooldown ${s.cooldown}s: ${s.cooldownReason}`);
    if (s.maxusesReason) notes.push(`maxuses ${s.maxuses}: ${s.maxusesReason}`);
  }
  if (isKnife(e)) {
    if (selection.length === 0) notes.push('knife item: no strip zone tied to it, teleport landing (within 64 units) or template spawner for it was found');
    const ability = abilityReach(graph, chosen.map(({ c }) => c.entity), e);
    for (const st of selection) {
      if (!st.trigger.hammerId || triggers.includes(st.trigger.hammerId)) continue;
      if (st.kind === 'landing' && switchedOnBy(graph, st.trigger, ability)) {
        skipped.push(`trigger ${label(st.trigger)} (${st.reason}, but the item's own logic switches it on: the ability's teleport, not the way to get the item)`);
        continue;
      }
      triggers.push(st.trigger.hammerId);
      notes.push(`trigger ${label(st.trigger)}: ${st.reason}`);
    }
  }
  for (const sk of skipped) notes.push(`skipped ${sk}`);
  item.triggers = triggers;

  // When a filter / relay / counter handler follows the button, the button entry only needs to hook
  // +use (the GFL convention: {"type": "button", "hammerid": "..."}); the follow-up reports the use.
  // That holds for a counter shown as a value too: GFL writes such items as a plain hook and the
  // counter (34 items), never as a button that announces the press next to it.
  if (item.handlers.some((h) => h.type !== 'button')) {
    for (const h of item.handlers) {
      if (h.type !== 'button') continue;
      h.mode = 1;
      h.event = undefined;
      h.message = false;
      h.ui = false;
      h.cooldown = 0;
      h.maxuses = 0;
    }
  }
  // a quick attack next to a longer ability of the same item is used over and over: GFL keeps its
  // chat message off (Healmage 8 s next to 40 s, Archmage 9 s next to 60 s)
  const longest = Math.max(0, ...item.handlers.filter((h) => h.mode >= 2 && h.mode <= 4).map((h) => h.cooldown ?? 0));
  for (const h of item.handlers) {
    if (h.mode !== 2 || !h.message || !(h.cooldown && h.cooldown <= SHORT_SIBLING_COOLDOWN) || longest <= h.cooldown) continue;
    h.message = false;
    notes.push(`message off for ${h.hammerid}: a ${h.cooldown}s attack next to a ${longest}s ability is used over and over`);
  }
  // GFL spells transfer out for every item; CS2Fixes would pick the same (off for knives)
  item.transfer = !isKnife(e);
  if (item.handlers.length === 0) {
    notes.push(candidates.length === 0
      ? 'Nothing is wired to or grouped with this weapon (no parent, no template, no outputs). Use the I/O search (e.g. "in:unlock") to find the ability entities and add them with "+".'
      : 'No button/filter/relay/counter qualified; see the skipped entries above and add handlers from the tree or the I/O search.');
  }
  return { item, notes };
}
