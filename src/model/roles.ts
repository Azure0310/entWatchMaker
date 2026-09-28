import type { EntityConnection, MapEntity } from './entity';

/**
 * What an entity does in an item's wiring, by class and by the outputs it actually fires.
 * Shared by the suggestion, cooldown and trigger heuristics.
 */

/** Entities a holder presses / uses to fire an ability. */
export const USE_CLASSES = new Set([
  'func_button', 'func_rot_button', 'momentary_rot_button', 'func_physbox', 'func_physbox_multiplayer', 'func_physical_button',
  'game_ui', 'prop_physics', 'prop_physics_multiplayer', 'prop_physics_override',
]);
/** The only trigger classes CS2Fixes hooks for the "triggers" list (eban touch block). */
export const HOOKABLE_TRIGGERS = new Set(['trigger_teleport', 'trigger_multiple', 'trigger_once']);
export const GATE_CLASSES = new Set(['logic_relay', 'logic_case', 'logic_branch', 'logic_compare', 'logic_timer']);

/**
 * Inputs that only tidy up or arm/disarm something. A button firing "Kill" or "Disable" at a
 * relay is not using it, and a relay that Enables another relay after a delay is a cooldown,
 * not a chain of handlers.
 */
const HOUSEKEEPING_INPUTS = new Set([
  'kill', 'killhierarchy', 'deactivate', 'disable', 'enable', 'cancelpending', 'lock', 'unlock',
  'clearparent', 'setparent', 'setparentattachment', 'setparentattachmentmaintainoffset',
]);

export function isHousekeepingInput(input: string): boolean {
  return HOUSEKEEPING_INPUTS.has(input.toLowerCase());
}

/** Housekeeping plus the inputs that store a value on a gate: they arm logic, they are not an effect. */
const ARM_INPUTS = new Set([
  ...HOUSEKEEPING_INPUTS,
  'setvalue', 'setvaluenofire', 'setvaluecompare', 'setcomparevalue', 'sethitmax', 'sethitmin', 'setmaxvaluenofire', 'setminvaluenofire',
]);

export function isArmInput(input: string): boolean {
  return ARM_INPUTS.has(input.toLowerCase());
}

/**
 * Which outputs an input causes right away, for following a chain: Trigger fires OnTrigger,
 * FireUser2 fires OnUser2, Test fires OnPass/OnFail, ... Enable / Kill / KeyValues fire nothing.
 * Returns null for inputs it does not know (follow everything).
 */
export function causedOutputs(input: string): ((output: string) => boolean) | null {
  const inp = input.toLowerCase();
  const user = /^fireuser([1-4])$/.exec(inp);
  if (user) {
    const re = new RegExp(`^onuser${user[1]}$`, 'i');
    return (o) => re.test(o);
  }
  for (const [inputs, outputs] of CAUSED) {
    if (inputs.test(inp)) return (o) => outputs.test(o);
  }
  return null;
}

const NOTHING = /$^/;
const CAUSED: [RegExp, RegExp][] = [
  [/^trigger(foractivatedplayer)?$/, /^ontrigger$/i],
  [/^(test|testactivator)$/, /^on(pass|fail|true|false)$/i],
  [/^(invalue|compare|setvaluecompare|setcomparevalue|pickrandom|pickrandomshuffle)$/, /^on(equalto|notequalto|lessthan|greaterthan|case\d\d|default|used)$/i],
  [/^(add|subtract|multiply|divide|setvalue|getvalue|sethitmin|sethitmax)$/, /^(outvalue|onhitmin|onhitmax|onchangedfrommin|onchangedfrommax|ongetvalue|onequalto|onnotequalto|onlessthan|ongreaterthan)$/i],
  [/^(forcespawn|forcespawnatentityorigin|forcespawnatposition|spawnentity)$/, /^onentityspawned$/i],
  [/^findentity$/, /^onfoundentity$/i],
  [/^activate$/, /^(playeron|pressed|unpressed|xaxis|yaxis|attackaxis|attack2axis|oncase\d\d|ondefault)/i],
  [/^(use|press|pressin|pressout)$/, /^on(pressed|in|out|uselocked|playeruse)$/i],
  [/^(open|close|toggle|setposition|setpositionimmediately)$/, /^on(open|close|fullyopen|fullyclosed|reachedposition)$/i],
  [/^firetimer$/, /^ontimer/i],
  [
    /^(enable|disable|kill|killhierarchy|lock|unlock|deactivate|cancelpending|setparent|setparentattachment|setparentattachmentmaintainoffset|clearparent|setvaluenofire|setmaxvaluenofire|setminvaluenofire|keyvalue|keyvalues|addoutput|alpha|color|setdamagefilter|addcontext|removecontext|clearcontext|setanimation|setanimationnotlooping|setdefaultanimation|startsound|stopsound|start|stop|teleport|sethealth|setspeed|break|explode|destroyimmediately|disablemotion|enablemotion|applyscore|startshake|display|runscriptinput|runscriptcode|callscriptfunction|setmeasuretarget|followentity|refiretime|setdisplaytext|setspawnflags|setmodel|setmodelscale|setsize|setteam|setmovetype|setgravity|setcontext|setlocalorigin|setlocalangles|setabsorigin|setabsangles)$/,
    NOTHING,
  ],
];

/** Outputs a button / physbox fires when a player uses it (as opposed to OnBreak / OnHealthChanged). */
const USE_OUTPUTS = new Set([
  'onpressed', 'onunpressed', 'onin', 'onout', 'onuselocked', 'onplayeruse', 'ondamaged', 'onfullyopen', 'onfullyclosed',
  'onreachedposition', 'onphysgunpickup',
]);

const KEY_OUTPUT = /^(pressed|unpressed|playeron|playeroff|xaxis|yaxis|attackaxis|attack2axis)/i;
/**
 * game_ui outputs that mean "the holder pressed a key". PlayerOn / PlayerOff fire when the ui is
 * (de)activated, Unpressed* on release: none of them is an ability use.
 */
const ABILITY_KEY = /^pressed/i;

/**
 * A game_ui, or its VScript stand-in: a logic_case with `vscripts=game_ui` whose caseNN values
 * are the key names (PressedAttack, PressedAttack2, PlayerOn, ...). Both are activated by the
 * weapon's OnPlayerPickup and fire the ability entities per key.
 */
export function isGameUi(e: MapEntity): boolean {
  if (e.classname === 'game_ui') return true;
  if (e.classname !== 'logic_case') return false;
  if (/game_ui/i.test(e.props.vscripts ?? '')) return true;
  for (const [k, v] of Object.entries(e.props)) if (/^case\d\d$/.test(k) && KEY_OUTPUT.test(v)) return true;
  return false;
}

export interface AbilityOutput {
  /** Output name to hook as the handler event (PressedAttack, OnCase02, ...). */
  output: string;
  /** Key the player presses (PressedAttack2, PlayerOn, ...). */
  key: string;
}

/** The outputs of a game_ui(-like) entity that fire on a key press, with the key they stand for. */
export function abilityOutputs(e: MapEntity): AbilityOutput[] {
  const out: AbilityOutput[] = [];
  const seen = new Set<string>();
  if (e.classname === 'game_ui') {
    for (const c of e.connections) {
      if (seen.has(c.output) || !ABILITY_KEY.test(c.output)) continue;
      seen.add(c.output);
      out.push({ output: c.output, key: c.output });
    }
    return out;
  }
  if (e.classname === 'logic_case') {
    for (const c of e.connections) {
      const m = /^oncase(\d\d)$/i.exec(c.output);
      if (!m || seen.has(c.output)) continue;
      const key = e.props[`case${m[1]}`] ?? '';
      if (!ABILITY_KEY.test(key)) continue;
      seen.add(c.output);
      out.push({ output: c.output, key });
    }
  }
  return out;
}

/** "PressedAttack2" -> "Attack2", "PressedMoveLeft" -> "Left": names the handlers of multi-key items. */
export function keyLabel(key: string): string {
  let k = key.replace(/^(pressed|unpressed)/i, '');
  if (/^move(left|right)$/i.test(k)) k = k.replace(/^move/i, '');
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** True when a player pressing / using `e` fires something other than housekeeping. */
export function hasUseOutput(e: MapEntity): boolean {
  if (isGameUi(e)) return abilityOutputs(e).length > 0;
  return e.connections.some((c) => USE_OUTPUTS.has(c.output.toLowerCase()) && !isHousekeepingInput(c.input));
}

export function isUseEntity(e: MapEntity): boolean {
  return USE_CLASSES.has(e.classname) || isGameUi(e);
}

/** Buttons and touch triggers alike can start an item's chain. */
export function isUseLike(e: MapEntity): boolean {
  return isUseEntity(e) || HOOKABLE_TRIGGERS.has(e.classname);
}

export function isFilter(e: MapEntity): boolean {
  return e.classname.startsWith('filter_');
}

export function isGate(e: MapEntity): boolean {
  return GATE_CLASSES.has(e.classname);
}

export function isCounter(e: MapEntity): boolean {
  return e.classname === 'math_counter';
}

/** Connections of `e` that do more than housekeeping. */
export function effectConnections(e: MapEntity): EntityConnection[] {
  return e.connections.filter((c) => !isHousekeepingInput(c.input));
}
