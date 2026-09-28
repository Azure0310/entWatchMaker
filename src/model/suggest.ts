import type { EntityGraph } from './graph';
import { friendlyName, type MapEntity } from './entity';
import type { HandlerConfig, HandlerMode, HandlerType, ItemConfig } from './entwatch';
import { newHandler, newItem } from './entwatch';
import { hasSelfCooldown, inferCooldown } from './cooldown';
import { suggestEvents } from './events';
import { findSelectionTriggers, isKnife } from './triggers';

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
  if (cls === 'game_ui') {
    return { type: 'other', event: pick('PressedAttack', 'PlayerOn', 'PressedAttack2'), mode: 2, reason: 'game_ui' };
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

const USE_CLASSES = new Set(['func_button', 'func_rot_button', 'momentary_rot_button', 'func_physbox', 'func_physbox_multiplayer', 'func_physical_button', 'game_ui', 'prop_physics', 'prop_physics_multiplayer', 'prop_physics_override']);
/** The only trigger classes CS2Fixes hooks for the "triggers" list (eban touch block). */
export const HOOKABLE_TRIGGERS = new Set(['trigger_teleport', 'trigger_multiple', 'trigger_once']);
const ENABLE_INPUTS = new Set(['enable', 'unlock', 'open', 'turnon', 'start']);
const GATE_CLASSES = new Set(['logic_relay', 'logic_case', 'logic_branch', 'logic_compare', 'logic_timer']);
const SKIP_CLASSES = new Set(['worldspawn', 'point_template', 'env_entity_maker', 'info_target', 'info_teleport_destination', 'prop_dynamic', 'prop_dynamic_override', 'prop_static', 'light', 'light_spot', 'light_omni', 'env_sprite', 'env_sprite_clientside', 'info_particle_system', 'env_soundscape', 'ambient_generic', 'func_brush', 'func_movelinear', 'func_door', 'func_door_rotating', 'func_tracktrain', 'path_track', 'phys_constraint', 'phys_hinge', 'point_clientcommand', 'point_servercommand', 'game_text', 'env_shake', 'env_fade', 'env_hudhint']);

function isUse(e: MapEntity): boolean {
  return USE_CLASSES.has(e.classname);
}
/** Buttons and touch triggers alike can start an item's chain. */
function isUseLike(e: MapEntity): boolean {
  return USE_CLASSES.has(e.classname) || HOOKABLE_TRIGGERS.has(e.classname);
}

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
    .some((r) => r.kind === 'output' && chain.has(r.other.id) && !r.other.classname.startsWith('weapon_') && !/^kill/i.test(r.connection?.input ?? ''));
  const cooldownChain = suggestEvents(graph, trig).some((g) => g.reason.includes('cooldown chain'));
  if (switchedOn && !feedsChain) return { ok: false, reason: 'effect zone switched on by the item; listing it would make ebanned players immune to it' };
  if (feedsChain) return { ok: true, reason: 'touching it fires the item handlers' };
  if (cooldownChain) return { ok: true, reason: 'touching it starts a cooldown chain' };
  return { ok: false, reason: 'does not fire the item (nothing it outputs reaches a handler)' };
}
function isFilter(e: MapEntity): boolean {
  return e.classname.startsWith('filter_');
}
function isGate(e: MapEntity): boolean {
  return GATE_CLASSES.has(e.classname);
}
function isInteresting(e: MapEntity): boolean {
  return isUse(e) || isFilter(e) || isGate(e) || e.classname === 'math_counter' || e.classname.startsWith('trigger_');
}

function origin(e: MapEntity): [number, number, number] | null {
  const parts = (e.props.origin ?? '').split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1], parts[2]] : null;
}

function distance(a: MapEntity, b: MapEntity): number | null {
  const oa = origin(a);
  const ob = origin(b);
  if (!oa || !ob) return null;
  return Math.hypot(oa[0] - ob[0], oa[1] - ob[1], oa[2] - ob[2]);
}

interface Candidate {
  entity: MapEntity;
  why: string;
  /** 1 direct, 2 sibling (parent / template / lump), 3 one hop from a use-entity or filter, 4 proximity fallback */
  tier: number;
}

/**
 * Builds an item entry for a weapon entity and proposes handlers from related entities.
 *
 * Candidates come from, in order of confidence:
 *   1. entities parented to the weapon, targets of its outputs, entities naming it (filtername),
 *      triggers that Kill it;
 *   2. siblings: children of the weapon's parent (weapon and button both parented to a prop),
 *      members of the same point_template, entities compiled into the same template lump;
 *   3. one hop from buttons / physboxes / game_ui / filters found so far;
 *   4. if nothing usable turned up: entities of interest within 200 units of the weapon.
 * Buttons are always taken; filters and relays only when something already included feeds them
 * or when they carry their own cooldown (Disable then delayed Enable).
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

  const seen = new Set<number>([e.id]);
  const candidates: Candidate[] = [];
  const consider = (other: MapEntity, why: string, tier: number) => {
    if (seen.has(other.id) || SKIP_CLASSES.has(other.classname) || other.classname.startsWith('weapon_')) return;
    seen.add(other.id);
    candidates.push({ entity: other, why, tier });
  };

  // ---- tier 1: direct relations -------------------------------------------------------------
  const PICKUP_OUTPUTS = new Set(['OnPlayerPickup', 'OnNPCPickup', 'OnCacheInteraction']);
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind === 'child') consider(rel.other, `parented to weapon (${rel.label})`, 1);
    else if (rel.kind === 'output') {
      if (rel.connection && PICKUP_OUTPUTS.has(rel.connection.output)) continue;
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

  // ---- tier 3: one hop from use-entities and filters ------------------------------------------
  for (const c of [...candidates]) {
    if (c.tier > 2) continue;
    if (isUse(c.entity)) {
      for (const rel of graph.relationsOf(c.entity)) {
        if (rel.kind === 'output') consider(rel.other, `${label(c.entity)} ${rel.label}`, 3);
        if (rel.kind === 'child') consider(rel.other, `parented to ${label(c.entity)}`, 3);
      }
    } else if (HOOKABLE_TRIGGERS.has(c.entity.classname)) {
      for (const rel of graph.relationsOf(c.entity)) if (rel.kind === 'output') consider(rel.other, `${label(c.entity)} ${rel.label}`, 3);
    } else if (isFilter(c.entity)) {
      for (const rel of graph.relationsOf(c.entity)) if (rel.kind === 'output') consider(rel.other, `${label(c.entity)} ${rel.label}`, 3);
    }
  }

  // ---- tier 4: proximity fallback ------------------------------------------------------------
  const usable = () => candidates.some((c) => isUse(c.entity) || isFilter(c.entity) || isGate(c.entity) || c.entity.classname === 'math_counter');
  if (!usable() && origin(e)) {
    const near = graph.entities
      .filter((x) => x.id !== e.id && isInteresting(x) && (!e.source.templated || x.source.container === e.source.container))
      .map((x) => ({ x, d: distance(e, x) }))
      .filter((p): p is { x: MapEntity; d: number } => p.d !== null && p.d <= 200)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);
    if (near.length > 0) notes.push(`nothing wired to the weapon; looked at ${near.length} entities within 200 units`);
    for (const p of near) consider(p.x, `within ${Math.round(p.d)} units of the weapon`, 4);
  }

  // ---- selection -----------------------------------------------------------------------------
  const included = new Set<number>();
  const fedBy = (x: MapEntity, pred: (from: MapEntity) => boolean) =>
    graph.incomingConnections(x).some(({ from }) => included.has(from.id) && pred(from)) ||
    graph.relationsOf(x).some((r) => (r.kind === 'keyref' || r.kind === 'parent') && included.has(r.other.id) && pred(r.other));
  const fedByIncluded = (x: MapEntity) => fedBy(x, () => true);
  // a relay behind an already chosen filter/relay would just repeat that handler's event
  const redundant = (x: MapEntity) => fedBy(x, (from) => isFilter(from) || isGate(from) || from.classname === 'math_counter');
  const chosen: { c: Candidate; extra?: string }[] = [];
  const skipped: string[] = [];
  const byOrder = [...candidates].sort((a, b) => a.tier - b.tier);

  for (const c of byOrder) if (isUse(c.entity) && c.entity.hammerId) { included.add(c.entity.id); chosen.push({ c }); }
  // touch triggers that start the chain count as feeders (they are confirmed as activation triggers below)
  const touchFeeders = byOrder.filter((c) => HOOKABLE_TRIGGERS.has(c.entity.classname) && c.entity.connections.some((k) => /^on(start)?touch|^ontrigger/i.test(k.output)));
  for (const c of touchFeeders) included.add(c.entity.id);
  for (const c of byOrder) {
    if (!isFilter(c.entity) || !c.entity.hammerId || included.has(c.entity.id)) continue;
    if (c.tier === 1 || fedByIncluded(c.entity)) { included.add(c.entity.id); chosen.push({ c }); }
    else skipped.push(`${label(c.entity)} (filter, not fed by a button)`);
  }
  for (const c of byOrder) {
    const x = c.entity;
    if (!(isGate(x) || x.classname === 'math_counter') || !x.hammerId || included.has(x.id)) continue;
    if (redundant(x)) {
      skipped.push(`${label(x)} (${x.classname}, sits behind a handler that already reports the use)`);
      continue;
    }
    const fed = fedBy(x, isUseLike);
    const selfCd = hasSelfCooldown(graph, x);
    const gateCount = candidates.filter((o) => isGate(o.entity) || o.entity.classname === 'math_counter').length;
    if (fed || selfCd || (c.tier <= 2 && gateCount <= 2)) {
      included.add(x.id);
      chosen.push({ c, extra: fed ? 'fed by a button/trigger' : selfCd ? 'has its own Disable/Enable cooldown' : 'only gate in the group' });
    } else skipped.push(`${label(x)} (${x.classname}, not fed by the item and no cooldown pattern)`);
  }

  const triggers: string[] = [];
  const chainIds = new Set<number>([e.id, ...chosen.map(({ c }) => c.entity.id)]);
  for (const c of byOrder) {
    if (!c.entity.classname.startsWith('trigger_') || !c.entity.hammerId) continue;
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
      type: s.type,
      hammerid: ent.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
      cooldown: s.cooldown ?? 0,
      maxuses: 0,
      // CS2Fixes auto-detects templated entities from the _N name suffix; the only value worth
      // writing is "false" for a shared (non-templated) handler of a templated weapon
      templated: e.source.templated && !ent.source.templated ? false : undefined,
    });
    item.handlers.push(h);
    notes.push(`handler ${label(ent)} (${s.type}${s.event ? ' ' + s.event : ''}): ${c.why}${extra ? '; ' + extra : ''}`);
    if (h.templated === false) notes.push(`templated=false: the weapon is spawned by a template but ${label(ent)} is a single map entity`);
    if (s.eventReason && s.event) notes.push(`event ${s.event}: ${s.eventReason}`);
    if (s.cooldownReason) notes.push(`cooldown ${s.cooldown}s: ${s.cooldownReason}`);
  }
  // knife / class items: strip zone on the knife and teleports landing on it
  if (isKnife(e)) {
    const sel = findSelectionTriggers(graph, e);
    if (sel.length === 0) notes.push('knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)');
    for (const st of sel) {
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
