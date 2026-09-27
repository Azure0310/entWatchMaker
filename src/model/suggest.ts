import type { EntityGraph } from './graph';
import { friendlyName, type MapEntity } from './entity';
import type { HandlerConfig, HandlerMode, HandlerType, ItemConfig } from './entwatch';
import { newHandler, newItem } from './entwatch';
import { inferCooldown } from './cooldown';

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

/** All output names an entity could plausibly fire: its actual connections first, then class defaults. */
export function outputChoices(e: MapEntity): string[] {
  const set = new Set<string>();
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
}

/** Guesses handler type/event, and the cooldown from Lock/Unlock style wiring when a graph is given. */
export function suggestHandler(e: MapEntity, graph?: EntityGraph): HandlerSuggestion {
  const s = suggestHandlerBase(e);
  if (graph && s.type !== 'counterup' && s.type !== 'counterdown') {
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
  [/gravity|void|dark|shadow|black|death|necro/i, 'purple'],
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

/**
 * Builds an item entry for a weapon entity and proposes handlers from directly related entities:
 * buttons/physboxes parented to the weapon, entities the weapon targets, and what those in turn
 * fire into (one hop), keeping the classic weapon -> button -> filter/relay/counter chains.
 */
export function suggestItemForWeapon(e: MapEntity, graph: EntityGraph): { item: ItemConfig; notes: string[] } {
  const notes: string[] = [];
  const { name, shortname } = suggestItemName(e);
  const item = newItem({
    name,
    shortname,
    hammerid: e.hammerId,
    color: suggestColor(friendlyName(e.targetname)),
    templated: e.source.templated ? true : undefined,
  });

  const seen = new Set<number>([e.id]);
  const candidates: { entity: MapEntity; why: string; depth: number }[] = [];
  const consider = (other: MapEntity, why: string, depth: number) => {
    if (seen.has(other.id)) return;
    seen.add(other.id);
    candidates.push({ entity: other, why, depth });
  };

  const PICKUP_OUTPUTS = new Set(['OnPlayerPickup', 'OnNPCPickup', 'OnCacheInteraction']);
  for (const rel of graph.relationsOf(e)) {
    if (rel.kind === 'child') consider(rel.other, `parented to weapon (${rel.label})`, 1);
    else if (rel.kind === 'output') {
      // pickup notifications are not ability uses
      if (rel.connection && PICKUP_OUTPUTS.has(rel.connection.output)) continue;
      consider(rel.other, `weapon output ${rel.label}`, 1);
    } else if (rel.kind === 'keyref-in') consider(rel.other, `references weapon via ${rel.label}`, 1);
    else if (rel.kind === 'input' && rel.other.classname.startsWith('trigger_')) {
      // e.g. a strip trigger firing Kill on the weapon
      consider(rel.other, `fires ${rel.label} on weapon`, 1);
    }
  }
  // one more hop from buttons / physboxes
  for (const c of [...candidates]) {
    if (c.depth !== 1) continue;
    const cls = c.entity.classname;
    const isUse = cls === 'func_button' || cls === 'func_rot_button' || cls.startsWith('func_physbox') || cls === 'game_ui' || cls.startsWith('prop_physics');
    if (!isUse) continue;
    for (const rel of graph.relationsOf(c.entity)) {
      if (rel.kind === 'output') consider(rel.other, `${friendlyName(c.entity.targetname) || cls} ${rel.label}`, 2);
      if (rel.kind === 'child') consider(rel.other, `parented to ${friendlyName(c.entity.targetname) || cls}`, 2);
    }
  }

  const triggers: string[] = [];
  for (const c of candidates) {
    const ent = c.entity;
    const cls = ent.classname;
    if (!ent.hammerId) continue;
    if (cls.startsWith('trigger_')) {
      if (c.depth === 1) {
        triggers.push(ent.hammerId);
        notes.push(`trigger ${friendlyName(ent.targetname) || cls}: ${c.why}`);
      }
      continue;
    }
    const wantsHandler =
      cls === 'func_button' || cls === 'func_rot_button' || cls === 'momentary_rot_button' || cls.startsWith('func_physbox') ||
      cls === 'game_ui' || cls === 'math_counter' || cls.startsWith('filter_') || cls === 'logic_relay' || cls === 'logic_case' ||
      cls === 'logic_branch' || cls === 'logic_compare' || cls === 'logic_timer' || cls.startsWith('prop_physics');
    if (!wantsHandler) continue;
    const s = suggestHandler(ent, graph);
    const h: HandlerConfig = newHandler({
      type: s.type,
      hammerid: ent.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
      cooldown: s.cooldown ?? 0,
      maxuses: 0,
      templated: ent.source.templated && !e.source.templated ? true : undefined,
    });
    item.handlers.push(h);
    notes.push(`handler ${friendlyName(ent.targetname) || cls} (${s.type}${s.event ? ' ' + s.event : ''}): ${c.why}`);
    if (s.cooldownReason) notes.push(`cooldown ${s.cooldown}s: ${s.cooldownReason}`);
  }
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
  if (item.handlers.length === 0) notes.push('No related button/filter/counter found; add handlers from the relation tree.');
  return { item, notes };
}
