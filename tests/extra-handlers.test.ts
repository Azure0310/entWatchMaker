import { describe, expect, it } from 'vitest';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon } from '../src/model/suggest';

/**
 * Handlers the GFL configs never list, found on the evaluated maps: the game_ui of an item whose
 * key reaches its relay through another entity, the ammo item's timer-driven give_ammo relay, a
 * button that only shows a "locked" hint, and template set-up logic picked as the lone gate.
 */
type Mk = (classname: string, targetname: string, hammerId: string, props?: Record<string, string>, connections?: EntityConnection[]) => MapEntity;
type Conn = (output: string, target: string, input: string, param?: string, delay?: number) => EntityConnection;
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
  const c: Conn = (output, target, input, param = '', delay = 0) => ({ output, target, targetType: 7, input, param, delay, timesToFire: -1 });
  const entities = build(mk, c);
  return { graph: new EntityGraph(entities), byName: (n) => entities.find((e) => e.targetname === n)! };
}
const ids = (item: { handlers: { hammerid: string }[] }) => item.handlers.map((h) => h.hammerid);

describe('handlers GFL never lists', () => {
  it('leaves the game_ui out when its key reaches the relay through the model', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'shock_template', '300', { template01: 'shock_knife', template02: 'shock_ui', template03: 'shock_model', template04: 'shock_relay' }),
      mk('weapon_knife', 'shock_knife', '5071', { origin: '0 0 0' }, [c('OnPlayerPickup', 'shock_ui', 'Activate')]),
      mk('logic_case', 'shock_ui', '5064', { vscripts: 'game_ui', case16: 'PressedAttack2' }, [c('OnCase16', 'shock_model', 'FireUser1')]),
      mk('prop_dynamic', 'shock_model', '5070', { parentname: 'shock_knife' }, [c('OnUser1', 'shock_relay', 'Trigger')]),
      mk('logic_relay', 'shock_relay', '5065', {}, [
        c('OnTrigger', 'shock_push', 'Enable'),
        c('OnTrigger', 'shock_push', 'Disable', '', 1),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 7),
      ]),
      mk('trigger_push', 'shock_push', '5066', { startdisabled: '1', parentname: 'shock_knife' }),
    ]);
    const { item } = suggestItemForWeapon(byName('shock_knife'), graph);
    expect(ids(item)).toEqual(['5065']);
  });

  it("leaves out the ammo item's give_ammo relay that a timer drives", () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'ammo_template', '300', { template01: 'ammo_wpn', template02: 'ammo_button', template03: 'ammo_filter', template04: 'give_ammo', template05: 'ammo_counter', template06: 'Timer_ammo' }),
      mk('weapon_elite', 'ammo_wpn', '5594', { origin: '0 0 0' }),
      mk('func_button', 'ammo_button', '5595', { parentname: 'ammo_wpn', wait: '1' }, [c('OnPressed', 'ammo_filter', 'TestActivator')]),
      mk('filter_activator_name', 'ammo_filter', '5597', { filtername: 'ammo_user' }, [
        c('OnPass', 'ammo_button', 'Lock'),
        c('OnPass', 'ammo_button', 'Unlock', '', 60),
        c('OnPass', 'Timer_ammo', 'Enable'),
        c('OnPass', 'Timer_ammo', 'Disable', '', 10),
      ]),
      mk('logic_timer', 'Timer_ammo', '11553', { refiretime: '1', startdisabled: '1' }, [c('OnTimer', 'give_ammo', 'Trigger')]),
      mk('logic_relay', 'give_ammo', '11550', {}, [c('OnTrigger', 'ammo_counter', 'Add', '1')]),
      mk('math_counter', 'ammo_counter', '11551', { min: '0', max: '5' }, [
        c('OutValue', 'give_ammo', 'Trigger'),
        c('OnHitMax', 'give_ammo', 'Disable'),
        c('OnHitMax', 'give_ammo', 'Enable', '', 2),
        c('OnHitMax', '!self', 'SetValue', '0'),
      ]),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('ammo_wpn'), graph);
    expect(ids(item)).not.toContain('11550');
    expect(ids(item)).toContain('5597');
    expect(notes.some((n) => n.includes('give_ammo') && n.includes('Timer_ammo'))).toBe(true);
  });

  it('leaves out a second button that only shows a "locked" hint', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'holy_template', '300', { template01: 'holy_wpn', template02: 'holy_button', template03: 'holy_lock', template04: 'holy_filter' }),
      mk('weapon_elite', 'holy_wpn', '1660', { origin: '0 0 0' }),
      mk('func_button', 'holy_button', '1665', { parentname: 'holy_wpn', wait: '1' }, [c('OnPressed', 'holy_filter', 'TestActivator')]),
      mk('func_button', 'holy_lock', '1598', { parentname: 'holy_button', wait: '1' }, [c('OnPressed', 'locked_msg', 'ShowHudHint')]),
      mk('env_hudhint', 'locked_msg', '1599', { message: 'Locked' }),
      mk('filter_activator_context', 'holy_filter', '4861', {}, [
        c('OnPass', 'holy_button', 'Lock'),
        c('OnPass', 'holy_button', 'Unlock', '', 50),
        c('OnPass', 'holy_fx', 'Start'),
      ]),
      mk('info_particle_system', 'holy_fx', '4862', {}),
    ]);
    const { item } = suggestItemForWeapon(byName('holy_wpn'), graph);
    expect(ids(item)).toContain('1665');
    expect(ids(item)).not.toContain('1598');
  });

  it('does not take a relay running OnSpawn or a branch the weapon arms as the lone gate', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'sprint_template', '300', { template01: 'sprint_wpn', template02: 'sprint_button', template03: 'sprint_filter', template04: 'sprint_setup' }),
      mk('weapon_elite', 'sprint_wpn', '9126', { origin: '0 0 0' }, [c('OnUser1', 'sprint_activator', 'SetValue', '1')]),
      mk('func_button', 'sprint_button', '9122', { parentname: 'sprint_wpn', wait: '1' }, [c('OnPressed', 'sprint_filter', 'TestActivator')]),
      mk('filter_activator_name', 'sprint_filter', '9127', { filtername: 'sprint_user' }, [
        c('OnPass', 'sprint_button', 'Lock'),
        c('OnPass', 'sprint_button', 'Unlock', '', 100),
        c('OnPass', '!activator', 'AddOutput', 'runspeed 1.5'),
      ]),
      mk('logic_relay', 'sprint_setup', '9120', {}, [c('OnSpawn', 'sprint_button', 'SetParent', 'sprint_wpn'), c('OnSpawn', 'sprint_fx', 'Start')]),
      mk('info_particle_system', 'sprint_fx', '9121', {}),
    ]);
    const { item } = suggestItemForWeapon(byName('sprint_wpn'), graph);
    expect(ids(item)).toEqual(['9122', '9127']);
  });

  it('drops a key without cooldown beside a key with one', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'dk_template', '300', { template01: 'dk_knife', template02: 'dk_ui', template03: 'dk_attack1', template04: 'dk_attack2' }),
      mk('weapon_knife', 'dk_knife', '6440', { origin: '0 0 0' }, [c('OnPlayerPickup', 'dk_ui', 'Activate')]),
      mk('logic_case', 'dk_ui', '6441', { vscripts: 'game_ui', case15: 'PressedAttack', case16: 'PressedAttack2' }, [
        c('OnCase15', 'dk_attack1', 'Trigger'),
        c('OnCase16', 'dk_attack2', 'Trigger'),
      ]),
      // a plain swing: no cooldown
      mk('logic_relay', 'dk_attack1', '6442', {}, [c('OnTrigger', 'dk_swing_hurt', 'Enable'), c('OnTrigger', 'dk_swing_hurt', 'Disable', '', 0.5)]),
      // the ability: 30 s cooldown
      mk('logic_relay', 'dk_attack2', '6445', {}, [
        c('OnTrigger', 'dk_wave', 'ForceSpawn'),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 30),
      ]),
      mk('trigger_hurt', 'dk_swing_hurt', '6443', { startdisabled: '1', parentname: 'dk_knife' }),
      mk('env_entity_maker', 'dk_wave', '6444', { entitytemplate: 'dk_wave_template' }),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('dk_knife'), graph);
    expect(ids(item)).toEqual(['6445']);
    expect(notes.some((n) => n.includes('dk_attack1') && n.includes('no cooldown or uses'))).toBe(true);
  });

  it('leaves out a physbox that only presses the item button', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'cone_template', '300', { template01: 'cone_wpn', template02: 'cone_phys', template03: 'cone_button', template04: 'cone_filter' }),
      mk('weapon_elite', 'cone_wpn', '4147', { origin: '0 0 0' }),
      mk('func_physbox', 'cone_phys', '4148', { parentname: 'cone_wpn' }, [c('OnPlayerUse', 'cone_button', 'Press')]),
      mk('func_button', 'cone_button', '16906', { parentname: 'cone_wpn', wait: '1' }, [c('OnPressed', 'cone_filter', 'TestActivator')]),
      mk('filter_activator_name', 'cone_filter', '4143', { filtername: 'cone_user' }, [
        c('OnPass', 'cone_button', 'Lock'),
        c('OnPass', 'cone_button', 'Unlock', '', 45),
        c('OnPass', 'cone_maker', 'ForceSpawn'),
      ]),
      mk('env_entity_maker', 'cone_maker', '4144', { entitytemplate: 'cone_prop_template' }),
    ]);
    const { item } = suggestItemForWeapon(byName('cone_wpn'), graph);
    expect(ids(item)).toContain('16906');
    expect(ids(item)).not.toContain('4148');
  });

  it('still takes a lone relay only a script fires', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'potion_template', '300', { template01: 'potion_wpn', template02: 'potion_relay' }),
      mk('weapon_healthshot', 'potion_wpn', '1040', { origin: '0 0 0' }),
      mk('logic_relay', 'potion_relay', '1042', {}, [c('OnTrigger', 'potion_heal', 'Enable'), c('OnTrigger', 'potion_wpn', 'Kill', '', 1)]),
      mk('trigger_hurt', 'potion_heal', '1043', { startdisabled: '1', damage: '-100' }),
    ]);
    const { item } = suggestItemForWeapon(byName('potion_wpn'), graph);
    expect(ids(item)).toEqual(['1042']);
  });

  it('still counts a lone counter the use reaches through a maker', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'electric_template', '300', { template01: 'electric_knife', template02: 'electric_button', template03: 'electric_filter', template04: 'electric_maker', template05: 'electric_counter' }),
      mk('weapon_knife', 'electric_knife', '3409', { origin: '0 0 0' }),
      mk('func_button', 'electric_button', '1637', { parentname: 'electric_knife', wait: '1' }, [c('OnPressed', 'electric_filter', 'TestActivator')]),
      mk('filter_activator_name', 'electric_filter', '3411', { filtername: 'electric_user' }, [
        c('OnPass', 'electric_maker', 'ForceSpawn'),
        c('OnPass', 'electric_maker', 'FireUser1'),
        c('OnPass', 'electric_button', 'Lock'),
        c('OnPass', 'electric_button', 'Unlock', '', 60),
      ]),
      mk('env_entity_maker', 'electric_maker', '3412', { entitytemplate: 'electric_ball_template' }, [c('OnUser1', 'electric_counter', 'Add', '1')]),
      mk('math_counter', 'electric_counter', '3413', { min: '0', max: '3' }, [c('OnHitMax', 'electric_button', 'Kill')]),
    ]);
    const { item } = suggestItemForWeapon(byName('electric_knife'), graph);
    expect(ids(item)).toContain('3413');
  });
});
