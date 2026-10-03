import type { MapEntity, ParsedMap } from './entity';

/**
 * A small hand-written map that mimics typical Zombie Escape item setups so the UI can be
 * explored without map files. The layouts copy what workshop maps do: prop-parented buttons,
 * point_template lumps (with and without the &0000 name fixup), game_ui implemented as a
 * logic_case script, strip zones through point_entity_finder / point_script, and selection
 * room teleports.
 */
function lumpFor(hammerId: string): string {
  const n = parseInt(hammerId, 10);
  if (n >= 2500 && n < 2600) return '2500#entityLumpName';
  if (n >= 2100) return 'demo_template_3';
  if (n >= 2000) return 'demo_template_2';
  return 'demo_template_1';
}

export function buildDemoMap(): ParsedMap {
  let id = 0;
  const mk = (
    classname: string,
    targetname: string,
    hammerId: string,
    props: Record<string, string> = {},
    connections: MapEntity['connections'] = [],
    templated = false,
  ): MapEntity => ({
    id: id++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections,
    source: { kind: 'vpk', file: 'maps/ze_demo/entities/default_ents.vents_c', container: templated ? lumpFor(hammerId) : 'default_ents', scope: '', templated },
  });
  const c = (output: string, target: string, input: string, param = '', delay = 0, timesToFire = -1) => ({ output, target, targetType: 7, input, param, delay, timesToFire });

  const entities: MapEntity[] = [
    mk('worldspawn', '', '1', { skyname: 'sky_day01_01' }),
    // Fire materia: knife + button + filter + relay
    mk('weapon_knife', 'fire_weapon', '1201', { origin: '128 64 32', spawnflags: '1' }, [c('OnPlayerPickup', 'fire_pickup_relay', 'Trigger')]),
    mk('func_button', 'fire_button', '1202', { parentname: 'fire_weapon', spawnflags: '1024', wait: '1' }, [c('OnPressed', 'fire_filter', 'TestActivator')]),
    mk('filter_activator_name', 'fire_filter', '1203', { filtername: 'fire_weapon', negated: '0' }, [c('OnPass', 'fire_relay', 'Trigger'), c('OnPass', 'fire_button', 'Lock'), c('OnPass', 'fire_button', 'Unlock', '', 45)]),
    mk('logic_relay', 'fire_relay', '1204', {}, [c('OnTrigger', 'fire_particle', 'Start'), c('OnTrigger', 'fire_hurt', 'Enable'), c('OnTrigger', 'fire_hurt', 'Disable', '', 5)]),
    mk('logic_relay', 'fire_pickup_relay', '1205', {}, [c('OnTrigger', 'fire_hud', 'Display')]),
    mk('info_particle_system', 'fire_particle', '1206', { effect_name: 'particles/fire.vpcf' }),
    mk('trigger_hurt', 'fire_hurt', '1207', { damage: '500', parentname: 'fire_weapon', startdisabled: '1' }),
    mk('game_text', 'fire_hud', '1208', { message: 'Fire materia picked up' }),
    mk('trigger_multiple', 'fire_strip_trigger', '1209', { filtername: 'fire_filter', wait: '1' }, [c('OnStartTouch', 'fire_weapon', 'Kill')]),
    // Ice materia: templated, counter based charges
    mk('point_template', 'ice_template', '1300', { entitylumpname: 'demo_template_1', template01: 'ice_weapon', template02: 'ice_button', template03: 'ice_counter', template04: 'ice_case' }, [c('OnEntitySpawned', 'ice_case', 'InValue', '1')]),
    mk('weapon_deagle', 'ice_weapon', '1301', { origin: '-256 64 32' }, [], true),
    mk('func_button', 'ice_button', '1302', { parentname: 'ice_weapon', spawnflags: '1024', wait: '2' }, [c('OnPressed', 'ice_counter', 'Subtract', '1')], true),
    mk('math_counter', 'ice_counter', '1303', { min: '0', max: '3', startvalue: '3' }, [c('OnHitMin', 'ice_button', 'Lock'), c('OutValue', 'ice_case', 'InValue')], true),
    mk('logic_case', 'ice_case', '1304', { case01: '0', case02: '1', case03: '2', case04: '3' }, [c('OnCase01', 'ice_freeze', 'Enable')], true),
    mk('trigger_multiple', 'ice_freeze', '1305', { parentname: 'ice_weapon', startdisabled: '1' }, [c('OnStartTouch', '!activator', 'AddOutput', 'gravity 0.1')], true),
    // Heal: physbox + game_ui, the ability relay behind the ui carries the cooldown
    mk('weapon_p90', 'heal_weapon', '1400', { origin: '512 -64 32' }),
    mk('func_physbox_multiplayer', 'heal_physbox', '1401', { parentname: 'heal_weapon' }, [c('OnPlayerUse', 'heal_ui', 'Activate')]),
    mk('game_ui', 'heal_ui', '1402', { fieldofview: '-1' }, [c('PressedAttack', 'heal_relay', 'Trigger'), c('PlayerOff', 'heal_ui', 'Deactivate')]),
    mk('logic_relay', 'heal_relay', '1403', {}, [c('OnTrigger', 'heal_hurt', 'Enable'), c('OnTrigger', 'heal_hurt', 'Disable', '', 3), c('OnTrigger', 'heal_relay', 'Disable'), c('OnTrigger', 'heal_relay', 'Enable', '', 60)]),
    mk('trigger_hurt', 'heal_hurt', '1404', { damage: '-100', startdisabled: '1', parentname: 'heal_weapon' }),
    // Sleep materia (template style, like many workshop maps): weapon and button are both parented to a
    // prop, the relay is only linked through the point_template and carries its own cooldown.
    mk('point_template', 'sleep_template', '2000', { entitylumpname: 'demo_template_2', template01: 'sleep_prop', template02: 'sleep_weapon', template03: 'sleep_button', template04: 'sleep_relay' }),
    mk('prop_dynamic', 'sleep_prop', '2001', { model: 'models/materia.vmdl' }, [], true),
    mk('weapon_elite', 'sleep_weapon', '2002', { parentname: 'sleep_prop' }, [], true),
    mk('func_button', 'sleep_button', '2003', { parentname: 'sleep_prop', spawnflags: '1024', wait: '1' }, [c('OnPressed', 'sleep_relay', 'Trigger')], true),
    mk('logic_relay', 'sleep_relay', '2004', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 60), c('OnTrigger', 'sleep_zone', 'Enable'), c('OnTrigger', 'sleep_zone', 'Disable', '', 8)], true),
    mk('trigger_multiple', 'sleep_zone', '2005', { startdisabled: '1', parentname: 'sleep_prop' }, [c('OnStartTouch', '!activator', 'SetSpeed', '0.3')], true),
    // Gravity: weapon and a self-cooling relay share a template lump but nothing references anything
    mk('point_template', 'gravity_template', '2100', { entitylumpname: 'demo_template_3', template01: 'gravity_weapon', template02: 'gravity_relay' }),
    mk('weapon_mac10', 'gravity_weapon', '2101', { origin: '900 900 0' }, [], true),
    mk('logic_relay', 'gravity_relay', '2102', { origin: '910 900 0' }, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 45), c('OnTrigger', '!activator', 'AddOutput', 'gravity 0.2')], true),
    // Push materia: fired by touching a trigger parented to the weapon (activation trigger), the relay
    // carries the cooldown; the push zone it switches on is an effect zone and must not be listed.
    mk('weapon_awp', 'push_weapon', '2200', { origin: '-900 900 0' }),
    mk('trigger_multiple', 'push_trigger', '2201', { parentname: 'push_weapon', wait: '1', spawnflags: '1' }, [c('OnStartTouch', 'push_relay', 'Trigger')]),
    mk('logic_relay', 'push_relay', '2202', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 30), c('OnTrigger', 'push_zone', 'Enable'), c('OnTrigger', 'push_zone', 'Disable', '', 3)]),
    mk('trigger_multiple', 'push_zone', '2203', { startdisabled: '1', parentname: 'push_weapon' }, [c('OnStartTouch', '!activator', 'AddOutput', 'basevelocity 0 0 400')]),
    // Nazgul (class item): a knife on the ground under a strip zone parented to it, reached by a
    // teleport from a selection room; a second selection trigger strips + fires a point_teleport onto
    // the same spot. Abilities are relays behind a button parented to the knife. A spawn strip far
    // away must not be listed.
    mk('weapon_knife', 'nazgul_weapon', '2400', { origin: '5000 5000 0' }),
    mk('trigger_multiple', 'nazgul_strip', '2401', { origin: '5000 5000 8', wait: '0.1', parentname: 'nazgul_weapon' }, [c('OnStartTouch', 'strip_all', 'Strip')]),
    mk('player_weaponstrip', 'strip_all', '2402', { origin: '0 0 -500' }),
    mk('trigger_teleport', 'nazgul_tp', '2403', { origin: '-5000 -5000 0', target: 'nazgul_dest' }),
    mk('info_teleport_destination', 'nazgul_dest', '2404', { origin: '5000 5010 0' }),
    mk('trigger_multiple', 'nazgul_tp2', '2405', { origin: '-5000 -4800 0' }, [c('OnStartTouch', 'strip_all', 'Strip'), c('OnStartTouch', 'nazgul_point_tp', 'Teleport')]),
    mk('point_teleport', 'nazgul_point_tp', '2406', { origin: '5010 4990 0', target: '!activator' }),
    mk('func_button', 'nazgul_button', '2407', { parentname: 'nazgul_weapon', spawnflags: '1024', wait: '1' }, [c('OnPressed', 'nazgul_relay', 'Trigger')]),
    mk('logic_relay', 'nazgul_relay', '2408', {}, [c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 25), c('OnTrigger', '!activator', 'SetHealth', '500')]),
    mk('trigger_multiple', 'spawn_strip', '2410', { origin: '0 0 0' }, [c('OnStartTouch', 'strip_all', 'Strip')]),
    // Wolf (zombie class item spawned by a template, the skyrim layout): a trigger_teleport in the
    // selection room ForceSpawns an env_entity_maker; the child lump has local coordinates and the
    // &0000 name fixup. The game_ui is a logic_case running the game_ui script; its OnCaseNN outputs
    // fire the ability relays. A trigger_once above the knife strips through a point_entity_finder.
    mk('point_template', 'ww_template', '2500', { origin: '-9360 -3200 -5336', entitylumpname: '2500#entityLumpName', templatefixup: '1', spawnflags: '0', template01: '[PR#]ww_ui', template02: '[PR#]ww_relay', template03: '[PR#]ww_knife', template04: '[PR#]ww_strip', template05: '[PR#]ww_knife_stripper', template06: '[PR#]ww_knife_filters', template07: '[PR#]ww_shout', template08: '[PR#]ww_attk' }),
    mk('env_entity_maker', 'ww_maker', '2501', { origin: '-9376 -3200 -5336', entitytemplate: '[PR#]ww_template' }),
    mk('trigger_teleport', 'ww_tele', '2502', { origin: '13695 -15179 2675', target: '[PR#]ww_in', filtername: 'level1_t_item_filter', spawnflags: '1' }, [c('OnStartTouch', '[PR#]ww_maker', 'ForceSpawn'), c('OnStartTouch', '!self', 'Disable')]),
    mk('info_teleport_destination', 'ww_in', '2503', { origin: '-9301 -3314 -5340' }),
    mk('logic_case', '[PR#]ww_ui&0000', '2510', { origin: '16 0 0', vscripts: 'game_ui', case01: 'PressedAttack', case02: 'PressedAttack2' }, [c('OnCase01', '[PR#]ww_relay&0000', 'Trigger'), c('OnCase02', '[PR#]ww_shout&0000', 'Trigger')], true),
    mk('logic_relay', '[PR#]ww_relay&0000', '2511', { origin: '32 0 0' }, [c('OnTrigger', '[PR#]ww_attk&0000', 'Enable', '', 0.3), c('OnTrigger', '[PR#]ww_attk&0000', 'Disable', '', 0.7), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 2)], true),
    mk('logic_relay', '[PR#]ww_shout&0000', '2512', { origin: '64 0 0' }, [c('OnTrigger', '!activator', 'KeyValue', 'movetype 1'), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 25)], true),
    mk('weapon_knife', '[PR#]ww_knife&0000', '2513', { origin: '59 -114 12', spawnflags: '1' }, [c('OnPlayerPickup', '[PR#]ww_ui&0000', 'Activate'), c('OnPlayerPickup', '!activator', 'KeyValue', 'health 10000')], true),
    mk('trigger_hurt', '[PR#]ww_attk&0000', '2514', { origin: '12 -116 56', parentname: '[PR#]ww_knife&0000', startdisabled: '1', damage: '150' }, [], true),
    mk('trigger_once', '[PR#]ww_strip&0000', '2515', { origin: '62 -114 60', spawnflags: '4097' }, [c('OnStartTouch', '[PR#]ww_knife_stripper&0000', 'FindEntity', '', 0, 1)], true),
    mk('point_entity_finder', '[PR#]ww_knife_stripper&0000', '2516', { origin: '-41 -31 -3', filtername: '[PR#]ww_knife_filters&0000' }, [c('OnFoundEntity', '!caller', 'Kill')], true),
    mk('filter_activator_name', '[PR#]ww_knife_filter_a&0000', '2517', { origin: '-41 1 -3', filtername: '[PR#]ww_knife&0000', negated: '1' }, [], true),
    mk('filter_multi', '[PR#]ww_knife_filters&0000', '2518', { origin: '-41 -15 -3', filter01: '[PR#]ww_knife_filter_a&0000', filter02: 'knife_class_filter' }, [], true),
    // Dragon (human class item, skyrim layout without a template): same game_ui script, the physbox on
    // the knife only tidies up on OnBreak, the negated name filter belongs to the knife-removal wiring,
    // and a teleport from the selection room lands next to the knife.
    mk('weapon_knife', 'dragon_knife', '2600', { origin: '-8704 -4544 -5226', spawnflags: '1' }, [c('OnPlayerPickup', 'dragon_ui', 'Activate'), c('OnPlayerPickup', '!activator', 'KeyValue', 'health 50000')]),
    mk('logic_case', 'dragon_ui', '2601', { origin: '-8720 -4540 -5240', vscripts: 'game_ui', case01: 'PressedAttack', case02: 'PressedAttack2' }, [c('OnCase01', 'dragon_attk', 'Trigger'), c('OnCase02', 'dragon_nuke', 'Trigger')]),
    mk('logic_relay', 'dragon_attk', '2602', { origin: '-8730 -4540 -5240' }, [c('OnTrigger', 'dragon_hurt', 'Enable', '', 0.7), c('OnTrigger', 'dragon_hurt', 'Disable', '', 1.3), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 5)]),
    mk('logic_relay', 'dragon_nuke', '2603', { origin: '-8740 -4540 -5240' }, [c('OnTrigger', 'dragon_nuke_hurt', 'Enable', '', 4), c('OnTrigger', 'dragon_nuke_hurt', 'Kill', '', 5), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 60)]),
    mk('trigger_hurt', 'dragon_hurt', '2604', { origin: '-8704 -4544 -5200', parentname: 'dragon_knife', startdisabled: '1', damage: '150' }),
    mk('trigger_hurt', 'dragon_nuke_hurt', '2605', { origin: '-8704 -4544 -5100', startdisabled: '1', damage: '1000' }),
    mk('func_physbox', 'dragon_phbox', '2606', { origin: '-8704 -4544 -5180', parentname: 'dragon_knife', health: '50' }, [c('OnBreak', 'dragon_ui', 'Deactivate'), c('OnBreak', 'dragon_attk', 'Kill', '', 1), c('OnBreak', 'dragon_knife', 'Kill', '', 1)]),
    mk('filter_activator_name', 'dragon_knife_filter_a', '2607', { origin: '-8660 -4544 -5190', filtername: 'dragon_knife', negated: '1' }),
    mk('filter_multi', 'dragon_knife_filters', '2608', { origin: '-8660 -4560 -5190', filter01: 'dragon_knife_filter_a', filter02: 'knife_class_filter' }),
    mk('point_entity_finder', 'dragon_knife_stripper', '2609', { origin: '-8660 -4580 -5190', filtername: 'dragon_knife_filters' }, [c('OnFoundEntity', '!caller', 'Kill')]),
    mk('trigger_once', 'dragon_strip', '2610', { origin: '-8704 -4544 -5190', spawnflags: '4097' }, [c('OnStartTouch', 'dragon_knife_stripper', 'FindEntity', '', 0, 1)]),
    mk('trigger_teleport', 'dragon_tele', '2611', { origin: '15000 -15000 2700', target: 'dragon_in', filtername: 'level1_ct_item_filter', spawnflags: '1' }, [c('OnStartTouch', '!self', 'Kill'), c('OnStartTouch', 'dragon_push', 'Kill')]),
    mk('info_teleport_destination', 'dragon_in', '2612', { origin: '-8700 -4544 -5238' }),
    mk('filter_activator_class', 'knife_class_filter', '2613', { origin: '-8600 -4544 -5190', filterclass: 'weapon_knife' }),
    mk('trigger_push', 'dragon_push', '2614', { origin: '15000 -15000 2750', pushdir: '0 0 1', speed: '100' }),
    // Giant: the class knife next door (300 units away) with its own selection teleport; its landing
    // must not be handed to the dragon.
    mk('weapon_knife', 'giant_knife', '2700', { origin: '-8704 -4244 -5226', spawnflags: '1' }, [c('OnPlayerPickup', 'giant_ui', 'Activate')]),
    mk('logic_case', 'giant_ui', '2701', { origin: '-8720 -4240 -5240', vscripts: 'game_ui', case01: 'PressedAttack' }, [c('OnCase01', 'giant_look', 'Trigger')]),
    mk('logic_relay', 'giant_look', '2702', { origin: '-8730 -4240 -5240' }, [c('OnTrigger', 'giant_hurt', 'Enable', '', 0.7), c('OnTrigger', 'giant_hurt', 'Disable', '', 1.3), c('OnTrigger', '!self', 'Disable'), c('OnTrigger', '!self', 'Enable', '', 5)]),
    mk('trigger_hurt', 'giant_hurt', '2703', { origin: '-8704 -4244 -5200', parentname: 'giant_knife', startdisabled: '1', damage: '150' }),
    mk('trigger_teleport', 'giant_tele', '2704', { origin: '15200 -15000 2700', target: 'giant_in', filtername: 'level1_ct_item_filter', spawnflags: '1' }, [c('OnStartTouch', '!self', 'Kill')]),
    mk('info_teleport_destination', 'giant_in', '2705', { origin: '-8700 -4250 -5238' }),
    // Supply (minas tirith layout): the game_ui script fires a logic_branch whose cooldown is
    // "SetValue 1 now, SetValue 0 after 60s"; the selection teleport strips through a relay that runs
    // a point_script; a trigger_once parented to the knife fires the same strip relay.
    mk('weapon_knife', 'item_supply_1', '2800', { origin: '8591 1724 12876', spawnflags: '1' }, [c('OnPlayerPickup', 'supplyui', 'Activate', '', 0, 1)]),
    mk('logic_case', 'supplyui', '2801', { origin: '8588 1665 12940', vscripts: 'game_ui', case01: 'PlayerOn', case16: 'PressedAttack2' }, [c('OnCase01', 'supplyzombiechecker', 'FireUser1'), c('OnCase16', 'item_supply_6', 'Test')]),
    mk('logic_branch', 'item_supply_6', '2802', { origin: '8637 1717 12917', initialvalue: '0' }, [c('OnFalse', 'item_supply_4', 'ForceSpawn'), c('OnFalse', 'item_supply_6', 'SetValue', '1'), c('OnFalse', 'item_supply_6', 'SetValue', '0', 60), c('OnFalse', 'item_supply_7', 'StartSound')]),
    mk('logic_relay', 'supplyzombiechecker', '2803', { origin: '8600 1665 12940' }, [c('OnUser1', '!activator', 'KeyValues', 'health 125')]),
    mk('env_entity_maker', 'item_supply_4', '2804', { origin: '8600 1700 12900', entitytemplate: 'item_supply_s5' }),
    mk('snd_event_point', 'item_supply_7', '2805', { origin: '8600 1700 12950', soundname: 'ammo' }),
    mk('trigger_teleport', 'h_item_3_t', '2806', { origin: '8416 1948 10066', target: 'h_item_3', filtername: 'filter_1_mas', spawnflags: '1' }, [c('OnStartTouch', 'StripAndCleanPlayer', 'Trigger', '', 0, 1)]),
    mk('info_teleport_destination', 'h_item_3', '2807', { origin: '8592 1710 12879' }),
    mk('logic_relay', 'StripAndCleanPlayer', '2808', { origin: '0 0 -800' }, [c('OnTrigger', '!activator', 'KeyValues', 'gravity 1'), c('OnTrigger', 'script_minas', 'RunScriptInput', 'StripKnife', 0.02)]),
    mk('point_script', 'script_minas', '2809', { origin: '0 0 -820', vscripts: 'minas.lua' }),
    mk('trigger_once', 'item_supply_18', '2810', { origin: '8591 1724 12880', parentname: 'item_supply_1', spawnflags: '1' }, [c('OnStartTouch', 'StripAndCleanPlayer', 'Trigger', '', 0, 1), c('OnStartTouch', '!self', 'Kill', '', 0, 1)]),
    // Unrelated stuff
    mk('logic_auto', 'map_auto', '1500', {}, [c('OnMultiNewRound', 'round_relay', 'Trigger')]),
    mk('logic_relay', 'round_relay', '1501', {}, [c('OnTrigger', 'ice_template', 'ForceSpawn')]),
    mk('info_player_counterterrorist', '', '1600', { origin: '0 0 0' }),
  ];

  return {
    mapName: 'ze_demo_v1',
    sourceKind: 'vpk',
    sourceFiles: ['ze_demo_v1.vpk (built-in sample)'],
    entities,
    warnings: [],
    stats: {
      lumps: 5,
      entities: entities.length,
      connections: entities.reduce((n, e) => n + e.connections.length, 0),
      weapons: entities.filter((e) => e.classname.startsWith('weapon_')).length,
    },
  };
}
