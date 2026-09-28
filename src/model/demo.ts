import type { MapEntity, ParsedMap } from './entity';

/**
 * A small hand-written map that mimics a typical Zombie Escape item setup so the UI can be
 * explored without map files.
 */
function lumpFor(hammerId: string): string {
  const n = parseInt(hammerId, 10);
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
    // Heal: physbox + game_ui
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
      lumps: 4,
      entities: entities.length,
      connections: entities.reduce((n, e) => n + e.connections.length, 0),
      weapons: entities.filter((e) => e.classname.startsWith('weapon_')).length,
    },
  };
}
