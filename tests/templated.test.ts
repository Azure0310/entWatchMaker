import { describe, expect, it } from 'vitest';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon, suggestItemName } from '../src/model/suggest';

/**
 * Templated items whose use also fires shared map logic (ze_ffvii_mako_reactor_v6_p Electro
 * Materia: the filter counts the use on the item's counter and triggers the boss relay in
 * default_ents). CS2Fixes matches a templated weapon's handlers by template suffix, so the GFL
 * config lists the button and the counter only; the boss relay would need "templated": false.
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
    expect(notes.some((n) => n.includes('boss_electro_relay') && n.includes("outside the item's template"))).toBe(true);
  });

  it('lets a relay that only hands the use on to map logic report the use itself', () => {
    const { graph, byName } = graphWith((mk, c) => [
      mk('point_template', 'bolt_template', '300', { entitylumpname: '300#entityLumpName', origin: '0 0 0', template01: 'bolt_wpn', template02: 'bolt_btn', template03: 'bolt_relay' }, [], 'default_ents'),
      mk('weapon_elite', 'bolt_wpn', '400', { origin: '0 0 0' }),
      mk('func_button', 'bolt_btn', '401', { parentname: 'bolt_wpn', wait: '1' }, [c('OnPressed', 'bolt_relay', 'Trigger')]),
      mk('logic_relay', 'bolt_relay', '402', {}, [c('OnTrigger', 'boss_bolt_relay', 'Trigger')]),
      mk('logic_relay', 'boss_bolt_relay', '2200', { startdisabled: '1' }, [c('OnTrigger', 'boss_hp', 'Subtract', '500'), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 30)], 'default_ents'),
      mk('math_counter', 'boss_hp', '2100', { min: '0', max: '100000' }, [], 'default_ents'),
    ]);
    const { item, notes } = suggestItemForWeapon(byName('bolt_wpn'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['401', '402']);
    expect(item.handlers[1].event).toBe('OnTrigger');
    expect(notes.some((n) => n.includes('bolt_relay') && n.includes('reports the use itself'))).toBe(true);
  });

  it('still writes templated=false for a shared +use entity, which is the thing the player presses', () => {
    expect(suggestItemName({ targetname: 'item_electro_wpn', classname: 'weapon_elite' } as MapEntity).name).toBe('Electro');
  });
});
