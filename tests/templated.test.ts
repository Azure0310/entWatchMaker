import { describe, expect, it } from 'vitest';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon, suggestItemName } from '../src/model/suggest';

/**
 * Templated items whose use also fires shared map logic (ze_ffvii_mako_reactor_v6_p Electro
 * Materia: the filter counts the use on the item's counter and triggers the boss relay in
 * default_ents, which Mimic Materia triggers too). The GFL config lists the button and the counter
 * only. Logic in default_ents that only the item drives (ze_minimal, ze_tyranny2: the item's filter
 * or branch) is still the item's: GFL lists it, and CS2Fixes registers such a handler 0.5 s after
 * the weapon spawns (no template suffix, so it needs no "templated": false).
 */
function graphWith(extra: (mk: Mk, c: Conn) => MapEntity[]): { graph: EntityGraph; byName: (n: string) => MapEntity } {
  let id = 0;
  const mk: Mk = (classname, targetname, hammerId, props = {}, connections = [], lump = '300#entityLumpName') => ({
    id: id++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections,
    source: { kind: 'vpk', file: 'maps/x/entities/x.vents_c', container: lump, scope: '', templated: lump !== 'default_ents' },
  });
  const c: Conn = (output, target, input, param = '', delay = 0) => ({ output, target, targetType: 7, input, param, delay, timesToFire: -1 });
  const entities = extra(mk, c);
  const graph = new EntityGraph(entities);
  return { graph, byName: (n) => entities.find((e) => e.targetname === n)! };
}
type Mk = (classname: string, targetname: string, hammerId: string, props?: Record<string, string>, connections?: EntityConnection[], lump?: string) => MapEntity;
type Conn = (output: string, target: string, input: string, param?: string, delay?: number) => EntityConnection;

describe('templated items and shared map logic', () => {
  it('keeps the counter inside the template and leaves the boss relay in default_ents out', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'electro_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'item_electro_wpn', template02: 'item_electro_btn', template03: 'item_electro_filter', template04: 'item_electro_counter' }, [], 'default_ents'),
      mk('weapon_elite', 'item_electro_wpn', '1619', { origin: '0 0 0' }),
      mk('func_button', 'item_electro_btn', '1617', { parentname: 'item_electro_wpn', wait: '1' }, [c('OnPressed', 'item_electro_filter', 'TestActivator')]),
      mk('filter_multi', 'item_electro_filter', '1622', { filter01: 'item_electro_user' }, [
        c('OnPass', 'item_electro_counter', 'Add', '1'),
        c('OnPass', 'boss_electro_relay', 'Trigger'),
        c('OnPass', 'item_electro_btn', 'Lock'),
        c('OnPass', 'item_electro_btn', 'Unlock', '', 3),
      ]),
      mk('math_counter', 'item_electro_counter', '1625', { min: '0', max: '3', startvalue: '0' }, [
        c('OnHitMax', 'item_electro_btn', 'Lock'),
        c('OnHitMax', 'item_electro_btn', 'Unlock', '', 75),
        c('OnHitMax', '!self', 'SetValue', '0', 75),
      ]),
      mk('logic_relay', 'boss_electro_relay', '2133', { startdisabled: '1' }, [c('OnTrigger', 'boss_hp', 'Subtract', '1000'), c('OnTrigger', 'boss_hit_sound', 'StartSound')], 'default_ents'),
      // Mimic Materia (another item's template) casts the same boss relay
      mk('weapon_elite', 'item_mimic_wpn', '346', { origin: '0 0 0' }, [], '345#entityLumpName'),
      mk('func_button', 'item_mimic_btn', '343', { parentname: 'item_mimic_wpn' }, [c('OnPressed', 'item_mimic_case', 'PickRandom')], '345#entityLumpName'),
      mk('logic_case', 'item_mimic_case', '235', {}, [c('OnCase14', 'boss_electro_relay', 'Trigger')], '345#entityLumpName'),
      mk('math_counter', 'boss_hp', '2100', { min: '0', max: '100000' }, [], 'default_ents'),
      mk('snd_event_point', 'boss_hit_sound', '2101', {}, [], 'default_ents'),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('item_electro_wpn'), graph);
    expect(item.name).toBe('Electro');
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['1617', '1625']);
    const counter = item.handlers[1];
    expect(counter.type).toBe('counterup');
    expect(counter.mode).toBe(4);
    expect(counter.cooldown).toBe(75);
    expect(item.handlers.every((h) => h.templated === undefined)).toBe(true);
    expect(notes.some((n) => n.includes('boss_electro_relay') && n.includes('item_mimic_case'))).toBe(true);
  });

  it('lets a relay that only hands the use on to map logic report the use itself', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'bolt_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'bolt_wpn', template02: 'bolt_btn', template03: 'bolt_relay' }, [], 'default_ents'),
      mk('weapon_elite', 'bolt_wpn', '400', { origin: '0 0 0' }),
      mk('func_button', 'bolt_btn', '401', { parentname: 'bolt_wpn', wait: '1' }, [c('OnPressed', 'bolt_relay', 'Trigger')]),
      mk('logic_relay', 'bolt_relay', '402', {}, [c('OnTrigger', 'boss_bolt_relay', 'Trigger')]),
      mk('logic_relay', 'boss_bolt_relay', '2200', { startdisabled: '1' }, [c('OnTrigger', 'boss_hp', 'Subtract', '500'), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 30)], 'default_ents'),
      mk('math_counter', 'boss_hp', '2100', { min: '0', max: '100000' }, [], 'default_ents'),
      mk('logic_timer', 'boss_attack_timer', '2201', { refiretime: '20' }, [c('OnTimer', 'boss_bolt_relay', 'Trigger')], 'default_ents'),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('bolt_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['401', '402']);
    expect(item.handlers[1].event).toBe('OnTrigger');
    expect(notes.some((n) => n.includes('bolt_relay') && n.includes('reports the use itself'))).toBe(true);
  });

  it("keeps the item's own filter in default_ents and ignores a stage turning its branch off", () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'slow_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'slow_wpn', template02: 'slow_button' }, [], 'default_ents'),
      mk('weapon_elite', 'slow_wpn', '500', { origin: '0 0 0' }),
      mk('func_button', 'slow_button', '501', { parentname: 'slow_wpn', wait: '1' }, [c('OnPressed', 'slow_filter', 'TestActivator')]),
      mk('filter_activator_name', 'slow_filter', '502', { filtername: 'slow_user' }, [c('OnPass', 'slow_branch', 'Test')], 'default_ents'),
      mk('logic_branch', 'slow_branch', '503', { initialvalue: '1' }, [
        c('OnTrue', 'slow_button', 'Lock'),
        c('OnTrue', 'slow_button', 'Unlock', '', 40),
        c('OnTrue', 'slow_fx', 'Start'),
      ], 'default_ents'),
      mk('info_particle_system', 'slow_fx', '504', {}, [], 'default_ents'),
      // a stage door and the boss fight switch the item off and on again
      mk('trigger_once', 'stage_door', '600', {}, [c('OnTrigger', 'slow_branch', 'SetValue', '0')], 'default_ents'),
      mk('logic_relay', 'boss_end', '601', {}, [c('OnTrigger', 'slow_branch', 'SetValue', '1')], 'default_ents'),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('slow_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toContain('503');
    expect(notes.some((n) => n.includes('map logic the item feeds'))).toBe(false);
  });

  it("leaves out a counter the map's timers drive too", () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'clump_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'clump_knife', template02: 'clump_ui', template03: 'clump_relay' }, [], 'default_ents'),
      mk('weapon_knife', 'clump_knife', '700', { origin: '0 0 0' }, [c('OnPlayerPickup', 'clump_ui', 'Activate')]),
      mk('game_ui', 'clump_ui', '701', { fieldofview: '-1' }, [c('PressedAttack2', 'clump_relay', 'Trigger')]),
      mk('logic_relay', 'clump_relay', '702', {}, [
        c('OnTrigger', 'sanity_counter', 'Subtract', '10'),
        c('OnTrigger', '!self', 'Disable'),
        c('OnTrigger', '!self', 'Enable', '', 50),
      ]),
      // the zombie's hurt zone takes sanity away from the humans it touches
      mk('trigger_multiple', 'clump_hurt', '703', { parentname: 'clump_knife', spawnflags: '1' }, [c('OnStartTouch', 'sanity_counter', 'Subtract', '5')]),
      mk('math_counter', 'sanity_counter', '800', { min: '0', max: '100', startvalue: '100' }, [c('OnHitMin', 'sanity_zero_relay', 'Trigger')], 'default_ents'),
      mk('logic_relay', 'sanity_zero_relay', '801', {}, [c('OnTrigger', 'player_hurt', 'Enable')], 'default_ents'),
      mk('trigger_hurt', 'player_hurt', '802', { startdisabled: '1' }, [], 'default_ents'),
      mk('logic_timer', 'sanity_timer', '803', { refiretime: '5' }, [c('OnTimer', 'sanity_counter', 'Subtract', '1')], 'default_ents'),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('clump_knife'), graph);
    expect(item.handlers.map((h) => h.hammerid)).not.toContain('800');
    expect(item.handlers.map((h) => h.hammerid)).toContain('702');
    expect(notes.some((n) => n.includes('sanity_counter') && n.includes('sanity_timer'))).toBe(true);
  });

  it('keeps a counter the item loops through when only pickups it spawns add to it', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'fan_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'fan_wpn', template02: 'fan_button' }, [], 'default_ents'),
      mk('weapon_p250', 'fan_wpn', '900', { origin: '0 0 0' }),
      mk('func_button', 'fan_button', '901', { parentname: 'fan_wpn', wait: '1' }, [c('OnPressed', 'fan_filter', 'TestActivator')]),
      mk('filter_activator_context', 'fan_filter', '902', {}, [c('OnPass', 'fan_counter', 'GetValue')], 'default_ents'),
      mk('math_counter', 'fan_counter', '903', { min: '0', max: '300' }, [c('OnGetValue', 'fan_ready_compare', 'SetValueCompare')], 'default_ents'),
      mk('logic_compare', 'fan_ready_compare', '904', { comparevalue: '100' }, [c('OnGreaterThan', 'fan_ready_relay', 'Trigger'), c('OnEqualTo', 'fan_ready_relay', 'Trigger')], 'default_ents'),
      mk('logic_relay', 'fan_ready_relay', '905', {}, [
        c('OnTrigger', 'fan_counter', 'Subtract', '100'),
        c('OnTrigger', 'fan_button', 'Lock'),
        c('OnTrigger', 'fan_button', 'Unlock', '', 60),
      ], 'default_ents'),
      // the sun the fan drops is collected through a filter nothing in the map fires
      mk('filter_activator_context', 'fan_collect_filter', '906', {}, [c('OnPass', 'fan_counter', 'Add', '25')], 'default_ents'),
    ]);
    const { item } = suggestItemForWeapon(byName('fan_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toContain('905');
  });

  it('still writes templated=false for a shared +use entity, which is the thing the player presses', () => {
    expect(suggestItemName({ targetname: 'item_electro_wpn', classname: 'weapon_elite' } as MapEntity).name).toBe('Electro');
  });
});
