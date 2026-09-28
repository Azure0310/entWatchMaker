import { describe, expect, it } from 'vitest';
import type { MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { inferCooldown } from '../src/model/cooldown';

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
});
