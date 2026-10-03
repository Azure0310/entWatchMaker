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

  it('follows AddOutput to a portal the ability spawns, and the knife clean-up to a rescue teleport', () => {
    const entities = [
      mk('weapon_knife', 'd_knife', '500', { origin: '0 0 0' }, [c('OnPlayerPickup', 'd_ui', 'Activate'), c('OnUser2', 'd_cleanup', 'Trigger')]),
      mk('logic_case', 'd_ui', '501', { vscripts: 'game_ui', case01: 'PressedAttack', origin: '0 0 16' }, [c('OnCase01', 'd_relay', 'Trigger')]),
      // the ability arms the portal maker at run time: nothing in the map wires it statically
      mk('logic_relay', 'd_relay', '502', { origin: '0 0 24' }, [c('OnTrigger', 'd_detect', 'AddOutput', 'OnCase03>d_goto_maker>ForceSpawnAtEntityOrigin>!activator>0>1'), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 90)]),
      mk('logic_case', 'd_detect', '503'),
      mk('env_entity_maker', 'd_goto_maker', '504', { entitytemplate: 'd_goto_tpl', origin: '800 0 0' }),
      mk('point_template', 'd_goto_tpl', '505', { template01: 'd_goto' }, [c('OnEntitySpawned', 'd_goto', 'Enable', '', 4.5)]),
      mk('trigger_multiple', 'd_goto', '506', { origin: '900 0 0', startdisabled: '1' }, [c('OnStartTouch', 'd_back', 'TeleportToCurrentPos')]),
      mk('point_teleport', 'd_back', '507', { origin: '0 20 0' }),
      // when the holder leaves, the clean-up switches on a teleport that frees the grabbed humans
      mk('logic_relay', 'd_cleanup', '508', {}, [c('OnTrigger', 'd_rescue', 'Enable', '', 0.1)]),
      mk('trigger_multiple', 'd_rescue', '509', { origin: '700 0 0', startdisabled: '1' }, [c('OnStartTouch', 'd_grab_tp', 'TeleportToCurrentPos')]),
      mk('point_teleport', 'd_grab_tp', '510', { origin: '0 -30 0' }),
      mk('trigger_teleport', 'd_room_tp', '511', { origin: '2000 0 0', target: 'd_in' }),
      mk('info_teleport_destination', 'd_in', '512', { origin: '0 10 0' }),
    ];
    const g = new EntityGraph(entities);
    const { item } = suggestItemForWeapon(entities[0], g);
    expect(item.triggers).toEqual(['511']);
  });
});
