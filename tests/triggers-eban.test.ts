import { describe, expect, it } from 'vitest';
import type { MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { findSelectionTriggers } from '../src/model/triggers';
import { suggestItemForWeapon } from '../src/model/suggest';

let nextId = 0;
const mk = (classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, connections: MapEntity['connections'] = [], lump?: string): MapEntity => ({
  id: nextId++,
  hammerId,
  classname,
  targetname,
  props: { classname, targetname, hammeruniqueid: hammerId, ...props },
  connections,
  source: { kind: 'vpk', file: 'maps/ze_t/entities/default_ents.vents_c', container: lump ?? 'default_ents', scope: '', templated: !!lump },
});
const c = (output: string, target: string, input: string, param = '', delay = 0) => ({ output, target, targetType: 7, input, param, delay, timesToFire: -1 });

/**
 * "triggers" keeps ebanned players from touching them. Only the triggers that hand the item out
 * belong there; a stage start that also spawns items, or a zombie's portal, does not.
 */
describe('eban triggers: what hands the item out, not the stage or the ability', () => {
  it('lists a trigger that spawns only this item, not a stage start that spawns several', () => {
    const entities = [
      mk('point_template', 'a_tpl', '300', { template01: 'a_knife' }),
      mk('env_entity_maker', 'a_maker', '301', { entitytemplate: 'a_tpl', origin: '0 0 0' }),
      mk('weapon_knife', 'a_knife', '302', { origin: '10 0 0' }, [], '300#entityLumpName'),
      mk('point_template', 'b_tpl', '310', { template01: 'b_knife' }),
      mk('env_entity_maker', 'b_maker', '311', { entitytemplate: 'b_tpl', origin: '1000 0 0' }),
      mk('weapon_knife', 'b_knife', '312', { origin: '10 0 0' }, [], '310#entityLumpName'),
      mk('func_door', 'stage_gate', '313'),
      mk('trigger_once', 'stage_start', '320', { origin: '5000 0 0' }, [c('OnStartTouch', 'a_maker', 'ForceSpawn'), c('OnStartTouch', 'b_maker', 'ForceSpawn'), c('OnStartTouch', 'stage_gate', 'Open')]),
      mk('trigger_multiple', 'a_get', '321', { origin: '6000 0 0' }, [c('OnTrigger', 'a_maker', 'ForceSpawn')]),
      // a room trigger that opens the treasury door and spawns the boss item on the way
      mk('trigger_once', 'treasury_once', '322', { origin: '7000 0 0' }, [c('OnTrigger', 'stage_gate', 'Open'), c('OnTrigger', 'a_maker', 'ForceSpawn')]),
    ];
    const g = new EntityGraph(entities);
    const ids = findSelectionTriggers(g, entities[2]).map((s) => s.trigger.hammerId);
    expect(ids).toContain('321');
    expect(ids).not.toContain('320');
    expect(ids).not.toContain('322');
  });

  it("skips a teleport the item's own ability switches on (a zombie pulling humans in)", () => {
    const entities = [
      mk('weapon_knife', 'z_knife', '400', { origin: '0 0 0' }, [c('OnPlayerPickup', 'z_ui', 'Activate')]),
      mk('logic_case', 'z_ui', '401', { vscripts: 'game_ui', case01: 'PressedAttack', origin: '0 0 16' }, [c('OnCase01', 'z_relay', 'Trigger')]),
      mk('logic_relay', 'z_relay', '402', { origin: '0 0 24' }, [c('OnTrigger', 'z_portal', 'Enable'), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 30)]),
      mk('trigger_teleport', 'z_portal', '403', { origin: '500 0 0', target: 'z_dest', startdisabled: '1' }),
      mk('info_teleport_destination', 'z_dest', '404', { origin: '0 10 0' }),
      mk('trigger_teleport', 'z_room_tp', '405', { origin: '2000 0 0', target: 'z_in' }),
      mk('info_teleport_destination', 'z_in', '406', { origin: '0 -20 0' }),
    ];
    const g = new EntityGraph(entities);
    const { item, notes } = suggestItemForWeapon(entities[0], g);
    expect(item.triggers).toEqual(['405']);
    expect(notes.some((n) => n.includes('z_portal') && n.includes("item's own logic switches it on"))).toBe(true);
  });
});
