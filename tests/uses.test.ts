import { describe, expect, it } from 'vitest';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon } from '../src/model/suggest';

/**
 * Uses the GFL configs count: single-use items (mode 3, maxuses 1) and the counters that count an
 * item's uses or charges and stop its button at their limit ("button + counter").
 */
type Mk = (classname: string, targetname: string, hammerId: string, props?: Record<string, string>, connections?: EntityConnection[]) => MapEntity;
type Conn = (output: string, target: string, input: string, param?: string, delay?: number, timesToFire?: number) => EntityConnection;
function graphWith(build: (mk: Mk, c: Conn) => MapEntity[]): { graph: EntityGraph; byName: (n: string) => MapEntity } {
  let id = 0;
  const mk: Mk = (classname, targetname, hammerId, props = {}, connections = []) => ({
    id: id++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections,
    source: { kind: 'vpk', file: 'maps/x/entities/x.vents_c', container: '300#entityLumpName', scope: '', templated: true },
  });
  const c: Conn = (output, target, input, param = '', delay = 0, timesToFire = -1) => ({ output, target, targetType: 7, input, param, delay, timesToFire });
  const entities = build(mk, c);
  return { graph: new EntityGraph(entities), byName: (n) => entities.find((e) => e.targetname === n)! };
}
const handler = (item: { handlers: { hammerid: string; mode: number; maxuses?: number }[] }, id: string) => item.handlers.find((h) => h.hammerid === id);

/** A summon: button → filter; the filter locks the button for good. The pickup trigger unlocks it once. */
const summon = (extra: (mk: Mk, c: Conn) => MapEntity[] = () => []) =>
  graphWith((mk, c) => [
    mk('point_template', 'summon_template', '300', { template01: 'summon_wpn', template02: 'summon_button', template03: 'summon_filter', template04: 'summon_pick' }),
    mk('weapon_elite', 'summon_wpn', '3787', { origin: '0 0 0' }),
    mk('func_button', 'summon_button', '3788', { parentname: 'summon_wpn', wait: '1', spawnflags: '2049' }, [c('OnPressed', 'summon_filter', 'TestActivator')]),
    mk('filter_activator_name', 'summon_filter', '3793', { filtername: 'summon_user' }, [
      c('OnPass', 'summon_maker', 'ForceSpawn'),
      c('OnPass', 'summon_button', 'Lock'),
    ]),
    mk('env_entity_maker', 'summon_maker', '3792', { entitytemplate: 'summon_beast' }),
    mk('trigger_once', 'summon_pick', '3790', { parentname: 'summon_wpn' }, [c('OnStartTouch', 'summon_button', 'Unlock')]),
    ...extra(mk, c),
  ]);

describe('single-use items', () => {
  it('counts one use when the use locks the button and only the pickup unlocks it', () => {
    const { graph, byName } = summon();
    const { item, notes } = suggestItemForWeapon(byName('summon_wpn'), graph);
    expect(handler(item, '3793')).toMatchObject({ mode: 3, maxuses: 1 });
    expect(notes.some((n) => n.startsWith('maxuses 1: single use') && n.includes('summon_button Lock'))).toBe(true);
  });

  it('does not when something else unlocks the button again', () => {
    const { graph, byName } = summon((mk, c) => [mk('logic_relay', 'stage_reset', '600', {}, [c('OnTrigger', 'summon_button', 'Unlock')])]);
    const { item } = suggestItemForWeapon(byName('summon_wpn'), graph);
    expect(handler(item, '3793')?.maxuses ?? 0).toBe(0);
  });

  it('counts one use when the button kills itself after the press', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'elixir_template', '300', { template01: 'elixir_wpn', template02: 'elixir_button', template03: 'elixir_filter' }),
      mk('weapon_elite', 'elixir_wpn', '16900', { origin: '0 0 0' }),
      mk('func_button', 'elixir_button', '16904', { parentname: 'elixir_wpn', wait: '1' }, [
        c('OnPressed', 'elixir_filter', 'TestActivator'),
        c('OnPressed', '!self', 'Kill', '', 0.05),
      ]),
      mk('filter_activator_attribute_int', 'elixir_filter', '16890', {}, [c('OnPass', '!activator', 'KeyValue', 'health 200', 1)]),
    ]);
    const { item } = suggestItemForWeapon(byName('elixir_wpn'), graph);
    expect(handler(item, '16890')).toMatchObject({ mode: 3, maxuses: 1 });
  });

  it('does not count a kill one random outcome makes, or a stage button killing itself later', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'mimic_template', '300', { template01: 'mimic_wpn', template02: 'mimic_button', template03: 'mimic_filter', template04: 'mimic_case' }),
      mk('weapon_elite', 'mimic_wpn', '346', { origin: '0 0 0' }),
      mk('func_button', 'mimic_button', '343', { parentname: 'mimic_wpn', wait: '1' }, [c('OnPressed', 'mimic_filter', 'TestActivator')]),
      mk('filter_multi', 'mimic_filter', '340', {}, [
        c('OnPass', 'mimic_case', 'PickRandom'),
        c('OnPass', 'mimic_button', 'Lock'),
        c('OnPass', 'mimic_button', 'Unlock', '', 75),
        c('OnPass', 'stage_button', 'FireUser1'),
      ]),
      // one outcome of the random case uses the materia up
      mk('logic_case', 'mimic_case', '235', {}, [c('OnCase02', 'mimic_button', 'Kill'), c('OnCase01', 'mimic_fx', 'Start')]),
      mk('info_particle_system', 'mimic_fx', '236', {}),
      // a stage button the use pokes, which removes itself a minute later
      mk('func_button', 'stage_button', '900', {}, [c('OnUser1', '!self', 'Kill', '', 60), c('OnPressed', 'mimic_filter', 'TestActivator')]),
    ]);
    const { item } = suggestItemForWeapon(byName('mimic_wpn'), graph);
    expect(handler(item, '340')?.maxuses ?? 0).toBe(0);
    expect(handler(item, '340')?.mode).toBe(2);
  });
});

describe('outputs that fire only once', () => {
  const turret = (soundOnly: boolean) =>
    graphWith((mk, c) => [
      mk('point_template', 'turret_template', '300', { template01: 'turret_wpn', template02: 'turret_button', template03: 'turret_filter' }),
      mk('weapon_elite', 'turret_wpn', '1110', { origin: '0 0 0' }),
      mk('func_button', 'turret_button', '1111', { parentname: 'turret_wpn', wait: '1' }, [c('OnPressed', 'turret_filter', 'TestActivator')]),
      mk('filter_multi', 'turret_filter', '6117', {}, [
        c('OnPass', 'turret_fire', 'Trigger', '', 0, soundOnly ? -1 : 1),
        c('OnPass', 'turret_sound', 'StartSound', '', 0, 1),
        c('OnPass', 'turret_break', 'Trigger', '', 35, soundOnly ? -1 : 1),
      ]),
      mk('logic_relay', 'turret_fire', '6119', {}, [c('OnTrigger', 'turret_gun', 'Enable')]),
      mk('logic_relay', 'turret_break', '6120', {}, [c('OnTrigger', 'turret_gun', 'Kill')]),
      mk('point_soundevent', 'turret_sound', '6121', {}),
      mk('trigger_hurt', 'turret_gun', '6122', { startdisabled: '1' }),
    ]);

  it('does not limit the uses for a one-off on the side (the first use sound)', () => {
    const { graph, byName } = turret(true);
    const { item } = suggestItemForWeapon(byName('turret_wpn'), graph);
    expect(handler(item, '6117')?.maxuses ?? 0).toBe(0);
  });

  it('limits them when every output doing something fires only once', () => {
    const { graph, byName } = turret(false);
    const { item } = suggestItemForWeapon(byName('turret_wpn'), graph);
    expect(handler(item, '6117')).toMatchObject({ mode: 3, maxuses: 1 });
  });

  it('does not take a physbox breaking for a use that kills the relay', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'troll_template', '300', { template01: 'troll_knife', template02: 'troll_ui', template03: 'troll_relay', template04: 'troll_phbox' }),
      mk('weapon_knife', 'troll_knife', '29179', { origin: '0 0 0' }, [c('OnPlayerPickup', 'troll_ui', 'Activate')]),
      mk('logic_case', 'troll_ui', '29180', { vscripts: 'game_ui', case16: 'PressedAttack2' }, [c('OnCase16', 'troll_relay', 'Trigger')]),
      mk('logic_relay', 'troll_relay', '29185', {}, [
        c('OnTrigger', 'troll_phbox', 'AddHealth', '1500'),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 35),
      ]),
      // the troll's body: when it breaks, the troll is dead and its ability goes
      mk('func_physbox', 'troll_phbox', '29186', { parentname: 'troll_knife' }, [c('OnBreak', 'troll_relay', 'Kill')]),
    ]);
    const { item } = suggestItemForWeapon(byName('troll_knife'), graph);
    expect(handler(item, '29185')).toMatchObject({ mode: 2, cooldown: 35 });
  });
});

describe('a template mate the chain reaches late', () => {
  it('takes the relay behind filter → compare even when the template listed it first', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'heal_template', '300', { template01: 'heal_wpn', template02: 'heal_relay', template03: 'heal_button', template04: 'heal_filter' }),
      mk('weapon_elite', 'heal_wpn', '758', { origin: '0 0 0' }),
      mk('logic_relay', 'heal_relay', '760', {}, [
        c('OnTrigger', 'heal_button', 'Lock'),
        c('OnTrigger', 'heal_button', 'Unlock', '', 50),
        c('OnTrigger', 'heal_zone', 'FireUser1'),
      ]),
      mk('func_button', 'heal_button', '763', { parentname: 'heal_wpn', wait: '1' }, [c('OnPressed', 'heal_filter', 'TestActivator')]),
      mk('filter_activator_name', 'heal_filter', '762', { filtername: 'heal_user' }, [c('OnPass', 'heal_compare', 'Compare')]),
      mk('trigger_hurt', 'heal_zone', '761', { startdisabled: '1', damage: '-20' }),
      // the map switches the item off and on through the compare's value
      { ...mk('logic_compare', 'heal_compare', '759', { comparevalue: '1', initialvalue: '1' }, [c('OnEqualTo', 'heal_relay', 'Trigger')]), source: { kind: 'vpk', file: 'maps/x/entities/x.vents_c', container: 'default_ents', scope: '', templated: false } } as MapEntity,
      { ...mk('logic_relay', 'materia_disable', '433', {}, [c('OnTrigger', 'heal_compare', 'SetValue', '0')]), source: { kind: 'vpk', file: 'maps/x/entities/x.vents_c', container: 'default_ents', scope: '', templated: false } } as MapEntity,
    ]);
    const { item } = suggestItemForWeapon(byName('heal_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['763', '760']);
    expect(handler(item, '760')).toMatchObject({ mode: 2, cooldown: 50 });
    expect(handler(item, '763')).toMatchObject({ mode: 1 });
  });
});

describe('buttons beside a follow-up', () => {
  it('keeps a second button with its own cooldown reporting its press', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'belmont_template', '300', { template01: 'belmont_wpn', template02: 'belmont_button', template03: 'belmont_button2', template04: 'belmont_case' }),
      mk('weapon_elite', 'belmont_wpn', '792', { origin: '0 0 0' }),
      // the attack: button → case, which does the work
      mk('func_button', 'belmont_button', '6133', { parentname: 'belmont_wpn', wait: '1' }, [c('OnPressed', 'belmont_case', 'PickRandom')]),
      mk('logic_case', 'belmont_case', '797', {}, [c('OnCase01', 'belmont_whip', 'Enable'), c('OnCase01', 'belmont_whip', 'Disable', '', 0.5)]),
      mk('trigger_hurt', 'belmont_whip', '798', { startdisabled: '1' }),
      // the special: a button of its own, locked for 100 s
      mk('func_button', 'belmont_button2', '6135', { parentname: 'belmont_wpn', wait: '1' }, [
        c('OnPressed', 'belmont_holy', 'ForceSpawn'),
        c('OnPressed', '!self', 'Lock'),
        c('OnPressed', '!self', 'Unlock', '', 100),
      ]),
      mk('env_entity_maker', 'belmont_holy', '799', { entitytemplate: 'holy_water' }),
      // a third button with no cooldown: only a +use hook
      mk('func_button', 'belmont_taunt', '6136', { parentname: 'belmont_wpn', wait: '1' }, [c('OnPressed', 'belmont_voice', 'StartSound')]),
      mk('point_soundevent', 'belmont_voice', '6137', {}),
    ]);
    const { item } = suggestItemForWeapon(byName('belmont_wpn'), graph);
    expect(handler(item, '6135')).toMatchObject({ mode: 2, cooldown: 100 });
    expect(handler(item, '6133')).toMatchObject({ mode: 1 });
    expect(handler(item, '6136')?.mode ?? 1).toBe(1);
  });
});

describe('counters that stop the button at their limit', () => {
  it('lists the ammo counter in place of the relay that steps it', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'mines_template', '300', { template01: 'mines_wpn', template02: 'mines_button', template03: 'mines_cd', template04: 'mines_counter' }),
      mk('weapon_elite', 'mines_wpn', '1131', { origin: '0 0 0' }),
      mk('func_button', 'mines_button', '1132', { parentname: 'mines_wpn', wait: '1' }, [c('OnPressed', 'mines_cd', 'Trigger')]),
      mk('logic_relay', 'mines_cd', '7725', {}, [
        c('OnTrigger', 'mines_counter', 'Add', '1'),
        c('OnTrigger', 'mine_maker', 'ForceSpawn'),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 3),
      ]),
      mk('env_entity_maker', 'mine_maker', '7726', { entitytemplate: 'mine_template' }),
      mk('math_counter', 'mines_counter', '1135', { min: '0', max: '6' }, [c('OnHitMax', 'mines_button', 'Kill')]),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('mines_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['1132', '1135']);
    expect(handler(item, '1135')).toMatchObject({ type: 'counterup', mode: 3 });
    expect(notes.some((n) => n.includes('mines_counter counts the uses of mines_button'))).toBe(true);
  });

  it("leaves a boss's HP counter that locks the item when the boss dies alone", () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'heal_template', '300', { template01: 'heal_wpn', template02: 'heal_button', template03: 'heal_relay' }),
      mk('weapon_elite', 'heal_wpn', '401', { origin: '0 0 0' }),
      mk('func_button', 'heal_button', '402', { parentname: 'heal_wpn', wait: '1' }, [c('OnPressed', 'heal_relay', 'Trigger')]),
      mk('logic_relay', 'heal_relay', '403', {}, [
        c('OnTrigger', 'heal_zone', 'Enable'),
        c('OnTrigger', 'boss_hp', 'Subtract', '1'),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 20),
      ]),
      mk('trigger_hurt', 'heal_zone', '404', { startdisabled: '1', damage: '-10' }),
      // the boss: every hit takes HP away, and at 0 all items stop
      mk('math_counter', 'boss_hp', '649', { min: '0', max: '300' }, [c('OnHitMin', 'heal_button', 'Kill')]),
      mk('trigger_multiple', 'boss_hitbox', '650', {}, [c('OnStartTouch', 'boss_hp', 'Subtract', '1')]),
    ]);
    const { item } = suggestItemForWeapon(byName('heal_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).not.toContain('649');
  });

  const flamer = (overheat: boolean) =>
    graphWith((mk, c) => [
      mk('point_template', 'lf_template', '300', { template01: 'lf_wpn', template02: 'lf_button', template03: 'lf_relay', template04: 'lf_counter', template05: 'lf_timer' }),
      mk('weapon_negev', 'lf_wpn', '3828', { origin: '0 0 0' }),
      mk('func_button', 'lf_button', '3835', { parentname: 'lf_wpn', wait: '1' }, [c('OnPressed', 'lf_relay', 'Trigger')]),
      mk('logic_relay', 'lf_relay', '3824', {}, [
        c('OnTrigger', 'lf_timer', 'Enable'),
        c('OnTrigger', 'lf_timer', 'Disable', '', 4),
        c('OnTrigger', 'lf_flames', 'Enable'),
        c('OnTrigger', 'lf_flames', 'Disable', '', 4),
      ]),
      mk('trigger_hurt', 'lf_flames', '3826', { startdisabled: '1', parentname: 'lf_wpn' }),
      mk('logic_timer', 'lf_timer', '3830', { refiretime: '0.5', startdisabled: '1' }, [c('OnTimer', 'lf_counter', 'Add', '1')]),
      // out of fuel: the flame relay stops for good (or, for an overheat, for 10 s)
      mk('math_counter', 'lf_counter', '3829', { min: '0', max: '40' }, [
        c('OnHitMax', 'lf_relay', 'Disable'),
        ...(overheat ? [c('OnHitMax', 'lf_relay', 'Enable', '', 10), c('OnHitMax', '!self', 'SetValue', '0', 10)] : []),
      ]),
    ]);

  it('lists the fuel counter that stops the ability relay for good', () => {
    const { graph, byName } = flamer(false);
    const { item } = suggestItemForWeapon(byName('lf_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toContain('3829');
  });

  it('leaves an overheat that only pauses the relay to the relay', () => {
    const { graph, byName } = flamer(true);
    const { item } = suggestItemForWeapon(byName('lf_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).not.toContain('3829');
    expect(item.handlers.map((h) => h.hammerid)).toContain('3824');
  });

  it('keeps a fuel counter a timer drains', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'flame_template', '300', { template01: 'flame_wpn', template02: 'flame_button', template03: 'flame_relay', template04: 'flame_fuel', template05: 'flame_timer' }),
      mk('weapon_negev', 'flame_wpn', '3931', { origin: '0 0 0' }),
      mk('func_button', 'flame_button', '3933', { parentname: 'flame_wpn', wait: '1' }, [c('OnPressed', 'flame_relay', 'Trigger')]),
      mk('logic_relay', 'flame_relay', '3934', {}, [c('OnTrigger', 'flame_timer', 'Enable'), c('OnTrigger', 'flame_timer', 'Disable', '', 5)]),
      mk('logic_timer', 'flame_timer', '3932', { refiretime: '1', startdisabled: '1' }, [c('OnTimer', 'flame_fuel', 'Subtract', '1')]),
      mk('math_counter', 'flame_fuel', '6894', { min: '0', max: '30', startvalue: '30' }, [c('OnHitMin', 'flame_button', 'Lock')]),
    ]);
    const { item } = suggestItemForWeapon(byName('flame_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toContain('6894');
  });
});
