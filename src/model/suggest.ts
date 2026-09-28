import type { EntityGraph } from './graph';
import { friendlyName, isWeaponEntity, type MapEntity } from './entity';
import type { HandlerConfig, HandlerMode, HandlerType, ItemConfig } from './entwatch';
import { newHandler, newItem } from './entwatch';
import { hasSelfCooldown, inferCooldown } from './cooldown';
import { suggestEvents } from './events';
import { findSelectionTriggers, isKnife, stripsVia } from './triggers';
import { HOOKABLE_TRIGGERS, abilityOutputs, hasUseOutput, isArmInput, isCounter, isFilter, isGameUi, isGate, isHousekeepingInput, isUseEntity, isUseLike, keyLabel } from './roles';
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
 * Guesses handler type/event, and the cooldown from Lock/Unlock style wiring when a graph is
 * given. With a graph the event is the output whose chain leads to the delayed Unlock/Enable.
 */
export function suggestHandler(e: MapEntity, graph?: EntityGraph): HandlerSuggestion {
  const s = suggestHandlerBase(e);
  if (graph && s.type !== 'counterup' && s.type !== 'counterdown') {
    const top = suggestEvents(graph, e)[0];
    if (top) {
      s.event = top.event;
      s.eventReason = top.reason;
    }
    const cd = inferCooldown(graph, e);
    if (cd) {
      s.cooldown = cd.seconds;
      s.cooldownReason = cd.reason;
      if (s.mode === 1) s.mode = 2;
    }
    const limit = fireLimit(e, s.event);
    if (limit) {
      s.maxuses = limit.uses;
      s.maxusesReason = limit.reason;
      s.mode = 3;
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
 * Compare); anything else is an effect and makes the gate a handler candidate.
 */
function gateRole(graph: EntityGraph, x: MapEntity): { role: 'chain-step' | 'pass-through' | 'effects'; passOn: MapEntity[] } {
  let effects = 0;
  const passOn: MapEntity[] = [];
  for (const c of x.connections) {
    const targets = graph.connectionTargets(x, c);
    const self = c.target.toLowerCase() === '!self' || (targets.length > 0 && targets.every((t) => t.id === x.id));
    const logicOnly = targets.length > 0 && targets.every((t) => t.id === x.id || isGate(t) || isCounter(t) || isFilter(t));
    if (isArmInput(c.input) && (self || logicOnly)) continue;
    if (!self && logicOnly && !isGameUi(x)) {
      for (const t of targets) if (t.id !== x.id && !passOn.includes(t)) passOn.push(t);
      continue;
    }
    effects++;
  }
  if (effects > 0) return { role: 'effects', passOn };
  return { role: passOn.length > 0 ? 'pass-through' : 'chain-step', passOn };
}

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
    const { role, passOn } = gateRole(graph, x);
    // a counter that only locks or kills things when it runs out is the item's use count
    if (role === 'chain-step' && !(isCounter(x) && c.fedVia)) {
      skipped.push(`${label(x)} (${x.classname}, only arms or disarms other logic: a step of a key combo, not an ability)`);
      continue;
    }
    if (role === 'pass-through' && !selfCd) {
      // the gate it hands the use to is the one that does something: judge that one instead
      skipped.push(`${label(x)} (${x.classname}, only hands the use on to ${passOn.map(label).join(', ')})`);
      for (const t of passOn) {
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
  const keysPerUi = new Map<number, Set<string>>();
  for (const { c } of chosen) {
    if (!c.key) continue;
    const set = keysPerUi.get(c.key.ui.id) ?? new Set<string>();
    set.add(c.key.key);
    keysPerUi.set(c.key.ui.id, set);
  }

  const triggers: string[] = [];
  const chainIds = new Set<number>([e.id, ...chosen.map(({ c }) => c.entity.id)]);
  // knife / class items: triggers that spawn, strip or land on the knife (found by position, not by name)
  const selection = isKnife(e) ? findSelectionTriggers(graph, e) : [];
  const selectionIds = new Set(selection.map((s) => s.trigger.id));
  for (const c of byOrder) {
    if (!c.entity.classname.startsWith('trigger_') || !c.entity.hammerId) continue;
    if (selectionIds.has(c.entity.id)) continue; // reported below
    const verdict = isActivationTrigger(graph, c.entity, chainIds);
    if (verdict.ok) {
      triggers.push(c.entity.hammerId);
      notes.push(`trigger ${label(c.entity)}: ${c.why}; ${verdict.reason}`);
    } else {
      included.delete(c.entity.id);
      skipped.push(`trigger ${label(c.entity)} (${verdict.reason})`);
    }
  }

  for (const { c, extra } of chosen) {
    const ent = c.entity;
    const s = suggestHandler(ent, graph);
    const h: HandlerConfig = newHandler({
      name: c.key && (keysPerUi.get(c.key.ui.id)?.size ?? 0) >= 2 ? keyLabel(c.key.key) : undefined,
      type: s.type,
      hammerid: ent.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
      cooldown: s.cooldown ?? 0,
      maxuses: s.maxuses ?? 0,
      // CS2Fixes auto-detects templated entities from the _N name suffix; the only value worth
      // writing is "false" for a shared (non-templated) handler of a templated weapon
      templated: e.source.templated && !ent.source.templated ? false : undefined,
    });
    item.handlers.push(h);
    notes.push(`handler ${label(ent)} (${s.type}${s.event ? ' ' + s.event : ''}): ${c.why}${extra ? '; ' + extra : ''}`);
    if (h.templated === false) notes.push(`templated=false: the weapon is spawned by a template but ${label(ent)} is a single map entity`);
    if (s.eventReason && s.event) notes.push(`event ${s.event}: ${s.eventReason}`);
    if (s.cooldownReason) notes.push(`cooldown ${s.cooldown}s: ${s.cooldownReason}`);
    if (s.maxusesReason) notes.push(`maxuses ${s.maxuses}: ${s.maxusesReason}`);
  }
  if (isKnife(e)) {
    if (selection.length === 0) notes.push('knife item: no strip zone tied to it, teleport landing (within 64 units) or template spawner for it was found');
    for (const st of selection) {
      if (!st.trigger.hammerId || triggers.includes(st.trigger.hammerId)) continue;
      triggers.push(st.trigger.hammerId);
      notes.push(`trigger ${label(st.trigger)}: ${st.reason}`);
    }
  }
  for (const sk of skipped) notes.push(`skipped ${sk}`);
  item.triggers = triggers;

  // When a filter / relay / counter handler follows the button, the button entry only needs to hook
  // +use (the GFL convention: {"type": "button", "hammerid": "..."}); messages come from the follow-up.
  const hasFollowUp = item.handlers.some((h) => h.type !== 'button');
  if (hasFollowUp) {
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
  if (item.handlers.length === 0) {
    notes.push(candidates.length === 0
      ? 'Nothing is wired to or grouped with this weapon (no parent, no template, no outputs). Use the I/O search (e.g. "in:unlock") to find the ability entities and add them with "+".'
      : 'No button/filter/relay/counter qualified; see the skipped entries above and add handlers from the tree or the I/O search.');
  }
  return { item, notes };
}
