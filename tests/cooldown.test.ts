import { describe, expect, it } from 'vitest';
import type { MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { counterUse, inferCooldown } from '../src/model/cooldown';
import { suggestHandler, suggestItemForWeapon } from '../src/model/suggest';

let nextId = 0;
const mk = (classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, connections: MapEntity['connections'] = []): MapEntity => ({
  id: nextId++,
  hammerId,
  classname,
  targetname,
  props: { classname, targetname, hammeruniqueid: hammerId, ...props },
  connections,
  source: { kind: 'vpk', file: 'maps/ze_cd/entities/default_ents.vents_c', container: 'default_ents', scope: '', templated: false },
});
const c = (output: string, target: string, input: string, param = '', delay = 0) => ({ output, target, targetType: 7, input, param, delay, timesToFire: -1 });
const graphOf = (...entities: MapEntity[]) => new EntityGraph(entities);

describe('cooldown: the time until the gates the use goes through are open again', () => {
  it('ignores re-enables from other wiring (a zombie silence) and reads the unlock the use sets off', () => {
    const button = mk('func_button', 'smn_button', '10', { wait: '3' }, [c('OnPressed', 'smn_filter', 'TestActivator')]);
    const filter = mk('filter_activator_name', 'smn_filter', '11', {}, [c('OnPass', 'smn_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'smn_relay', '12', {}, [c('OnTrigger', 'smn_button', 'Lock'), c('OnTrigger', 'smn_button', 'Unlock', '', 45)]);
    const silence = mk('logic_relay', 'zm_silence', '13', {}, [c('OnTrigger', 'smn_relay', 'Disable'), c('OnTrigger', 'smn_relay', 'Enable', '', 8)]);
    const g = graphOf(button, filter, relay, silence);
    const cd = inferCooldown(g, relay, 'OnTrigger');
    expect(cd?.seconds).toBe(45);
    expect(cd?.reason).toContain('smn_button Unlock');
    // the filter in front of the relay gets the same answer
    expect(inferCooldown(g, filter, 'OnPass')?.seconds).toBe(45);
  });

  it('adds up the delays along the chain and rounds float noise', () => {
    const button = mk('func_button', 'b', '20', {}, [c('OnPressed', 'r1', 'Trigger')]);
    const r1 = mk('logic_relay', 'r1', '21', {}, [c('OnTrigger', 'b', 'Lock'), c('OnTrigger', 'r2', 'Trigger', '', 10)]);
    const r2 = mk('logic_relay', 'r2', '22', {}, [c('OnTrigger', 'b', 'Unlock', '', 19.99)]);
    expect(inferCooldown(graphOf(button, r1, r2), r1, 'OnTrigger')?.seconds).toBe(30);
  });

  it('takes the first reopening of a gate past the anti-spam guard', () => {
    const relay = mk('logic_relay', 'disco', '30', {}, [
      c('OnTrigger', '!self', 'Disable'),
      c('OnTrigger', '!self', 'Enable', '', 1),
      c('OnTrigger', '!self', 'Enable', '', 60),
      c('OnTrigger', '!self', 'Enable', '', 63),
    ]);
    expect(inferCooldown(graphOf(relay), relay, 'OnTrigger')?.seconds).toBe(60);
  });

  it('writes no cooldown for a relay that is only re-enabled right away', () => {
    const relay = mk('logic_relay', 'quick', '40', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 2)]);
    expect(inferCooldown(graphOf(relay), relay, 'OnTrigger')).toBeNull();
  });

  it('counts a button wait only above the default reset of 3 seconds', () => {
    const slow = mk('func_button', 'egg', '50', { wait: '45' }, [c('OnPressed', 'egg_relay', 'Trigger')]);
    const plain = mk('func_button', 'plain', '51', { wait: '3' }, [c('OnPressed', 'egg_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'egg_relay', '52');
    const g = graphOf(slow, plain, relay);
    expect(inferCooldown(g, slow)?.seconds).toBe(45);
    expect(inferCooldown(g, plain)).toBeNull();
  });

  it('reads a logic_timer the use enables and whose OnTimer unlocks the button', () => {
    const button = mk('func_button', 'ice_btn', '70', { wait: '3' }, [c('OnPressed', 'ice_ctx', 'TestActivator')]);
    const ctx = mk('filter_activator_context', 'ice_ctx', '71', {}, [c('OnPass', 'ice_btn', 'Lock'), c('OnPass', 'ice_cd', 'Enable')]);
    const timer = mk('logic_timer', 'ice_cd', '72', { refiretime: '50', startdisabled: '1' }, [c('OnTimer', 'ice_btn', 'Unlock'), c('OnTimer', '!self', 'Disable')]);
    const cd = inferCooldown(graphOf(button, ctx, timer), ctx, 'OnPass');
    expect(cd?.seconds).toBe(50);
    expect(cd?.reason).toContain('ice_cd OnTimer → ice_btn Unlock');
  });

  it("does not take a counter's overheat after several uses as the per-use cooldown", () => {
    const button = mk('func_button', 'otto_btn', '80', {}, [c('OnPressed', 'otto_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'otto_relay', '81', {}, [c('OnTrigger', 'otto_btn', 'Lock'), c('OnTrigger', 'otto_btn', 'Unlock', '', 30), c('OnTrigger', 'otto_count', 'Add', '1')]);
    const counter = mk('math_counter', 'otto_count', '82', { min: '0', max: '4' }, [c('OnHitMax', 'otto_relay', 'Disable'), c('OnHitMax', 'otto_relay', 'Enable', '', 60)]);
    expect(inferCooldown(graphOf(button, relay, counter), relay, 'OnTrigger')?.seconds).toBe(30);
  });

  it('reads the lock a key press puts on a button that fires nothing itself', () => {
    const ui = mk('game_ui', 'rocket_ui', '90', {}, [c('PressedAttack', 'rocket_relay', 'Trigger')]);
    const button = mk('func_button', 'rocket_btn', '91', { wait: '0.05' });
    const relay = mk('logic_relay', 'rocket_relay', '92', {}, [c('OnTrigger', 'rocket_btn', 'Lock'), c('OnTrigger', 'rocket_btn', 'Unlock', '', 7.5)]);
    expect(inferCooldown(graphOf(ui, button, relay), button, 'OnPressed')?.seconds).toBe(7.5);
  });

  it('falls back to a gate behind the handler when nothing in front of it closes', () => {
    const ui = mk('logic_case', 'kirito_ui', '60', { vscripts: 'game_ui', case16: 'PressedAttack2' }, [c('OnCase16', 'kirito_branch', 'Test')]);
    const branch = mk('logic_branch', 'kirito_branch', '61', {}, [c('OnTrue', 'kirito_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'kirito_relay', '62', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 12)]);
    // another ability of the item re-arms the branch: not this use's cooldown
    const other = mk('logic_relay', 'kirito_combo', '63', {}, [c('OnTrigger', 'kirito_branch', 'SetValue', '0'), c('OnTrigger', 'kirito_branch', 'SetValue', '1', 6.2)]);
    expect(inferCooldown(graphOf(ui, branch, relay, other), branch, 'OnTrue')?.seconds).toBe(12);
  });

  it('reads a once-only output the use spends and an AddOutput adds back later', () => {
    // ze_last_man_standing_p: the filter fires the button's OnUser4, which fires OnUser1 only once;
    // OnUser1 does the ability and adds OnUser4 → FireUser1 back 30 s later
    const button = mk('func_button', 'zerog_ui', '4470', {}, [
      c('OnPressed', 'zerog_context', 'TestActivator'),
      { ...c('OnUser4', '!self', 'FireUser1'), timesToFire: 1 },
      c('OnUser1', 'zerog_projectile', 'Enable'),
      c('OnUser1', 'zerog_projectile', 'Disable', '', 1),
      c('OnUser1', '!self', 'AddOutput', 'OnUser4>!self>FireUser1>>0>1', 30),
    ]);
    const filter = mk('filter_activator_context', 'zerog_context', '13463', {}, [c('OnPass', 'zerog_ui', 'FireUser4')]);
    const projectile = mk('trigger_push', 'zerog_projectile', '4471', { startdisabled: '1' });
    expect(inferCooldown(graphOf(button, filter, projectile), filter, 'OnPass')?.seconds).toBe(30);
  });
});

describe('counters: uses (announced, mode 3 / 4) or a value (mode 5)', () => {
  it('counts uses when every press steps the counter by one', () => {
    const button = mk('func_button', 'mine_btn', '100', {}, [c('OnPressed', 'mine_filter', 'TestActivator')]);
    const filter = mk('filter_activator_name', 'mine_filter', '101', {}, [c('OnPass', 'mine_count', 'Add', '1'), c('OnPass', 'mine_relayfix', 'Disable'), c('OnPass', 'mine_relayfix', 'Enable', '', 5)]);
    const relay = mk('logic_relay', 'mine_relayfix', '102', {}, [c('OnTrigger', 'mine_filter', 'TestActivator')]);
    const counter = mk('math_counter', 'mine_count', '103', { min: '0', max: '6' }, [c('OnHitMax', 'mine_btn', 'Kill')]);
    const g = graphOf(button, filter, relay, counter);
    expect(counterUse(g, counter)).toMatchObject({ type: 'counterup', afterUses: null });
    const s = suggestHandler(counter, g);
    expect(s).toMatchObject({ type: 'counterup', mode: 3 });
    expect(s.message).not.toBe(false);
  });

  it('writes mode 4 with the lock after the last use as the cooldown', () => {
    const button = mk('func_button', 'electro_btn', '110', {}, [c('OnPressed', 'electro_filter', 'TestActivator')]);
    const filter = mk('filter_activator_name', 'electro_filter', '111', {}, [c('OnPass', 'electro_count', 'Add', '1')]);
    const counter = mk('math_counter', 'electro_count', '112', { min: '0', max: '3' }, [
      c('OnHitMax', 'electro_btn', 'Lock'),
      c('OnHitMax', '!self', 'SetValue', '0'),
      c('OnHitMax', 'electro_btn', 'Unlock', '', 75),
    ]);
    const s = suggestHandler(counter, graphOf(button, filter, counter));
    expect(s).toMatchObject({ type: 'counterup', mode: 4, cooldown: 75 });
  });

  it('keeps a charge a timer refills or a combo meter as a value (mode 5, not announced)', () => {
    const button = mk('func_button', 'cast_btn', '120', {}, [c('OnPressed', 'cast_filter', 'TestActivator')]);
    const filter = mk('filter_activator_name', 'cast_filter', '121', {}, [c('OnPass', 'charge', 'Subtract', '1')]);
    const timer = mk('logic_timer', 'recharge', '122', { refiretime: '1' }, [c('OnTimer', 'charge', 'Add', '1')]);
    const charge = mk('math_counter', 'charge', '123', { min: '0', max: '10' });
    const g1 = graphOf(button, filter, timer, charge);
    expect(counterUse(g1, charge)).toBeNull();
    expect(suggestHandler(charge, g1)).toMatchObject({ mode: 5, message: false });

    const skill = mk('logic_relay', 'skill_relay', '130', {}, [c('OnTrigger', 'combo', 'Add', '1'), c('OnTrigger', 'combo', 'Subtract', '1', 10)]);
    const skillBtn = mk('func_button', 'skill_btn', '131', {}, [c('OnPressed', 'skill_relay', 'Trigger')]);
    const combo = mk('math_counter', 'combo', '132', { min: '0', max: '3' }, [c('OnHitMax', 'ulti_btn', 'Unlock')]);
    expect(counterUse(graphOf(skillBtn, skill, combo), combo)).toBeNull();

    const bigSteps = mk('math_counter', 'ammo', '140', { min: '0', max: '30' });
    const shoot = mk('filter_activator_name', 'shoot_filter', '141', {}, [c('OnPass', 'ammo', 'Subtract', '30')]);
    const shootBtn = mk('func_button', 'shoot_btn', '142', {}, [c('OnPressed', 'shoot_filter', 'TestActivator')]);
    expect(counterUse(graphOf(shootBtn, shoot, bigSteps), bigSteps)).toBeNull();
  });
});

describe('an amount the use only checks is not the handler', () => {
  it('follows GetValue → compare to the outcome that plants, not the "not enough sun" reply', () => {
    const weapon = mk('weapon_p250', 'pea_weapon', '200');
    const button = mk('func_button', 'pea_button', '201', { parentname: 'pea_weapon' }, [c('OnPressed', 'pea_filter', 'TestActivator')]);
    const filter = mk('filter_activator_context', 'pea_filter', '202', {}, [c('OnPass', 'sun_counter', 'GetValue')]);
    const sun = mk('math_counter', 'sun_counter', '203', { min: '0', max: '10000' }, [c('OnGetValue', 'pea_compare', 'SetValue'), c('OnGetValue', 'pea_compare', 'Compare', '', 0.01)]);
    const collect = mk('filter_activator_context', 'sun_collect', '204', {}, [c('OnPass', 'sun_counter', 'Add', '25')]);
    const compare = mk('logic_compare', 'pea_compare', '205', { comparevalue: '100' }, [c('OnLessThan', 'pea_not_ready', 'Trigger'), c('OnEqualTo', 'pea_ready', 'Trigger'), c('OnGreaterThan', 'pea_ready', 'Trigger')]);
    const ready = mk('logic_relay', 'pea_ready', '206', {}, [c('OnTrigger', 'sun_counter', 'Subtract', '100'), c('OnTrigger', 'pea_button', 'Lock'), c('OnTrigger', 'pea_maker', 'ForceSpawn')]);
    const notReady = mk('logic_relay', 'pea_not_ready', '207', {}, [c('OnTrigger', 'pea_model', 'Color', '255 0 0'), c('OnTrigger', 'sound_poor', 'StartSound')]);
    const model = mk('prop_dynamic', 'pea_model', '208');
    const sound = mk('point_soundevent', 'sound_poor', '209');
    const maker = mk('env_entity_maker', 'pea_maker', '210');
    const g = graphOf(weapon, button, filter, sun, collect, compare, ready, notReady, model, sound, maker);
    const { item } = suggestItemForWeapon(weapon, g);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['201', '206']);
    expect(item.handlers[1]).toMatchObject({ event: 'OnTrigger', message: true });
  });
});

describe('charges / fuel shown on the HUD (a counter that locks the button when it runs out)', () => {
  it('lists the ammo counter instead of the relay / branch, and lets the button report the press', () => {
    const weapon = mk('weapon_glock', 'mine_weapon', '300');
    const button = mk('func_button', 'mine_but', '301', { parentname: 'mine_weapon', wait: '1' }, [c('OnPressed', 'mine_filter', 'TestActivator')]);
    const filter = mk('filter_activator_context', 'mine_filter', '302', {}, [c('OnPass', 'mine_relay', 'Trigger')]);
    const relay = mk('logic_relay', 'mine_relay', '303', {}, [c('OnTrigger', 'mine_branch', 'Test')]);
    const branch = mk('logic_branch', 'mine_branch', '304', { initialvalue: '0' }, [c('OnFalse', 'mine_maker', 'ForceSpawn'), c('OnFalse', 'mine_counter', 'Subtract', '1')]);
    const maker = mk('env_entity_maker', 'mine_maker', '305');
    const counter = mk('math_counter', 'mine_counter', '306', { min: '0', max: '6', startvalue: '6' }, [c('OnHitMin', 'mine_but', 'Lock'), c('OnChangedFromMin', 'mine_but', 'Unlock')]);
    const regen = mk('logic_timer', 'mine_add', '307', { refiretime: '15' }, [c('OnTimer', 'mine_counter', 'Add', '1')]);
    const { item } = suggestItemForWeapon(weapon, graphOf(weapon, button, filter, relay, branch, maker, counter, regen));
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['301', '306']);
    expect(item.handlers[0]).toMatchObject({ type: 'button', event: 'OnPressed', mode: 1, message: true, ui: false });
    expect(item.handlers[1]).toMatchObject({ type: 'counterdown', mode: 5, ui: true });
  });

  it('finds a fuel counter only timers touch, and drops a relay the same press sets off', () => {
    const weapon = mk('weapon_glock', 'flame_weapon', '310');
    const button = mk('func_button', 'flame_but', '311', { parentname: 'flame_weapon', wait: '1' }, [c('OnPressed', 'flame_filter', 'TestActivator')]);
    const filter = mk('filter_activator_context', 'flame_filter', '312', {}, [c('OnPass', 'flame_branch', 'Test'), c('OnPass', 'flame_fx_relay', 'Trigger')]);
    const branch = mk('logic_branch', 'flame_branch', '313', { initialvalue: '1' }, [c('OnTrue', 'flame_burn', 'UnpauseTimer'), c('OnFalse', 'flame_burn', 'PauseTimer'), c('OnTrue', '!self', 'SetValue', '0'), c('OnFalse', '!self', 'SetValue', '1')]);
    const fx = mk('logic_relay', 'flame_fx_relay', '314', {}, [c('OnTrigger', 'flame_particle', 'Start')]);
    const particle = mk('info_particle_system', 'flame_particle', '315');
    const burn = mk('logic_timer', 'flame_burn', '316', { refiretime: '1', startdisabled: '1' }, [c('OnTimer', 'flame_counter', 'Subtract', '1')]);
    const refill = mk('logic_timer', 'flame_refill', '317', { refiretime: '15' }, [c('OnTimer', 'flame_counter', 'Add', '1')]);
    const counter = mk('math_counter', 'flame_counter', '318', { min: '0', max: '12', startvalue: '12' }, [c('OnHitMin', 'flame_but', 'Disable'), c('OnChangedFromMin', 'flame_but', 'Enable')]);
    const { item } = suggestItemForWeapon(weapon, graphOf(weapon, button, filter, branch, fx, particle, burn, refill, counter));
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['311', '318']);
    expect(item.handlers[0]).toMatchObject({ mode: 1, message: true, ui: false });
  });
});
