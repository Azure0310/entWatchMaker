import { describe, expect, it } from 'vitest';
import type { MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { analyzeUse, configSeconds, counterLimit } from '../src/model/cooldown';
import { suggestHandler, suggestItemForWeapon } from '../src/model/suggest';
import { serializeEntWatchConfig } from '../src/model/entwatch';

/**
 * The shape the GFL configs give an item (gflze/CS2-ZE-Configs/entwatch): the mode follows what
 * the use does, short attacks stay out of the chat, a value counter sits behind a plain +use
 * hook, the main attack comes first and only abilities sharing one key get names.
 */

let nextId = 0;
const mk = (classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, connections: MapEntity['connections'] = []): MapEntity => ({
  id: nextId++,
  hammerId,
  classname,
  targetname,
  props: { classname, targetname, hammeruniqueid: hammerId, ...props },
  connections,
  source: { kind: 'vpk', file: 'maps/ze_gfl/entities/default_ents.vents_c', container: 'default_ents', scope: '', templated: false },
});
const c = (output: string, target: string, input: string, param = '', delay = 0, timesToFire = -1) => ({ output, target, targetType: 7, input, param, delay, timesToFire });
const graphOf = (...entities: MapEntity[]) => new EntityGraph(entities);

describe('cooldowns as GFL writes them', () => {
  it('cuts fractions to the second below, keeps halves, rounds a hair under the next second up', () => {
    expect(configSeconds(3.75)).toBe(3);
    expect(configSeconds(2.15)).toBe(2);
    expect(configSeconds(7.5)).toBe(7.5);
    expect(configSeconds(59.9)).toBe(60);
    expect(configSeconds(45)).toBe(45);
    expect(configSeconds(30.02)).toBe(30);
  });
});

describe('the mode follows what the use does', () => {
  it('writes mode 1 with chat off when nothing holds the next use back', () => {
    const button = mk('func_button', 'gun_button', '10', {}, [c('OnPressed', 'gun_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'gun_relay', '11', {}, [c('OnTrigger', 'gun_shooter', 'Shoot')]);
    const g = graphOf(button, relay, mk('env_gunfire', 'gun_shooter', '12'));
    expect(analyzeUse(g, relay, 'OnTrigger')).toEqual({ cooldown: null, closedForGood: [], closedUntilOther: [] });
    expect(suggestHandler(relay, g)).toMatchObject({ mode: 1, cooldown: 0, message: false });
  });

  it('keeps the chat off for an attack of 5 s or less, on for longer cooldowns', () => {
    const quick = mk('logic_relay', 'claw', '20', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 4), c('OnTrigger', 'claw_hurt', 'Enable')]);
    const slow = mk('logic_relay', 'roar', '21', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 40), c('OnTrigger', 'roar_push', 'Enable')]);
    const g = graphOf(quick, slow, mk('trigger_hurt', 'claw_hurt', '22'), mk('trigger_push', 'roar_push', '23'));
    expect(suggestHandler(quick, g)).toMatchObject({ mode: 2, cooldown: 4, message: false });
    expect(suggestHandler(slow, g)).toMatchObject({ mode: 2, cooldown: 40 });
    expect(suggestHandler(slow, g).message).not.toBe(false);
  });

  it('reads max uses from a counter that removes the ability at its limit (skyrim Daedric)', () => {
    const relay = mk('logic_relay', 'nuke_relay', '30', {}, [
      c('OnTrigger', '!self', 'Disable'),
      c('OnTrigger', '!self', 'Enable', '', 60),
      c('OnTrigger', 'nuke_counter', 'Add', '1'),
      c('OnTrigger', 'nuke', 'Enable', '', 5),
    ]);
    const ui = mk('logic_case', 'dr_ui', '31', { vscripts: 'game_ui', case02: 'PressedAttack2' }, [c('OnCase02', 'nuke_relay', 'Trigger')]);
    const counter = mk('math_counter', 'nuke_counter', '32', { min: '0', max: '2', startvalue: '0' }, [c('OnHitMax', 'nuke_relay', 'Kill')]);
    const g = graphOf(relay, ui, counter, mk('trigger_hurt', 'nuke', '33'));
    expect(counterLimit(g, relay, 'OnTrigger')?.uses).toBe(2);
    expect(suggestHandler(relay, g)).toMatchObject({ mode: 3, cooldown: 60, maxuses: 2 });
  });

  it('writes a use that removes the button as single use', () => {
    const button = mk('func_button', 'cade_button', '40', {}, [c('OnPressed', 'cade_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'cade_relay', '41', {}, [c('OnTrigger', 'cade_maker', 'ForceSpawn'), c('OnTrigger', 'cade_button', 'Kill')]);
    const g = graphOf(button, relay, mk('env_entity_maker', 'cade_maker', '42'));
    expect(analyzeUse(g, relay, 'OnTrigger').closedForGood.map((x) => x.entity.targetname)).toEqual(['cade_button']);
    expect(suggestHandler(relay, g)).toMatchObject({ mode: 3, maxuses: 1 });
  });

  it('leaves the cooldown to fill in when other wiring opens the item again without a delay', () => {
    const button = mk('func_button', 'tower_button', '50', {}, [c('OnPressed', 'tower_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'tower_relay', '51', {}, [c('OnTrigger', 'tower_button', 'Lock'), c('OnTrigger', 'tower_maker', 'ForceSpawn')]);
    const done = mk('logic_relay', 'tower_destroyed', '52', {}, [c('OnTrigger', 'tower_button', 'Unlock')]);
    const g = graphOf(button, relay, done, mk('env_entity_maker', 'tower_maker', '53'));
    const s = suggestHandler(relay, g);
    expect(s).toMatchObject({ mode: 2, cooldown: 0 });
    expect(s.cooldownReason).toContain('fill in');
  });
});

describe('the handler list GFL writes', () => {
  it('lists one copy of an ability that has a variant per item level (skyrim Dovahkiin)', () => {
    const weapon = mk('weapon_knife', 'doh_knife', '100', {}, [c('OnPlayerPickup', 'doh_ui', 'Activate')]);
    const ui = mk('logic_case', 'doh_ui', '101', { vscripts: 'game_ui', case01: 'PressedAttack' }, [
      c('OnCase01', 'rynnak', 'Trigger'),
      c('OnCase01', 'rynnak2', 'Trigger'),
      c('OnCase01', 'rynnak3', 'Trigger'),
    ]);
    const variant = (name: string, id: string, delay: number) =>
      mk('logic_relay', name, id, { startdisabled: '1' }, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', delay), c('OnTrigger', 'doh_hurt', 'Enable')]);
    const g = graphOf(weapon, ui, variant('rynnak', '102', 3.75), variant('rynnak2', '103', 3.25), variant('rynnak3', '104', 3.5), mk('trigger_hurt', 'doh_hurt', '105'));
    const { item, notes } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['102']);
    expect(item.handlers[0]).toMatchObject({ cooldown: 3, message: false });
    expect(notes.some((n) => n.includes('rynnak2') && n.includes('item level'))).toBe(true);
  });

  it('names abilities that share one key after what sets their names apart, and puts the main attack first', () => {
    const weapon = mk('weapon_knife', 'dov_knife', '110', {}, [c('OnPlayerPickup', 'dov_ui', 'Activate')]);
    const ui = mk('logic_case', 'dov_ui', '111', { vscripts: 'game_ui', case01: 'PressedAttack2', case02: 'PressedAttack' }, [
      c('OnCase01', 'shout_fire', 'Trigger'),
      c('OnCase01', 'shout_freeze', 'Trigger'),
      c('OnCase02', 'dov_attack', 'Trigger'),
    ]);
    const relay = (name: string, id: string, cd: number) =>
      mk('logic_relay', name, id, {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', cd), c('OnTrigger', 'dov_hurt', 'Enable')]);
    const g = graphOf(weapon, ui, relay('shout_fire', '112', 60), relay('shout_freeze', '113', 70), relay('dov_attack', '114', 3), mk('trigger_hurt', 'dov_hurt', '115'));
    const { item } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => [h.hammerid, h.name])).toEqual([
      ['114', undefined],
      ['112', 'Fire'],
      ['113', 'Freeze'],
    ]);
    expect(item.transfer).toBe(false);
  });

  it('keeps a quick attack next to a longer ability out of the chat (skyrim Healmage)', () => {
    const weapon = mk('weapon_knife', 'mg_knife', '120', {}, [c('OnPlayerPickup', 'mg_ui', 'Activate')]);
    const ui = mk('logic_case', 'mg_ui', '121', { vscripts: 'game_ui', case01: 'PressedAttack', case02: 'PressedAttack2' }, [
      c('OnCase01', 'mg_push_rel', 'Trigger'),
      c('OnCase02', 'mg_kaitse', 'Trigger'),
    ]);
    const relay = (name: string, id: string, cd: number) =>
      mk('logic_relay', name, id, {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', cd), c('OnTrigger', 'mg_push', 'Enable')]);
    const g = graphOf(weapon, ui, relay('mg_push_rel', '122', 8), relay('mg_kaitse', '123', 40), mk('trigger_push', 'mg_push', '124'));
    const { item } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => [h.hammerid, h.cooldown, h.message, h.name])).toEqual([
      ['122', 8, false, undefined],
      ['123', 40, true, undefined],
    ]);
  });

  it('does not report a press twice when it steps a use counter and triggers a relay (skyrim Heal Staff)', () => {
    const weapon = mk('weapon_p250', 'heal_wep', '130');
    const button = mk('func_button', 'heal_button', '131', { parentname: 'heal_wep' }, [c('OnPressed', 'heal_counter', 'Add', '1'), c('OnPressed', 'heal_relay', 'Trigger')]);
    const counter = mk('math_counter', 'heal_counter', '132', { min: '0', max: '2' }, [c('OnHitMax', 'heal_button', 'Kill')]);
    const relay = mk('logic_relay', 'heal_relay', '133', {}, [c('OnTrigger', 'heal_button', 'Lock'), c('OnTrigger', 'heal_button', 'Unlock', '', 20), c('OnTrigger', 'heal_zone', 'Enable')]);
    const g = graphOf(weapon, button, counter, relay, mk('trigger_multiple', 'heal_zone', '134'));
    const { item, notes } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => [h.hammerid, h.type, h.mode])).toEqual([
      ['131', 'button', 1],
      ['132', 'counterup', 3],
    ]);
    expect(item.handlers[1].cooldown).toBe(20);
    expect(notes.some((n) => n.includes('heal_relay') && n.includes('already reports the use'))).toBe(true);
    expect(item.transfer).toBe(true);
  });

  it('lists the counter that holds the item back after N uses instead of the gate stepping it (minas Oil Barrel)', () => {
    const weapon = mk('weapon_knife', 'oil_knife', '150', {}, [c('OnPlayerPickup', 'oil_ui', 'Activate')]);
    const ui = mk('logic_case', 'oil_ui', '151', { vscripts: 'game_ui', case16: 'PressedAttack2' }, [c('OnCase16', 'oil_compare', 'Compare')]);
    const compare = mk('logic_compare', 'oil_compare', '152', { comparevalue: '0', initialvalue: '0' }, [c('OnEqualTo', 'oil_maker', 'ForceSpawn', '', 0.5), c('OnEqualTo', 'oil_counter', 'Add', '1')]);
    const counter = mk('math_counter', 'oil_counter', '153', { min: '0', max: '2', startvalue: '0' }, [
      c('OnHitMax', 'oil_compare', 'SetValue', '1'),
      c('OnHitMax', 'oil_compare', 'SetValue', '0', 60),
      c('OnHitMax', '!self', 'SetValue', '0', 60),
    ]);
    const g = graphOf(weapon, ui, compare, counter, mk('env_entity_maker', 'oil_maker', '154'));
    const { item, notes } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => [h.hammerid, h.type, h.mode, h.cooldown, h.message])).toEqual([['153', 'counterup', 4, 60, true]]);
    expect(notes.some((n) => n.includes('oil_compare') && n.includes('counter reports the use'))).toBe(true);
  });

  it('writes a plain +use hook in front of a counter shown as a value', () => {
    const weapon = mk('weapon_elite', 'ammo_wep', '140');
    const button = mk('func_button', 'ammo_button', '141', { parentname: 'ammo_wep' }, [c('OnPressed', 'ammo_filter', 'TestActivator')]);
    const filter = mk('filter_activator_name', 'ammo_filter', '142', {}, [c('OnPass', 'ammo', 'Subtract', '30'), c('OnPass', 'ammo_shooter', 'Shoot')]);
    const ammo = mk('math_counter', 'ammo', '143', { min: '0', max: '300' });
    const g = graphOf(weapon, button, filter, ammo, mk('env_gunfire', 'ammo_shooter', '144'));
    const { item } = suggestItemForWeapon(weapon, g);
    const text = serializeEntWatchConfig({ items: [item] }, { comments: false });
    const handlers = JSON.parse(text)[0].handlers;
    expect(handlers[0]).toEqual({ type: 'button', hammerid: '141' });
    expect(handlers.some((h: { mode?: number; type?: string }) => h.mode === 5 && h.type === 'counterdown')).toBe(true);
  });
});
