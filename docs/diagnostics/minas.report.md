# ze_lotr_minas_tirith_p (3314560349_dir.vpk, 3314560349_000.vpk, 3314560349_001.vpk, 3314560349_002.vpk)
entities 2308, weapons 30, connections 3689, lumps 64
warning: Compiled map read from nested package maps/ze_lotr_minas_tirith_p.vpk

## Config ../CS2-ZE-Configs/entwatch/ze_lotr_minas_tirith_p.jsonc: 27 items

### "Flag" hammerid=901
weapon: knife=true
  weapon_knife item_flag_1&0000 #901 origin=-5 0 -2 parent=- lump=148#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValues "health 200" [unresolved]
      OnPlayerPickup → [PR#]h_t_flag_c Add "1" [math_counter]
      OnPlayerPickup → !activator KeyValues "max_health 200" [unresolved]
  within 512u: weapon_knife item_totem_1&0000 #900 0u | weapon_knife item_armor_2_c&0000 #145 0u | weapon_knife newH_item_horse_2&0000 #675 1u | info_particle_system item_tnt_s2 #2965 4u | weapon_hegrenade item_supply_s3 #353 5u | prop_dynamic troll_die_model #34624 5u | game_zone_player SpyOnRemainingPlayers #44 5u | skybox_reference (unnamed) #8323 5u | env_entity_maker factory_template_type15em&0000 #832 5u | info_particle_system BloodGush&0000 #2625 5u | logic_relay BloodGush_Relay&0000 #42 5u | prop_dynamic_override debris_wall&0000 #13229 5u | prop_dynamic_override debris_brick&0000 #13228 5u | prop_dynamic_override debris_wood&0000 #13227 5u | info_particle_system item_supply_s4 #2672 5u | prop_dynamic_override prop_explosive&0000 #737 5u
tool suggestion: handlers [] triggers []
config:          handlers [] triggers [7779]
  missing handlers: []  extra handlers: []
  missing triggers: [7779]  extra triggers: []
  note: template lump 148#entityLumpName: 1 entities (nothing usable)
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: Nothing is wired to or grouped with this weapon (no parent, no template, no outputs). Use the I/O search (e.g. "in:unlock") to find the ability entities and add them with "+".
config trigger 7779  [MISSED by tool]
  trigger_teleport h_item_1_t #7779 origin=8416 1564 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_1, filtername=[PR#]filter_1_mas, spawnflags=1, startdisabled=0
    fired by: logic_case h_t_flag_c2 #149 OnCase01→AddOutput | logic_case h_t_flag_c2 #149 OnCase02→AddOutput | logic_case h_t_flag_c2 #149 OnCase03→AddOutput | logic_case h_t_flag_c2 #149 OnCase04→AddOutput
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 13219u
  strips: no
  teleports to: 8592 766 12879 (target h_item_1 (info_teleport_destination)) → 15505u from weapon
knife selection-trigger search: nothing

### "Armor" hammerid=145
weapon: knife=true
  weapon_knife item_armor_2_c&0000 #145 origin=-5 0 -2 parent=- lump=139#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]item_armor_2_2 SetParentAttachment "c4" +0.019999999552965164s [unresolved]
      OnPlayerPickup → [PR#]item_armor_2_2 SetParent "!activator" +0.009999999776482582s [unresolved]
      OnPlayerPickup → !activator KeyValues "health 275" [unresolved]
      OnPlayerPickup → !activator KeyValues "speed 0.88" [unresolved]
      OnPlayerPickup → [PR#]h_t_armor_c Add "1" [math_counter]
      OnPlayerPickup → !activator KeyValues "max_health 275" [unresolved]
      OnPlayerPickup → !activator KeyValues "gravity 1.08" [unresolved]
      OnPlayerPickup → [PR#]armourui&0000 Activate [logic_case]
      OnPlayerPickup → [PR#]item_armor_relay&0000 FireUser1 [logic_relay]
  within 512u: weapon_knife item_flag_1&0000 #901 0u | weapon_knife item_totem_1&0000 #900 1u | weapon_knife newH_item_horse_2&0000 #675 1u | info_particle_system item_tnt_s2 #2965 4u | weapon_hegrenade item_supply_s3 #353 5u | prop_dynamic troll_die_model #34624 5u | game_zone_player SpyOnRemainingPlayers #44 5u | skybox_reference (unnamed) #8323 5u | env_entity_maker factory_template_type15em&0000 #832 5u | info_particle_system BloodGush&0000 #2625 5u | logic_relay BloodGush_Relay&0000 #42 5u | prop_dynamic_override debris_wall&0000 #13229 5u | prop_dynamic_override debris_brick&0000 #13228 5u | prop_dynamic_override debris_wood&0000 #13227 5u | info_particle_system item_supply_s4 #2672 5u | prop_dynamic_override prop_explosive&0000 #737 5u
tool suggestion: handlers [34608, 34606] triggers []
config:          handlers [] triggers [7781]
  missing handlers: []  extra handlers: [34608, 34606]
  missing triggers: [7781]  extra triggers: []
  note: template lump 139#entityLumpName: 10 entities (func_physbox, logic_case, math_counter, math_counter, trigger_push, logic_relay)
  note: handler ph_item_armor_2_d2&0000 (button OnHealthChanged): parented to weapon (parentname)
  note: event OnHealthChanged: 16 effects
  note: handler item_armor_relay&0000 (other OnTrigger): same template lump (139#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 15 effects
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped armourui&0000 (logic_case, not fed by the item and no cooldown pattern)
  note: skipped item_armor_2_5&0000 (math_counter, not fed by the item and no cooldown pattern)
  note: skipped item_armor_2_5&0000 (math_counter, not fed by the item and no cooldown pattern)
  note: skipped trigger item_armor_2_d&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config trigger 7781  [MISSED by tool]
  trigger_teleport h_item_2_t #7781 origin=8416 1756 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_2, filtername=[PR#]filter_2_mas, spawnflags=1, startdisabled=0
    fired by: logic_case h_t_armor_c2 #140 OnCase02→AddOutput
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 13242u
  strips: no
  teleports to: 8596 1081 12919 (target h_item_2 (info_teleport_destination)) → 15559u from weapon
knife selection-trigger search: nothing

### "Ammo Barrel" hammerid=351
weapon: knife=true
  weapon_knife item_supply_1 #351 origin=8592 1724 12876 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]supplyui Activate [logic_case]
      OnPlayerPickup → !activator KeyValues "health 125" [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 125" [unresolved]
  within 512u: info_teleport_destination h_item_4 #893 16u | env_entity_maker item_supply_4 #356 31u | prop_dynamic_override supplybarrel #362 37u | logic_branch item_supply_6 #357 62u | snd_event_point item_supply_7 #358 71u | game_player_equip dar_municion #1254 79u | point_template item_supply_3 #355 85u | logic_case supplyui #13330 87u | point_template item_supply_s5 #354 87u | logic_relay supplyzombiechecker #13331 88u | filter_proximity weap_prox_filter #21831 89u | snd_event_point item_supply_2 #359 90u | filter_activator_team supplyzombiefilter #13332 91u | logic_timer w_ammo_timer #21825 92u | logic_relay give_ammo #21816 103u | math_counter ammo_counter #21818 105u
tool suggestion: handlers [21825] triggers [7783]
config:          handlers [357] triggers [7783]
  missing handlers: [357]  extra handlers: [21825]
  missing triggers: []  extra triggers: []
  note: nothing wired to the weapon; looked at 12 entities within 200 units
  note: handler w_ammo_timer (other OnTimer): within 92 units of the weapon; has its own Disable/Enable cooldown
  note: event OnTimer: leads to Enable after 0.019999999552965164s (cooldown chain), 9 effects
  note: cooldown 0.20000000298023224s: item_supply_s4 OnTimer → w_ammo_timer Enable (+0.20000000298023224s)
  note: trigger h_item_4_t: teleports 16 units from the knife (target h_item_4 (info_teleport_destination))
  note: skipped weap_prox_filter (filter, not fed by a button)
  note: skipped supplyzombiefilter (filter, not fed by a button)
  note: skipped weap_filters (filter, not fed by a button)
  note: skipped weap_class_filter (filter, not fed by a button)
  note: skipped weap_class_filter4 (filter, not fed by a button)
  note: skipped item_supply_6 (logic_branch, not fed by the item and no cooldown pattern)
  note: skipped supplyui (logic_case, not fed by the item and no cooldown pattern)
  note: skipped supplyzombiechecker (logic_relay, not fed by the item and no cooldown pattern)
  note: skipped give_ammo (logic_relay, sits behind a handler that already reports the use)
  note: skipped ammo_counter (math_counter, not fed by the item and no cooldown pattern)
  note: skipped ammo_init (logic_relay, not fed by the item and no cooldown pattern)
config handler 357 type=other event=OnFalse mode=2 cooldown=60 maxuses=0  [MISSED by tool]
  logic_branch item_supply_6 #357 origin=8637 1717 12917 parent=- lump=default_ents
    fired by: logic_case supplyui #13330 OnCase16→Test
    outputs:
      OnFalse → [PR#]item_supply_4 ForceSpawn [env_entity_maker]
      OnFalse → [PR#]item_supply_s4* FireUser1 +25s [prop_dynamic_override,logic_timer,prop_dynamic]
      OnFalse → [PR#]item_supply_6 SetValue "1" [unresolved]
      OnFalse → [PR#]item_supply_6 SetValue "0" +60s [unresolved]
      OnFalse → [PR#]item_supply_s1 Kill +25s [trigger_hurt]
      OnFalse → [PR#]w_ammo_timer Disable +25s [logic_timer]
      OnFalse → [PR#]item_supply_7 StartSound [snd_event_point]
      OnFalse → [PR#]item_supply_7 StartSound +60s [snd_event_point]
      OnFalse → [PR#]item_supply_2 StartSound [snd_event_point]
      OnFalse → [PR#]item_supply_s6 ForceSpawn +1s [env_entity_maker]
      OnFalse → [PR#]item_supply_s6 Kill +25s [env_entity_maker]
      OnFalse → [PR#]item_supply_s3 Kill +25s [weapon_hegrenade]
      OnFalse → [PR#]ammo_counter SetValueNoFire "0" [math_counter]
      OnFalse → [PR#]weap_prox_filter ClearParent +24.950000762939453s [filter_proximity]
      … +1 more
  distance to weapon: 62u
  tool event guesses: OnFalse (8.5: leads to Enable after 0.20000000298023224s (cooldown chain), 24 effects)
  tool cooldown guess: 0.20000000298023224s (item_supply_s4 OnTimer → w_ammo_timer Enable (+0.20000000298023224s))
config trigger 7783  [found by tool]
  trigger_teleport h_item_4_t #7783 origin=8412 1946 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_4, filtername=[PR#]filter_2_mas, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 2825u
  strips: no
  teleports to: 8592 1724 12860 (target h_item_4 (info_teleport_destination)) → 16u from weapon
knife selection-trigger search: trigger_teleport h_item_4_t #7783 (teleports 16 units from the knife (target h_item_4 (info_teleport_destination)))

### "Oil Barrel" hammerid=865
weapon: knife=true
  weapon_knife item_oil_1 #865 origin=9284 1794 12871 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]oilui Activate [logic_case]
      OnPlayerPickup → !activator KeyValues "health 125" [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 125" [unresolved]
  within 512u: info_teleport_destination h_item_8 #1414 9u | logic_compare item_oil_4 #866 34u | prop_dynamic oilprop #2762 51u | info_particle_system item_oil_2 #2763 56u | filter_multi filter_granada #40 58u | filter_damage_type filter_granadahe #867 59u | filter_damage_type filter_granadamolly #39 72u | math_counter item_oil_8 #868 73u | env_entity_maker item_oil_6 #869 85u | point_template item_oil_7 #863 100u | logic_case oilui #13340 118u | logic_relay oilzombiechecker #13341 125u | filter_activator_team oilzombiefilter #13342 134u
tool suggestion: handlers [] triggers [7870]
config:          handlers [868] triggers [7870]
  missing handlers: [868]  extra handlers: []
  missing triggers: []  extra triggers: []
  note: nothing wired to the weapon; looked at 8 entities within 200 units
  note: trigger h_item_4_t: teleports 9 units from the knife (target h_item_8 (info_teleport_destination))
  note: skipped filter_granada (filter, not fed by a button)
  note: skipped filter_granadahe (filter, not fed by a button)
  note: skipped filter_granadamolly (filter, not fed by a button)
  note: skipped oilzombiefilter (filter, not fed by a button)
  note: skipped item_oil_4 (logic_compare, not fed by the item and no cooldown pattern)
  note: skipped item_oil_8 (math_counter, not fed by the item and no cooldown pattern)
  note: skipped oilui (logic_case, not fed by the item and no cooldown pattern)
  note: skipped oilzombiechecker (logic_relay, not fed by the item and no cooldown pattern)
  note: No button/filter/relay/counter qualified; see the skipped entries above and add handlers from the tree or the I/O search.
config handler 868 type=counterup event=- mode=4 cooldown=60 maxuses=0  [MISSED by tool]
  math_counter item_oil_8 #868 origin=9270 1863 12856 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_compare item_oil_4 #866 OnEqualTo→Add
    outputs:
      OnHitMax → [PR#]item_oil_4 SetValue "1" [logic_compare]
      OnHitMax → [PR#]item_oil_4 SetValue "0" +60s [logic_compare]
      OnHitMax → [PR#]item_oil_2 Start +60s [info_particle_system]
      OnHitMax → [PR#]item_oil_2 Stop +60.099998474121094s [info_particle_system]
      OnHitMax → [PR#]item_oil_8 SetValue "0" +60s [unresolved]
  distance to weapon: 73u
  tool event guesses: OnHitMax (4.0: 6 effects)
  tool cooldown guess: -
config trigger 7870  [found by tool]
  trigger_teleport h_item_4_t #7870 origin=8424 2120 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_8, filtername=[PR#]filter_2_mas, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 2952u
  strips: no
  teleports to: 9284 1794 12862 (target h_item_8 (info_teleport_destination)) → 9u from weapon
knife selection-trigger search: trigger_teleport h_item_4_t #7870 (teleports 9 units from the knife (target h_item_8 (info_teleport_destination)))

### "Horse" hammerid=675
weapon: knife=true
  weapon_knife newH_item_horse_2&0000 #675 origin=-4 0 -2 parent=- lump=177#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValues "speed 1.35" [unresolved]
      OnPlayerPickup → !activator KeyValues "health 25000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nozombies" [unresolved]
      OnPlayerPickup → !activator KeyValues "gravity 0.8" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]h_t_horse_c Add "1" [math_counter]
      OnPlayerPickup → !activator KeyValues "max_health 25000" [unresolved]
      OnPlayerPickup → [PR#]horseui&0000 Activate [logic_case]
  within 512u: weapon_knife item_armor_2_c&0000 #145 1u | weapon_knife item_flag_1&0000 #901 1u | weapon_knife item_totem_1&0000 #900 1u | info_particle_system item_tnt_s2 #2965 3u | weapon_hegrenade item_supply_s3 #353 4u | prop_dynamic troll_die_model #34624 5u | game_zone_player SpyOnRemainingPlayers #44 5u | skybox_reference (unnamed) #8323 5u | env_entity_maker factory_template_type15em&0000 #832 5u | info_particle_system BloodGush&0000 #2625 5u | logic_relay BloodGush_Relay&0000 #42 5u | prop_dynamic_override debris_wall&0000 #13229 5u | prop_dynamic_override debris_brick&0000 #13228 5u | prop_dynamic_override debris_wood&0000 #13227 5u | prop_dynamic_override prop_explosive&0000 #737 5u | env_entity_maker factory_template_type16em&0000 #833 5u
tool suggestion: handlers [676, 676, 13327] triggers []
config:          handlers [] triggers [7785]
  missing handlers: []  extra handlers: [676, 676, 13327]
  missing triggers: [7785]  extra triggers: []
  note: template lump 177#entityLumpName: 13 entities (func_physbox, logic_case, trigger_push, trigger_push, func_physbox, logic_timer, logic_case)
  note: handler ph_newH_item_horse_8&0000 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 0.10000000149011612s (cooldown chain), 19 effects
  note: handler ph_newH_item_horse_8&0000 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 0.10000000149011612s (cooldown chain), 19 effects
  note: handler horseui&0000 (other OnCase02): same template lump (177#entityLumpName); fed by a button/trigger
  note: event OnCase02: 5 effects
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped newH_item_horse_10&0000 (logic_timer, not fed by the item and no cooldown pattern)
  note: skipped newH_item_horse_9&0000 (logic_case, not fed by the item and no cooldown pattern)
  note: skipped trigger newH_item_horse_3&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger newH_item_horse_3&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config trigger 7785  [MISSED by tool]
  trigger_teleport h_item_5_t #7785 origin=8608 2140 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_5, filtername=[PR#]filter_3_mas, spawnflags=1, startdisabled=0
    fired by: logic_case h_t_horse_c2 #178 OnCase02→AddOutput
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 13421u
  strips: no
  teleports to: 8928 720 12864 (target h_item_5 (info_teleport_destination)) → 15679u from weapon
knife selection-trigger search: nothing

### "Gandalf" hammerid=683
weapon: knife=true
  weapon_knife item_gandalf #683 origin=8919 1091 12900 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]item_gandalf_5 Activate [logic_case]
      OnPlayerPickup → !activator KeyValues "health 75000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nozombies" [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 75000" [unresolved]
      OnPlayerPickup → !activator AddContext "gandalf:1" [unresolved]
      OnPlayerPickup → [PR#]dalfzombiechecker FireUser1 [logic_relay]
  within 512u: info_teleport_destination h_item_6 #894 0u | prop_dynamic item_gandalf_1 #2716 12u | func_physbox ph_item_gandalf_15 #693 44u | trigger_push item_gandalf_11s #7919 44u | trigger_push item_gandalf_11 #7915 53u | trigger_push item_gandalf_11 #7917 53u | trigger_push item_gandalf_11 #7913 60u | info_particle_system item_gandalf_13 #2718 69u | logic_case item_gandalf_5 #13148 83u | point_soundevent item_gandalf_3 #685 88u | trigger_push item_gandalf_7 #7907 91u | filter_activator_context gandalfcontext #13282 97u | point_entity_finder gandalffinder #13283 99u | trigger_push item_gandalf_7 #7911 103u | trigger_push item_gandalf_7 #7909 115u | logic_relay dalfzombiechecker #30480 117u
tool suggestion: handlers [693, 86, 13148] triggers [7781, 7785, 7787]
config:          handlers [686, 687] triggers [7787]
  missing handlers: [686, 687]  extra handlers: [693, 86, 13148]
  missing triggers: []  extra triggers: [7781, 7785]
  note: handler ph_item_gandalf_15 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 4.699999809265137s (cooldown chain), 52 effects
  note: handler CTFilter_1 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: handler item_gandalf_5 (other OnCase13): ph_item_gandalf_15 OnBreak → Deactivate; fed by a button/trigger
  note: event OnCase13: leads to Enable after 4.699999809265137s (cooldown chain), 25 effects
  note: trigger h_item_2_t: teleports 324 units from the knife (target h_item_2 (info_teleport_destination))
  note: trigger h_item_5_t: teleports 372 units from the knife (target h_item_5 (info_teleport_destination))
  note: trigger h_item_6_t: teleports 0 units from the knife (target h_item_6 (info_teleport_destination))
  note: skipped trigger item_gandalf_7 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_7 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_7 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_7 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_11 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_11 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_11 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_gandalf_11s (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 686 type=other event=OnEqualTo mode=2 cooldown=75 maxuses=0  [MISSED by tool]
  logic_compare item_gandalf_6 #686 origin=8950 1224 12905 parent=- lump=default_ents
    fired by: logic_case item_gandalf_5 #13148 OnCase16→Compare
    outputs:
      OnEqualTo → [PR#]item_gandalf_7 Enable [trigger_push,trigger_push,trigger_push]
      OnEqualTo → [PR#]item_gandalf_7 Disable +10s [trigger_push,trigger_push,trigger_push]
      OnEqualTo → [PR#]item_gandalf_9 Start [info_particle_system]
      OnEqualTo → [PR#]item_gandalf_9 DestroyImmediately +10s [info_particle_system]
      OnEqualTo → [PR#]item_gandalf_1 SetAnimationLooping "gandalf_run" +10s [prop_dynamic]
      OnEqualTo → [PR#]item_gandalf_1 SetAnimationLooping "gandalf_attack1" [prop_dynamic]
      OnEqualTo → !self SetValue "0" +75s [unresolved]
      OnEqualTo → !self SetValue "1" [unresolved]
      OnEqualTo → [PR#]item_gandalf_encender_luz Trigger [logic_relay]
      OnEqualTo → [PR#]item_gandalf_14 Disable +10s [unresolved]
      OnEqualTo → !activator KeyValues "speed 0.7" [unresolved]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "999999999" [func_physbox]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "56" +10s [func_physbox]
      OnEqualTo → [PR#]item_gandalf_17 Disable +10s [unresolved]
      … +10 more
  distance to weapon: 137u
  tool event guesses: OnEqualTo (7.0: locks something, 43 effects)
  tool cooldown guess: -
config handler 687 type=other event=OnEqualTo mode=2 cooldown=75 maxuses=0  [MISSED by tool]
  logic_compare item_gandalf_10 #687 origin=8916 1229 12904 parent=- lump=default_ents
    fired by: logic_relay combo2_paso_4 #692 OnTrigger→Compare
    outputs:
      OnEqualTo → [PR#]item_gandalf_3 StartSound [point_soundevent]
      OnEqualTo → [PR#]item_gandalf_1 SetAnimationLooping "gandalf_attack2" [prop_dynamic]
      OnEqualTo → [PR#]item_gandalf_11 Enable +4.699999809265137s [trigger_push,trigger_push,trigger_push]
      OnEqualTo → [PR#]item_gandalf_11 Disable +6s [trigger_push,trigger_push,trigger_push]
      OnEqualTo → !activator KeyValues "speed 0" [unresolved]
      OnEqualTo → [PR#]item_gandalf_10 SetValue "1" [unresolved]
      OnEqualTo → [PR#]item_gandalf_10 SetValue "0" +75s [unresolved]
      OnEqualTo → [PR#]item_gandalf_13 Start +4.699999809265137s [info_particle_system]
      OnEqualTo → [PR#]item_gandalf_13 Stop +5s [info_particle_system]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "56" +5s [func_physbox]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "999999999" [func_physbox]
      OnEqualTo → [PR#]item_gandalf_16 Explode +4.699999809265137s [env_physexplosion]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "999999999" +1s [func_physbox]
      OnEqualTo → [PR#]ph_item_gandalf_15 SetHealth "999999999" +2s [func_physbox]
      … +15 more
  distance to weapon: 139u
  tool event guesses: OnEqualTo (10.0: leads to Enable after 4.699999809265137s (cooldown chain), 50 effects)
  tool cooldown guess: -
config trigger 7787  [found by tool]
  trigger_teleport h_item_6_t #7787 origin=8800 2140 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_6, filtername=[PR#]filter_3_mas, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 3025u
  strips: no
  teleports to: 8919 1091 12900 (target h_item_6 (info_teleport_destination)) → 0u from weapon
knife selection-trigger search: trigger_teleport h_item_2_t #7781 (teleports 324 units from the knife (target h_item_2 (info_teleport_destination))) | trigger_teleport h_item_5_t #7785 (teleports 372 units from the knife (target h_item_5 (info_teleport_destination))) | trigger_teleport h_item_6_t #7787 (teleports 0 units from the knife (target h_item_6 (info_teleport_destination)))

### "White Knight" hammerid=695
weapon: knife=true
  weapon_knife item_goliath #695 origin=12652 4607 12869 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]item_goliath_14 Activate [logic_case]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nozombies" [unresolved]
      OnPlayerPickup → !activator KeyValues "health 100000" [unresolved]
      OnPlayerPickup → [PR#]consola Command "say ** THE WHITE KNIGHT IS READY ROCK THE WORLD**" [point_servercommand]
      OnPlayerPickup → !activator KeyValues "max_health 100000" [unresolved]
      OnPlayerPickup → !activator AddContext "whiteknight:1" [unresolved]
      OnPlayerPickup → [PR#]wkzombiechecker FireUser1 [logic_relay]
      OnPlayerPickup → [PR#]dog_run_relay Trigger [logic_relay]
  within 512u: prop_dynamic item_goliath_3 #2719 6u | info_particle_system dog_run #34623 6u | info_particle_system dog_sword1 #34628 6u | info_particle_system dog_sword2 #34629 6u | info_particle_system dog_sword3 #34630 6u | info_particle_system dog_sword1_heavy #34631 6u | info_particle_system dog_sword2_heavy #34632 6u | info_particle_system dog_defense #34633 6u | info_particle_system dog_ultima #34634 6u | info_teleport_destination h_item_7 #1124 7u | point_soundevent item_goliath_10 #697 7u | info_particle_system item_goliath_22 #3091 13u | snd_event_point item_goliath_11 #698 19u | snd_event_point item_goliath_9 #696 26u | info_particle_system item_goliath_23 #2720 38u | point_soundevent item_goliath_12 #712 39u
tool suggestion: handlers [94, 30461, 87, 13280, 706, 713, 711, 707, 699, 715, 34636, 34637, 34638, 34639, 34640] triggers [7789]
config:          handlers [713, 699] triggers [7789]
  missing handlers: []  extra handlers: [94, 30461, 87, 13280, 706, 711, 707, 715, 34636, 34637, 34638, 34639, 34640]
  missing triggers: []  extra triggers: []
  note: handler ph_item_goliath_2 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 150s (cooldown chain), 103 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler item_goliath_27 (button OnUser4): parented to weapon (parentname)
  note: event OnUser4: leads to Enable after 5.300000190734863s (cooldown chain), 25 effects
  note: handler CTFilter_2 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: handler wkcontext (other OnPass): item_goliath_27 OnPressed → TestActivator
  note: event OnPass: leads to Enable after 2.5s (cooldown chain), 19 effects
  note: handler combo3_paso_1 (other OnTrigger): ph_item_goliath_2 OnBreak → Disable; fed by a button/trigger
  note: event OnTrigger: locks something, 8 effects
  note: cooldown 0.10000000149011612s: item_goliath_14 OnCase12 → combo3_paso_1 Enable (+0.10000000149011612s)
  note: handler item_goliath_20 (other OnTrigger): ph_item_goliath_2 OnBreak → Disable; fed by a button/trigger
  note: event OnTrigger: leads to Enable after 150s (cooldown chain), 97 effects
  note: cooldown 6s: item_goliath_20 OnTrigger → item_goliath_20 Enable (+6s)
  note: handler item_goliath_15 (other OnTrigger): ph_item_goliath_2 OnBreak → Disable; fed by a button/trigger
  note: event OnTrigger: leads to Enable after 2.5s (cooldown chain), 36 effects
  note: cooldown 5.300000190734863s: item_goliath_15 OnUser1 → item_goliath_15 Enable (+5.300000190734863s)
  note: handler item_goliath_14 (other OnCase11): ph_item_goliath_2 OnBreak → Deactivate; fed by a button/trigger
  note: event OnCase11: leads to Enable after 150s (cooldown chain), 42 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler item_goliath_25 (other OnTrigger): ph_item_goliath_2 OnBreak → CancelPending; fed by a button/trigger
  note: event OnTrigger: leads to Enable after 150s (cooldown chain), 94 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler item_goliath_29 (other OnEqualTo): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnEqualTo: leads to Enable after 5.300000190734863s (cooldown chain), 40 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler dog_sword1_relay (other OnTrigger): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnTrigger: 14 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler dog_sword2_relay (other OnTrigger): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnTrigger: 14 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler dog_sword3_relay (other OnTrigger): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnTrigger: 14 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler dog_sword1_heavy_relay (other OnTrigger): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnTrigger: 14 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: handler dog_sword2_heavy_relay (other OnTrigger): ph_item_goliath_2 OnBreak → Kill; fed by a button/trigger
  note: event OnTrigger: 14 effects
  note: cooldown 150s: item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s)
  note: trigger trigger_teleport: teleports 7 units from the knife (target h_item_7 (info_teleport_destination))
  note: skipped trigger item_goliath_4p (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_goliath_4 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_goliath_24 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_goliath_4_2 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 713 type=other event=OnTrigger mode=2 cooldown=6 maxuses=0  [found by tool]
  logic_relay item_goliath_20 #713 origin=12756 4552 12873 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: func_physbox ph_item_goliath_2 #94 OnBreak→Disable | logic_relay item_goliath_25 #699 OnTrigger→Disable | logic_relay item_goliath_25 #699 OnTrigger→Enable +5.300000190734863s | logic_case item_goliath_14 #707 OnCase16→Trigger
    outputs:
      OnTrigger → [PR#]dog_defense_relay Trigger [logic_relay]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +6s [unresolved]
      OnTrigger → !activator KeyValues "speed 0" [unresolved]
      OnTrigger → [PR#]ph_item_goliath_2 SetDamageFilter "[PR#]nada" [func_physbox]
      OnTrigger → [PR#]ph_item_goliath_2 SetDamageFilter "[PR#]zombies_y_items" +2s [func_physbox]
      OnTrigger → !activator KeyValues "speed 1" +2s [unresolved]
  distance to weapon: 118u
  tool event guesses: OnTrigger (10.0: leads to Enable after 150s (cooldown chain), 97 effects)
  tool cooldown guess: 6s (item_goliath_20 OnTrigger → item_goliath_20 Enable (+6s))
config handler 699 type=other event=OnTrigger mode=2 cooldown=150 maxuses=0  [found by tool]
  logic_relay item_goliath_25 #699 origin=12569 4505 12873 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: func_physbox ph_item_goliath_2 #94 OnBreak→CancelPending | logic_relay combo3_paso_7 #700 OnTrigger→Trigger
    outputs:
      OnTrigger → [PR#]item_goliath_24 Disable +5.199999809265137s [trigger_hurt]
      OnTrigger → [PR#]item_goliath_23 Stop +5s [info_particle_system]
      OnTrigger → [PR#]item_goliath_21 Stop +5s [unresolved]
      OnTrigger → [PR#]item_goliath_24 Enable +4.800000190734863s [trigger_hurt]
      OnTrigger → [PR#]item_goliath_23 Start +4.800000190734863s [info_particle_system]
      OnTrigger → [PR#]item_goliath_22 Stop +4.400000095367432s [info_particle_system]
      OnTrigger → [PR#]item_goliath_22 Start +1.399999976158142s [info_particle_system]
      OnTrigger → [PR#]item_goliath_10 StartSound [point_soundevent]
      OnTrigger → [PR#]item_goliath_21 Start [unresolved]
      OnTrigger → !activator KeyValues "speed 0" [unresolved]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +150s [unresolved]
      OnTrigger → [PR#]global_shake_2 StartShake +2.799999952316284s [env_shake]
      OnTrigger → [PR#]global_nova StartSound +4.800000190734863s [point_soundevent]
      … +18 more
  distance to weapon: 131u
  tool event guesses: OnTrigger (10.0: leads to Enable after 150s (cooldown chain), 94 effects)
  tool cooldown guess: 150s (item_goliath_25 OnTrigger → item_goliath_25 Enable (+150s))
config trigger 7789  [found by tool]
  trigger_teleport (unnamed) #7789 origin=8992 2140 10066 parent=- lump=default_ents
    keys: target=[PR#]h_item_7, filtername=[PR#]filter_5, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
  distance to weapon: 5227u
  strips: no
  teleports to: 12652 4607 12862 (target h_item_7 (info_teleport_destination)) → 7u from weapon
knife selection-trigger search: trigger_teleport (unnamed) #7789 (teleports 7 units from the knife (target h_item_7 (info_teleport_destination)))

### "Zombie Totem Pole" hammerid=900
weapon: knife=true
  weapon_knife item_totem_1&0000 #900 origin=-5 0 -1 parent=- lump=217#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValues "health 9000" [unresolved]
      OnPlayerPickup → [PR#]z_t_totem_c Add "1" [math_counter]
      OnPlayerPickup → !activator KeyValues "speed 1.15" [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 9000" [unresolved]
  within 512u: weapon_knife item_flag_1&0000 #901 0u | weapon_knife item_armor_2_c&0000 #145 1u | weapon_knife newH_item_horse_2&0000 #675 1u | info_particle_system item_tnt_s2 #2965 4u | weapon_hegrenade item_supply_s3 #353 5u | prop_dynamic troll_die_model #34624 5u | info_particle_system item_supply_s4 #2672 5u | game_zone_player SpyOnRemainingPlayers #44 5u | skybox_reference (unnamed) #8323 5u | env_entity_maker factory_template_type15em&0000 #832 5u | info_particle_system BloodGush&0000 #2625 5u | logic_relay BloodGush_Relay&0000 #42 5u | prop_dynamic_override debris_wall&0000 #13229 5u | prop_dynamic_override debris_brick&0000 #13228 5u | prop_dynamic_override debris_wood&0000 #13227 5u | prop_dynamic_override prop_explosive&0000 #737 5u
tool suggestion: handlers [] triggers []
config:          handlers [] triggers [7862]
  missing handlers: []  extra handlers: []
  missing triggers: [7862]  extra triggers: []
  note: template lump 217#entityLumpName: 1 entities (nothing usable)
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: Nothing is wired to or grouped with this weapon (no parent, no template, no outputs). Use the I/O search (e.g. "in:unlock") to find the ability entities and add them with "+".
config trigger 7862  [MISSED by tool]
  trigger_teleport triggers_spawan2_z_lv1 #7862 origin=10624 2136 10086 parent=- lump=default_ents
    keys: target=[PR#]z_item_1, filtername=[PR#]zombies, spawnflags=1, startdisabled=1
    fired by: logic_relay SOGMAHT #4 OnTrigger→Enable | logic_branch GameMode_Totem #220 OnTrue→AddOutput | func_breakable puerta1 #2770 OnBreak→Kill | func_breakable stage_4_breakable_6_1 #2809 OnBreak→Kill | logic_relay logica_extreme #8469 OnTrigger→Enable
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayerT Trigger [logic_relay]
  distance to weapon: 14809u
  strips: no
  teleports to: 9619 766 12870 (target z_item_1 (info_teleport_destination)) → 16089u from weapon
knife selection-trigger search: nothing

### "Zombie TNT Barrel" hammerid=1117
weapon: knife=true
  weapon_knife item_tnt_1 #1117 origin=9637 1446 12580 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]item_tnt_2 Activate [logic_case]
      OnPlayerPickup → [PR#]item_tnt_11 Start [info_particle_system]
  within 512u: info_teleport_destination z_item_2 #1120 0u | prop_dynamic_override (unnamed) #1118 38u | point_soundevent sonido_risa #1111 42u | env_entity_maker item_tnt_4 #1116 45u | info_particle_system item_tnt_10 #2967 49u | logic_branch item_tnt_3 #1115 52u | trigger_push item_tnt_s9 #7942 56u | logic_compare item_tnt_8 #1121 56u | point_template item_tnt_5 #1119 57u | logic_case item_tnt_2 #1114 63u | point_soundevent sonido_explosion #1112 66u | logic_compare item_tnt_82 #1122 68u | logic_relay item_barril_explo #1383 70u | info_particle_system item_tnt_11 #2633 72u | trigger_teleport (unnamed) #7814 121u | point_template troll_spawner #1440 500u
tool suggestion: handlers [90] triggers [7793, 7864]
config:          handlers [1115] triggers [7864]
  missing handlers: [1115]  extra handlers: [90]
  missing triggers: []  extra triggers: [7793]
  note: handler TFilter_4 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger triggers_spawan_z_lv2_a: teleports 0 units from the knife (target z_item_2 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv2_a: teleports 0 units from the knife (target z_item_2 (info_teleport_destination))
  note: skipped trigger item_tnt_s9 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 1115 type=other event=OnTrue mode=2 cooldown=20 maxuses=0  [MISSED by tool]
  logic_branch item_tnt_3 #1115 origin=9670 1447 12620 parent=- lump=default_ents
    fired by: logic_case item_tnt_2 #1114 OnCase16→Test
    outputs:
      OnTrue → !self SetValue "0" [unresolved]
      OnTrue → !self SetValue "1" +20s [unresolved]
      OnTrue → [PR#]item_tnt_4 ForceSpawn [env_entity_maker]
      OnTrue → [PR#]item_tnt_82 Compare +0.019999999552965164s [logic_compare]
      OnTrue → [PR#]item_tnt_11 Stop +0.5s [info_particle_system]
      OnTrue → [PR#]item_tnt_11 Start +20s [info_particle_system]
  distance to weapon: 52u
  tool event guesses: OnTrue (9.5: leads to Enable after 0.800000011920929s (cooldown chain), 27 effects)
  tool cooldown guess: -
config trigger 7864  [found by tool]
  trigger_teleport triggers_spawan2_z_lv2_a #7864 origin=10912 2136 10086 parent=- lump=default_ents
    keys: target=[PR#]z_item_2, filtername=[PR#]zombies, spawnflags=1, startdisabled=1
    fired by: logic_relay SOGMAHT #4 OnTrigger→Enable | logic_relay logica_extreme #8469 OnTrigger→Enable
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayerT Trigger [logic_relay]
  distance to weapon: 2884u
  strips: no
  teleports to: 9637 1446 12580 (target z_item_2 (info_teleport_destination)) → 0u from weapon
knife selection-trigger search: trigger_teleport triggers_spawan_z_lv2_a #7793 (teleports 0 units from the knife (target z_item_2 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv2_a #7864 (teleports 0 units from the knife (target z_item_2 (info_teleport_destination)))

### "Zombie Ladder" hammerid=157
weapon: knife=true
  weapon_knife item_escalera_1 #157 origin=9938 766 12879 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]ladder1ui Activate +4s [logic_case]
      OnPlayerPickup → [PR#]z_t_ladder_c Add "1" [math_counter]
  within 512u: weapon_knife item_escalera_1_2 #167 2u | info_teleport_destination z_item_3 #898 2u | logic_compare item_escalera3 #159 33u | logic_compare item_escalera3_2 #169 34u | point_template item_escalera_5_2 #173 36u | point_template item_escalera_5 #163 38u | env_entity_maker item_escalera_4 #158 40u | env_entity_maker item_escalera_4_2 #168 40u | func_physbox item_escalera_6 #164 64u | func_physbox item_escalera_6_2 #174 64u | prop_dynamic ladder1prop #2652 71u | prop_dynamic ladder2prop #2654 71u | logic_relay ladder2zombiechecker #13338 90u | filter_activator_team ladder2zombiefilter #13339 91u | logic_case ladder2ui #13337 91u | logic_relay ladder1zombiechecker #13335 101u
tool suggestion: handlers [164] triggers [7791, 7795, 7797, 7862, 7866, 7868]
config:          handlers [] triggers [7866]
  missing handlers: []  extra handlers: [164]
  missing triggers: []  extra triggers: [7791, 7795, 7797, 7862, 7868]
  note: handler item_escalera_6 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: 1 effect
  note: trigger triggers_spawan_z_lv1: teleports 319 units from the knife (target z_item_1 (info_teleport_destination))
  note: trigger triggers_spawan_z_lv2_b: teleports 2 units from the knife (target z_item_3 (info_teleport_destination))
  note: trigger triggers_spawan_z_lv3: teleports 347 units from the knife (target z_item_4 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv1: teleports 319 units from the knife (target z_item_1 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv2_b: teleports 2 units from the knife (target z_item_3 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv3: teleports 347 units from the knife (target z_item_4 (info_teleport_destination))
config trigger 7866  [found by tool]
  trigger_teleport triggers_spawan2_z_lv2_b #7866 origin=11104 1944 10086 parent=- lump=default_ents
    keys: target=[PR#]z_item_3, filtername=[PR#]zombies, spawnflags=1, startdisabled=1
    fired by: logic_relay SOGMAHT #4 OnTrigger→Enable | logic_branch GameMode_Ladder #156 OnTrue→AddOutput | logic_relay logica_extreme #8469 OnTrigger→Enable
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayerT Trigger [logic_relay]
  distance to weapon: 3248u
  strips: no
  teleports to: 9938 766 12882 (target z_item_3 (info_teleport_destination)) → 2u from weapon
knife selection-trigger search: trigger_teleport triggers_spawan_z_lv1 #7791 (teleports 319 units from the knife (target z_item_1 (info_teleport_destination))) | trigger_teleport triggers_spawan_z_lv2_b #7795 (teleports 2 units from the knife (target z_item_3 (info_teleport_destination))) | trigger_teleport triggers_spawan_z_lv3 #7797 (teleports 347 units from the knife (target z_item_4 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv1 #7862 (teleports 319 units from the knife (target z_item_1 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv2_b #7866 (teleports 2 units from the knife (target z_item_3 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv3 #7868 (teleports 347 units from the knife (target z_item_4 (info_teleport_destination)))

### "Zombie Ladder" hammerid=167
weapon: knife=true
  weapon_knife item_escalera_1_2 #167 origin=9938 766 12882 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]ladder2ui Activate +4s [logic_case]
      OnPlayerPickup → [PR#]z_t_ladder_c Add "1" [math_counter]
  within 512u: info_teleport_destination z_item_3 #898 0u | weapon_knife item_escalera_1 #157 2u | logic_compare item_escalera3 #159 33u | logic_compare item_escalera3_2 #169 33u | point_template item_escalera_5_2 #173 38u | point_template item_escalera_5 #163 39u | env_entity_maker item_escalera_4 #158 40u | env_entity_maker item_escalera_4_2 #168 40u | func_physbox item_escalera_6 #164 62u | func_physbox item_escalera_6_2 #174 62u | prop_dynamic ladder1prop #2652 69u | prop_dynamic ladder2prop #2654 69u | logic_relay ladder2zombiechecker #13338 89u | filter_activator_team ladder2zombiefilter #13339 90u | logic_case ladder2ui #13337 90u | logic_relay ladder1zombiechecker #13335 99u
tool suggestion: handlers [174] triggers [7791, 7795, 7797, 7862, 7866, 7868]
config:          handlers [] triggers []
  missing handlers: []  extra handlers: [174]
  missing triggers: []  extra triggers: [7791, 7795, 7797, 7862, 7866, 7868]
  note: handler item_escalera_6_2 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: 1 effect
  note: trigger triggers_spawan_z_lv1: teleports 319 units from the knife (target z_item_1 (info_teleport_destination))
  note: trigger triggers_spawan_z_lv2_b: teleports 0 units from the knife (target z_item_3 (info_teleport_destination))
  note: trigger triggers_spawan_z_lv3: teleports 348 units from the knife (target z_item_4 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv1: teleports 319 units from the knife (target z_item_1 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv2_b: teleports 0 units from the knife (target z_item_3 (info_teleport_destination))
  note: trigger triggers_spawan2_z_lv3: teleports 348 units from the knife (target z_item_4 (info_teleport_destination))
knife selection-trigger search: trigger_teleport triggers_spawan_z_lv1 #7791 (teleports 319 units from the knife (target z_item_1 (info_teleport_destination))) | trigger_teleport triggers_spawan_z_lv2_b #7795 (teleports 0 units from the knife (target z_item_3 (info_teleport_destination))) | trigger_teleport triggers_spawan_z_lv3 #7797 (teleports 348 units from the knife (target z_item_4 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv1 #7862 (teleports 319 units from the knife (target z_item_1 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv2_b #7866 (teleports 0 units from the knife (target z_item_3 (info_teleport_destination))) | trigger_teleport triggers_spawan2_z_lv3 #7868 (teleports 348 units from the knife (target z_item_4 (info_teleport_destination)))

### "Zombie Troll" hammerid=348
weapon: knife=true
  weapon_knife item_troll_1_2&0000 #348 origin=-1 12 57 parent=- lump=1440#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]trollui&0000 Activate [logic_case]
      OnPlayerPickup → !activator KeyValues "health 40000" [unresolved]
      OnPlayerPickup → !activator KeyValues "speed 0.9" [unresolved]
      OnPlayerPickup → [PR#]troll_walk_relay&0000 Trigger [logic_relay]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]z_t_troll_c Add "1" [math_counter]
      OnPlayerPickup → !activator KeyValues "max_health 40000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nohumanos" [unresolved]
      OnPlayerPickup → !activator AddContext "troll:1" [unresolved]
      OnPlayerPickup → [PR#]ph_troll_hp_2&0000 FireUser1 [func_physbox]
      OnPlayerPickup → [PR#]ph_troll_hp_23&0000 FireUser1 [func_physbox]
  within 512u: trigger_push newH_item_horse_3&0000 #7903 8u | logic_relay cadefix12&0000 #30374 11u | logic_relay cadefix6&0000 #30368 12u | logic_relay cadefix8&0000 #30370 14u | logic_relay cadefix7&0000 #30369 15u | info_particle_system prop_explosive_2f&0000 #21752 15u | light_omni2 prop_explosive_2f_light&0000 #34656 15u | info_particle_system stage_1_barricade_1_27&0000 #2636 15u | func_button stage_1_barricade_1_27_2&0000 #245 15u | func_water item_nazgul_10&0000 #34645 16u | logic_relay cadefix11&0000 #30373 17u | func_physbox ph_barricade_7&0000 #790 17u | func_physbox ph_newH_item_horse_8&0000 #676 17u | func_physbox ph_newH_item_horse_8&0000 #676 17u | info_particle_system stage_1_barricade_1_0&0000 #2737 17u | func_physbox ph_item_armor_2_d2&0000 #34608 20u
tool suggestion: handlers [21887, 1349, 91, 13326, 34619, 34620] triggers []
config:          handlers [] triggers [7797]
  missing handlers: []  extra handlers: [21887, 1349, 91, 13326, 34619, 34620]
  missing triggers: [7797]  extra triggers: []
  note: template lump 1440#entityLumpName: 13 entities (func_physbox, func_physbox, logic_compare, logic_case, trigger_hurt, logic_relay, logic_relay)
  note: handler ph_troll_hp_2&0000 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 0.5s (cooldown chain), 37 effects
  note: handler ph_troll_hp_23&0000 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 0.5s (cooldown chain), 35 effects
  note: handler TFilter_5 (other OnPass): references weapon via filtername
  note: templated=false: the weapon is spawned by a template but TFilter_5 is a single map entity
  note: event OnPass: class default (no connections in map)
  note: handler trollui&0000 (other OnCase16): same template lump (1440#entityLumpName); fed by a button/trigger
  note: event OnCase16: leads to Enable after 0.5s (cooldown chain), 15 effects
  note: handler troll_walk_relay&0000 (other OnTrigger): same template lump (1440#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 4 effects
  note: handler troll_hit_relay&0000 (other OnTrigger): same template lump (1440#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 4 effects
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped item_troll_2_2&0000 (logic_compare, not fed by the item and no cooldown pattern)
  note: skipped trigger item_troll_5_2&0000 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config trigger 7797  [MISSED by tool]
  trigger_teleport triggers_spawan_z_lv3 #7797 origin=11104 1756 10086 parent=- lump=default_ents
    keys: target=[PR#]z_item_4, filtername=[PR#]filter_3_mas, spawnflags=1, startdisabled=0
    fired by: logic_relay SOGMAHT #4 OnTrigger→Kill | logic_branch GameMode_Troll #153 OnFalse→AddOutput | logic_relay logica_extreme #8469 OnTrigger→Kill
    outputs:
      OnStartTouch → [PR#]StripAndCleanPlayerT Trigger [logic_relay]
  distance to weapon: 15065u
  strips: no
  teleports to: 9922 1112 12856 (target z_item_4 (info_teleport_destination)) → 16233u from weapon
knife selection-trigger search: nothing

### "Zombie Balrog" hammerid=716
weapon: knife=true
  weapon_knife item_balrog #716 origin=12656 3456 12863 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]item_balrog_11 Activate [logic_case]
      OnPlayerPickup → [PR#]consola Command "say ** .. THE CREATURE OF SHADOW AND FIRE IS HERE ... **" [point_servercommand]
      OnPlayerPickup → !activator KeyValues "speed 0.7" [unresolved]
      OnPlayerPickup → !activator KeyValues "health 100000" [unresolved]
      OnPlayerPickup → !activator KeyValues "gravity 2" [unresolved]
      OnPlayerPickup → [PR#]extreme_balrog Kill [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 100000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nohumanos" [unresolved]
      OnPlayerPickup → !activator AddContext "balrog:1" [unresolved]
      OnPlayerPickup → !self FireUser4 [unresolved]
      OnUser4 → !activator KeyValues "speed 0.7" [unresolved]
      OnUser4 → !self FireUser4 +1s [unresolved]
      OnUser4 → !activator KeyValues "gravity 2" [unresolved]
  within 512u: info_teleport_destination z_item_5 #899 0u | point_template z_t_balrog #138 5u | point_entity_finder balrogfinder #13285 138u | filter_activator_context balrogcontext #13284 144u | filter_activator_context nobalrogcontext #21862 167u | trigger_teleport (unnamed) #7819 168u | filter_multi specialbalrognospeedyfilter #21860 355u
tool suggestion: handlers [88, 180] triggers [7957, 7799]
config:          handlers [720, 718] triggers [7799]
  missing handlers: [720, 718]  extra handlers: [88, 180]
  missing triggers: []  extra triggers: [7957]
  note: trigger item_balrog_18: parented to weapon (parentname); touching it fires the item handlers
  note: handler TFilter_1 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: handler StripAndCleanPlayer (other OnTrigger): item_balrog_18 OnStartTouch → Trigger; fed by a button/trigger
  note: event OnTrigger: 5 effects
  note: trigger trigger_teleport: teleports 0 units from the knife (target z_item_5 (info_teleport_destination))
  note: skipped trigger item_balrog_10 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger item_balrog_23 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 720 type=other event=OnUser1 mode=2 cooldown=3.5 maxuses=0  [MISSED by tool]
  logic_relay item_balrog_7 #720 origin=60 165 3 parent=- lump=138#entityLumpName (templated)
    keys: startdisabled=0
    fired by: func_physbox ph_item_balrog_hp #727 OnBreak→Kill | logic_case item_balrog_11 #717 OnCase15→Trigger | logic_relay item_balrog_8 #718 OnUser1→Disable | logic_relay item_balrog_8 #718 OnUser1→Enable +6.5s
    outputs:
      OnUser1 → [PR#]item_balrog_1 SetAnimation "balrog_attack1" [prop_dynamic]
      OnUser1 → [PR#]item_balrog_9 StartSound +1.25s [snd_event_point]
      OnUser1 → [PR#]item_balrog_8 Disable [logic_relay]
      OnUser1 → [PR#]item_balrog_8 Enable +3.5s [logic_relay]
      OnUser1 → [PR#]item_balrog_10 Enable +1.75s [trigger_hurt]
      OnUser1 → [PR#]item_balrog_10 Disable +2.200000047683716s [trigger_hurt]
      OnUser1 → !activator KeyValues "speed 0" [unresolved]
      OnUser1 → !self Disable [unresolved]
      OnUser1 → !self Enable +3.5s [unresolved]
      OnUser1 → !self AddOutput "OnTrigger>!self>FireUser1>>0>1" +3.5s [unresolved]
      OnTrigger → !self FireUser1 [unresolved]
      OnUser1 → [PR#]item_balrog_22 Disable [logic_timer]
      OnUser1 → [PR#]item_balrog_22 Enable +3.5s [logic_timer]
      OnUser1 → [PR#]item_balrog_24 Explode +1.75s [env_physexplosion,env_physexplosion]
      … +8 more
  distance to weapon: 18299u
  tool event guesses: OnUser1 (8.0: leads to Enable after 15s (cooldown chain), 32 effects) | OnTrigger (4.3: 1 effect)
  tool cooldown guess: 6.5s (item_balrog_8 OnUser1 → item_balrog_7 Enable (+6.5s))
config handler 718 type=other event=OnUser1 mode=2 cooldown=15 maxuses=0  [MISSED by tool]
  logic_relay item_balrog_8 #718 origin=60 197 3 parent=- lump=138#entityLumpName (templated)
    keys: startdisabled=0
    fired by: func_physbox ph_item_balrog_hp #727 OnBreak→Kill | logic_case item_balrog_11 #717 OnCase16→Trigger | logic_relay item_balrog_7 #720 OnUser1→Disable | logic_relay item_balrog_7 #720 OnUser1→Enable +3.5s
    outputs:
      OnUser1 → [PR#]item_balrog_12 Enable [trigger_multiple]
      OnUser1 → [PR#]item_balrog_12 Disable +3s [trigger_multiple]
      OnUser1 → [PR#]item_balrog_1 SetAnimation "balrog_groar" [prop_dynamic]
      OnUser1 → [PR#]item_balrog_21 StartSound +1s [point_soundevent]
      OnUser1 → !activator KeyValues "speed 0" [unresolved]
      OnUser1 → !self Disable [unresolved]
      OnUser1 → !self Enable +15s [unresolved]
      OnUser1 → [PR#]item_balrog_7 Disable [logic_relay]
      OnUser1 → [PR#]item_balrog_7 Enable +6.5s [logic_relay]
      OnTrigger → !self FireUser1 [unresolved]
      OnUser1 → !self AddOutput "OnTrigger>!self>FireUser1>>0>1" +15s [unresolved]
      OnUser1 → [PR#]item_balrog_22 Disable [logic_timer]
      OnUser1 → [PR#]item_balrog_22 Enable +6.5s [logic_timer]
      OnUser1 → !activator KeyValues "speed 0.7" +6s [unresolved]
  distance to weapon: 18293u
  tool event guesses: OnUser1 (8.0: leads to Enable after 15s (cooldown chain), 32 effects) | OnTrigger (4.3: 1 effect)
  tool cooldown guess: 15s (item_balrog_8 OnUser1 → item_balrog_8 Enable (+15s))
config trigger 7799  [found by tool]
  trigger_teleport (unnamed) #7799 origin=11104 1564 10086 parent=- lump=default_ents
    keys: target=[PR#]z_item_5, filtername=[PR#]filter_5, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → [PR#]z_t_balrog ForceSpawn [point_template]
      OnStartTouch → !self Kill [unresolved]
  distance to weapon: 3700u
  strips: no
  teleports to: 12656 3456 12863 (target z_item_5 (info_teleport_destination)) → 0u from weapon
knife selection-trigger search: trigger_teleport (unnamed) #7799 (teleports 0 units from the knife (target z_item_5 (info_teleport_destination)))

### "Zombie Nazgul" hammerid=395
weapon: knife=true
  weapon_knife item_nazgul_5&0000 #395 origin=-5 -1 41 parent=- lump=977#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValues "speed 3" [unresolved]
      OnPlayerPickup → [PR#]item_nazgul_3 Enable +0.05000000074505806s [logic_timer]
      OnPlayerPickup → [PR#]item_nazgul_1&0000 Enable [logic_timer]
      OnPlayerPickup → !activator KeyValues "health 60000" [unresolved]
      OnPlayerPickup → !activator KeyValues "max_health 60000" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]nohumanos" [unresolved]
      OnPlayerPickup → !activator AddContext "nazgul:1" [unresolved]
      OnPlayerPickup → [PR#]nazgului&0000 Activate [logic_case]
      OnPlayerPickup → !activator KeyValues "gravity 0.6" [unresolved]
      OnPlayerPickup → !activator AddOutput "OnKilled>resetplayeritem>Trigger>>3>1" [unresolved]
      OnPlayerPickup → [PR#]ph_item_nazgul_7&0000 FireUser1 [func_physbox]
      OnPlayerPickup → [PR#]item_nazgul_speed_timer&0000 Enable [logic_timer]
  within 512u: trigger_push object_soldier_2_4&0000 #7940 1u | trigger_multiple object_soldier_2_4&0000 #8038 1u | func_physbox ph_item_armor_2_d2&0000 #34608 3u | point_soundevent item_armor_hit_snd&0000 #34609 3u | point_soundevent item_armor_hit_snd&0000 #34610 3u | info_particle_system item_tnt_s4 #2632 4u | func_physbox ph_barricade_14&0000 #782 5u | trigger_multiple object_soldier_2_2&0000 #8042 5u | trigger_multiple object_soldier_2_3&0000 #8036 5u | trigger_push object_soldier_2_2&0000 #7936 5u | trigger_push object_soldier_2_3&0000 #7938 5u | prop_dynamic ph_barricade_prop_1&0000 #2758 5u | env_entity_maker item_supply_s6 #360 6u | trigger_push object_soldier_2&0000 #7934 6u | func_button stage_1_barricade_1_36_2&0000 #239 6u | trigger_multiple object_soldier_2&0000 #8040 6u
tool suggestion: handlers [37, 89, 47019, 973, 13329, 976] triggers []
config:          handlers [] triggers [7755, 7753]
  missing handlers: []  extra handlers: [37, 89, 47019, 973, 13329, 976]
  missing triggers: [7755, 7753]  extra triggers: []
  note: template lump 977#entityLumpName: 13 entities (logic_timer, trigger_hurt, func_physbox, logic_timer, logic_case)
  note: handler ph_item_nazgul_7&0000 (button OnBreak): parented to weapon (parentname)
  note: event OnBreak: leads to Enable after 0.10000000149011612s (cooldown chain), 19 effects
  note: cooldown 0.05000000074505806s: item_nazgul_5&0000 OnPlayerPickup → item_nazgul_3 Enable (+0.05000000074505806s)
  note: handler TFilter_3 (other OnPass): references weapon via filtername
  note: templated=false: the weapon is spawned by a template but TFilter_3 is a single map entity
  note: event OnPass: class default (no connections in map)
  note: handler item_nazgul_speed_timer&0000 (other OnTimer): same template lump (977#entityLumpName); fed by a button/trigger
  note: event OnTimer: leads to Enable after 0.10000000149011612s (cooldown chain), 29 effects
  note: cooldown 0.05000000074505806s: item_nazgul_5&0000 OnPlayerPickup → item_nazgul_3 Enable (+0.05000000074505806s)
  note: handler item_nazgul_1&0000 (other OnTimer): same template lump (977#entityLumpName); fed by a button/trigger
  note: event OnTimer: 2 effects
  note: cooldown 0.05000000074505806s: item_nazgul_5&0000 OnPlayerPickup → item_nazgul_3 Enable (+0.05000000074505806s)
  note: handler nazgului&0000 (other OnCase02): same template lump (977#entityLumpName); fed by a button/trigger
  note: event OnCase02: 5 effects
  note: cooldown 0.05000000074505806s: item_nazgul_5&0000 OnPlayerPickup → item_nazgul_3 Enable (+0.05000000074505806s)
  note: handler item_nazgul_3 (other OnTimer): ph_item_nazgul_7&0000 OnBreak → Disable; fed by a button/trigger
  note: templated=false: the weapon is spawned by a template but item_nazgul_3 is a single map entity
  note: event OnTimer: 4 effects
  note: cooldown 0.05000000074505806s: item_nazgul_5&0000 OnPlayerPickup → item_nazgul_3 Enable (+0.05000000074505806s)
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped trigger item_nazgul_12&0000 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config trigger 7755  [MISSED by tool]
  trigger_teleport stage_1_triggerx #7755 origin=-6192 1864 5780 parent=- lump=default_ents
    keys: target=[PR#]stage_1_item_naz_tele, filtername=[PR#]zombies, spawnflags=4097, startdisabled=1
    fired by: math_counter max_3_naz #1384 OnHitMax→Disable | trigger_once (unnamed) #13293 OnStartTouch→FireUser1 | trigger_once (unnamed) #13295 OnStartTouch→FireUser1 | trigger_once (unnamed) #13297 OnStartTouch→FireUser1 | trigger_once (unnamed) #13299 OnStartTouch→FireUser1 | trigger_once (unnamed) #13301 OnStartTouch→FireUser1 +7s | trigger_once (unnamed) #13303 OnStartTouch→FireUser1 | trigger_once (unnamed) #13305 OnStartTouch→FireUser1 | +1
    outputs:
      OnStartTouch → [PR#]max_3_naz Add "1" [math_counter]
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
      OnStartTouch → [PR#]item_nazgul_TemplateM ForceSpawn [env_entity_maker]
      OnUser1 → !self Enable [unresolved]
  distance to weapon: 8642u
  strips: no
  teleports to: -6582 2228 7072 (target stage_1_item_naz_tele (info_teleport_destination)) → 9882u from weapon
config trigger 7753  [MISSED by tool]
  trigger_teleport stage_1_triggerx #7753 origin=5035 -380 -3452 parent=- lump=default_ents
    keys: target=[PR#]stage_1_item_naz_tele2, filtername=[PR#]zombies_and_no_items, spawnflags=4097, startdisabled=0
    fired by: math_counter max_3_naz #1384 OnHitMax→Disable | trigger_once (unnamed) #13293 OnStartTouch→FireUser1 | trigger_once (unnamed) #13295 OnStartTouch→FireUser1 | trigger_once (unnamed) #13297 OnStartTouch→FireUser1 | trigger_once (unnamed) #13299 OnStartTouch→FireUser1 | trigger_once (unnamed) #13301 OnStartTouch→FireUser1 +7s | trigger_once (unnamed) #13303 OnStartTouch→FireUser1 | trigger_once (unnamed) #13305 OnStartTouch→FireUser1 | +1
    outputs:
      OnStartTouch → [PR#]item_nazgul_TemplateM2 ForceSpawn [env_entity_maker]
      OnStartTouch → [PR#]StripAndCleanPlayer Trigger [logic_relay]
      OnStartTouch → [PR#]max_3_naz Add "1" [math_counter]
  distance to weapon: 6144u
  strips: no
  teleports to: -1590 476 254 (target stage_1_item_naz_tele2 (info_teleport_destination)) → 1669u from weapon
knife selection-trigger search: nothing

### "Barricade - Toilet" hammerid=760
weapon: knife=false
  weapon_deagle stage_1_barricade_1_47&0000 #760 origin=2 52 -8 parent=- lump=772#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_45_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_45_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_45&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_45&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_35&0000 #756 2u | weapon_deagle stage_1_barricade_1_5&0000 #750 2u | weapon_deagle stage_1_barricade_1_38&0000 #757 4u | weapon_deagle stage_1_barricade_1_29&0000 #755 4u | weapon_deagle stage_1_barricade_1_11&0000 #752 4u | logic_relay DTurd #93 7u | weapon_deagle stage_1_barricade_1_41&0000 #758 8u | weapon_deagle stage_1_barricade_1_14&0000 #753 8u | weapon_deagle stage_1_barricade_1_1&0000 #749 8u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 16u | weapon_deagle stage_1_barricade_1_20&0000 #754 24u | snd_event_point exploex #1426 28u | logic_case newH_item_horse_9&0000 #681 31u | post_processing_volume EXTREME_PP #13143 37u | info_particle_system stage_1_barricade_1_12&0000 #2738 38u
tool suggestion: handlers [237, 30361] triggers []
config:          handlers [237] triggers []
  missing handlers: []  extra handlers: [30361]
  missing triggers: []  extra triggers: []
  note: template lump 772#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_45_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_45_2&0000 wait = 3
  note: handler cadefix1&0000 (other OnTrigger): same template lump (772#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_45_2&0000 wait = 3
config handler 237 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_45_2&0000 #237 origin=2 3 17 parent=[PR#]stage_1_barricade_1_47&0000 lump=772#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_47&0000 #760 OnPlayerPickup→FireUser1 | logic_relay cadefix1&0000 #30361 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix1&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix1&0000 Trigger [logic_relay]
  distance to weapon: 55u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_45_2&0000 wait = 3)

### "Barricade - Bench" hammerid=759
weapon: knife=false
  weapon_deagle stage_1_barricade_1_44&0000 #759 origin=2 50 6 parent=- lump=771#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_42_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_42_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_42&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_42&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: logic_relay DTurd #93 11u | weapon_deagle stage_1_barricade_1_29&0000 #755 14u | weapon_deagle stage_1_barricade_1_11&0000 #752 14u | weapon_deagle stage_1_barricade_1_47&0000 #760 14u | weapon_deagle stage_1_barricade_1_35&0000 #756 14u | weapon_deagle stage_1_barricade_1_5&0000 #750 14u | weapon_deagle stage_1_barricade_1_38&0000 #757 14u | weapon_deagle stage_1_barricade_1_41&0000 #758 17u | weapon_deagle stage_1_barricade_1_14&0000 #753 17u | weapon_deagle stage_1_barricade_1_1&0000 #749 17u | weapon_deagle stage_1_barricade_1_8&0000 #751 23u | logic_case newH_item_horse_9&0000 #681 25u | info_particle_system stage_1_barricade_1_12&0000 #2738 28u | weapon_deagle stage_1_barricade_1_20&0000 #754 30u | point_soundevent newH_item_horse_5&0000 #678 32u | logic_relay item_armor_relay&0000 #34606 33u
tool suggestion: handlers [235, 30364] triggers []
config:          handlers [235] triggers []
  missing handlers: []  extra handlers: [30364]
  missing triggers: []  extra triggers: []
  note: template lump 771#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_42_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_42_2&0000 wait = 3
  note: handler cadefix2&0000 (other OnTrigger): same template lump (771#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_42_2&0000 wait = 3
config handler 235 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_42_2&0000 #235 origin=2 0 21 parent=[PR#]stage_1_barricade_1_44&0000 lump=771#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_44&0000 #759 OnPlayerPickup→FireUser1 | logic_relay cadefix2&0000 #30364 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix2&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix2&0000 Trigger [logic_relay]
  distance to weapon: 51u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_42_2&0000 wait = 3)

### "Barricade - Shelf" hammerid=758
weapon: knife=false
  weapon_deagle stage_1_barricade_1_41&0000 #758 origin=0 60 -8 parent=- lump=770#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_39_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_39_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_39&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_39&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_14&0000 #753 0u | weapon_deagle stage_1_barricade_1_1&0000 #749 0u | weapon_deagle stage_1_barricade_1_35&0000 #756 8u | weapon_deagle stage_1_barricade_1_5&0000 #750 8u | weapon_deagle stage_1_barricade_1_47&0000 #760 8u | weapon_deagle stage_1_barricade_1_8&0000 #751 9u | weapon_deagle stage_1_barricade_1_38&0000 #757 10u | weapon_deagle stage_1_barricade_1_29&0000 #755 12u | weapon_deagle stage_1_barricade_1_11&0000 #752 12u | logic_relay DTurd #93 14u | weapon_deagle stage_1_barricade_1_20&0000 #754 16u | weapon_deagle stage_1_barricade_1_44&0000 #759 17u | logic_case newH_item_horse_9&0000 #681 27u | snd_event_point exploex #1426 29u | point_soundevent newH_item_horse_5&0000 #678 38u | logic_timer newH_item_horse_10&0000 #682 40u
tool suggestion: handlers [241, 30365] triggers []
config:          handlers [241] triggers []
  missing handlers: []  extra handlers: [30365]
  missing triggers: []  extra triggers: []
  note: template lump 770#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_39_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_39_2&0000 wait = 3
  note: handler cadefix3&0000 (other OnTrigger): same template lump (770#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_39_2&0000 wait = 3
config handler 241 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_39_2&0000 #241 origin=1 0 39 parent=[PR#]stage_1_barricade_1_41&0000 lump=770#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_41&0000 #758 OnPlayerPickup→FireUser1 | logic_relay cadefix3&0000 #30365 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix3&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix3&0000 Trigger [logic_relay]
  distance to weapon: 76u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_39_2&0000 wait = 3)

### "Barricade - Fence" hammerid=757
weapon: knife=false
  weapon_deagle stage_1_barricade_1_38&0000 #757 origin=-2 50 -8 parent=- lump=769#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_36_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_35&0000 #756 3u | weapon_deagle stage_1_barricade_1_29&0000 #755 3u | weapon_deagle stage_1_barricade_1_11&0000 #752 3u | weapon_deagle stage_1_barricade_1_5&0000 #750 3u | weapon_deagle stage_1_barricade_1_47&0000 #760 4u | logic_relay DTurd #93 6u | weapon_deagle stage_1_barricade_1_41&0000 #758 10u | weapon_deagle stage_1_barricade_1_14&0000 #753 10u | weapon_deagle stage_1_barricade_1_1&0000 #749 10u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 19u | weapon_deagle stage_1_barricade_1_20&0000 #754 26u | snd_event_point exploex #1426 32u | logic_case newH_item_horse_9&0000 #681 33u | post_processing_volume EXTREME_PP #13143 35u | info_particle_system stage_1_barricade_1_12&0000 #2738 36u
tool suggestion: handlers [239, 30366] triggers []
config:          handlers [239] triggers []
  missing handlers: []  extra handlers: [30366]
  missing triggers: []  extra triggers: []
  note: template lump 769#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_36_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_36_2&0000 wait = 3
  note: handler cadefix4&0000 (other OnTrigger): same template lump (769#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_36_2&0000 wait = 3
config handler 239 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_36_2&0000 #239 origin=-1 2 36 parent=[PR#]stage_1_barricade_1_38&0000 lump=769#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_38&0000 #757 OnPlayerPickup→FireUser1 | logic_relay cadefix4&0000 #30366 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix4&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix4&0000 Trigger [logic_relay]
  distance to weapon: 65u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_36_2&0000 wait = 3)

### "Barricade - Basket" hammerid=757
weapon: knife=false
  weapon_deagle stage_1_barricade_1_38&0000 #757 origin=-2 50 -8 parent=- lump=769#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_36_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_36&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_35&0000 #756 3u | weapon_deagle stage_1_barricade_1_29&0000 #755 3u | weapon_deagle stage_1_barricade_1_11&0000 #752 3u | weapon_deagle stage_1_barricade_1_5&0000 #750 3u | weapon_deagle stage_1_barricade_1_47&0000 #760 4u | logic_relay DTurd #93 6u | weapon_deagle stage_1_barricade_1_41&0000 #758 10u | weapon_deagle stage_1_barricade_1_14&0000 #753 10u | weapon_deagle stage_1_barricade_1_1&0000 #749 10u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 19u | weapon_deagle stage_1_barricade_1_20&0000 #754 26u | snd_event_point exploex #1426 32u | logic_case newH_item_horse_9&0000 #681 33u | post_processing_volume EXTREME_PP #13143 35u | info_particle_system stage_1_barricade_1_12&0000 #2738 36u
tool suggestion: handlers [239, 30366] triggers []
config:          handlers [225] triggers []
  missing handlers: [225]  extra handlers: [239, 30366]
  missing triggers: []  extra triggers: []
  note: template lump 769#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_36_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_36_2&0000 wait = 3
  note: handler cadefix4&0000 (other OnTrigger): same template lump (769#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_36_2&0000 wait = 3
config handler 225 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [MISSED by tool]
  func_button stage_1_barricade_1_33_2&0000 #225 origin=0 0 13 parent=[PR#]stage_1_barricade_1_35&0000 lump=768#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_35&0000 #756 OnPlayerPickup→FireUser1 | logic_relay cadefix5&0000 #30367 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix5&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix5&0000 Trigger [logic_relay]
  distance to weapon: 54u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_33_2&0000 wait = 3)

### "Barricade - Plank" hammerid=755
weapon: knife=false
  weapon_deagle stage_1_barricade_1_29&0000 #755 origin=0 48 -8 parent=- lump=767#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_27_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_27_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_27&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_27&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_11&0000 #752 0u | weapon_deagle stage_1_barricade_1_38&0000 #757 3u | weapon_deagle stage_1_barricade_1_35&0000 #756 4u | weapon_deagle stage_1_barricade_1_5&0000 #750 4u | logic_relay DTurd #93 4u | weapon_deagle stage_1_barricade_1_47&0000 #760 4u | weapon_deagle stage_1_barricade_1_41&0000 #758 12u | weapon_deagle stage_1_barricade_1_14&0000 #753 12u | weapon_deagle stage_1_barricade_1_1&0000 #749 12u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 20u | weapon_deagle stage_1_barricade_1_20&0000 #754 28u | snd_event_point exploex #1426 31u | post_processing_volume EXTREME_PP #13143 33u | logic_case newH_item_horse_9&0000 #681 34u | info_particle_system stage_1_barricade_1_12&0000 #2738 35u
tool suggestion: handlers [245, 30368] triggers []
config:          handlers [245] triggers []
  missing handlers: []  extra handlers: [30368]
  missing triggers: []  extra triggers: []
  note: template lump 767#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_27_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_27_2&0000 wait = 3
  note: handler cadefix6&0000 (other OnTrigger): same template lump (767#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_27_2&0000 wait = 3
config handler 245 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_27_2&0000 #245 origin=1 1 46 parent=[PR#]stage_1_barricade_1_29&0000 lump=767#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_29&0000 #755 OnPlayerPickup→FireUser1 | logic_relay cadefix6&0000 #30368 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix6&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix6&0000 Trigger [logic_relay]
  distance to weapon: 72u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_27_2&0000 wait = 3)

### "Barricade - Haybale" hammerid=752
weapon: knife=false
  weapon_deagle stage_1_barricade_1_11&0000 #752 origin=0 48 -8 parent=- lump=766#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_9_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_9_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_9&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_9&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_29&0000 #755 0u | weapon_deagle stage_1_barricade_1_38&0000 #757 3u | weapon_deagle stage_1_barricade_1_35&0000 #756 4u | weapon_deagle stage_1_barricade_1_5&0000 #750 4u | logic_relay DTurd #93 4u | weapon_deagle stage_1_barricade_1_47&0000 #760 4u | weapon_deagle stage_1_barricade_1_41&0000 #758 12u | weapon_deagle stage_1_barricade_1_14&0000 #753 12u | weapon_deagle stage_1_barricade_1_1&0000 #749 12u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 20u | weapon_deagle stage_1_barricade_1_20&0000 #754 28u | snd_event_point exploex #1426 31u | post_processing_volume EXTREME_PP #13143 33u | logic_case newH_item_horse_9&0000 #681 34u | info_particle_system stage_1_barricade_1_12&0000 #2738 35u
tool suggestion: handlers [229, 30369] triggers []
config:          handlers [229] triggers []
  missing handlers: []  extra handlers: [30369]
  missing triggers: []  extra triggers: []
  note: template lump 766#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_9_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_9_2&0000 wait = 3
  note: handler cadefix7&0000 (other OnTrigger): same template lump (766#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_9_2&0000 wait = 3
config handler 229 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_9_2&0000 #229 origin=-2 0 28 parent=[PR#]stage_1_barricade_1_11&0000 lump=766#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_11&0000 #752 OnPlayerPickup→FireUser1 | logic_relay cadefix7&0000 #30369 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix7&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix7&0000 Trigger [logic_relay]
  distance to weapon: 60u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_9_2&0000 wait = 3)

### "Barricade - Big Boulder" hammerid=754
weapon: knife=false
  weapon_deagle stage_1_barricade_1_20&0000 #754 origin=0 76 -8 parent=- lump=765#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_18_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_18_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_18&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_18&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_8&0000 #751 9u | weapon_deagle stage_1_barricade_1_41&0000 #758 16u | weapon_deagle stage_1_barricade_1_14&0000 #753 16u | weapon_deagle stage_1_barricade_1_1&0000 #749 16u | logic_case newH_item_horse_9&0000 #681 24u | weapon_deagle stage_1_barricade_1_35&0000 #756 24u | weapon_deagle stage_1_barricade_1_5&0000 #750 24u | weapon_deagle stage_1_barricade_1_47&0000 #760 24u | weapon_deagle stage_1_barricade_1_38&0000 #757 26u | weapon_deagle stage_1_barricade_1_29&0000 #755 28u | weapon_deagle stage_1_barricade_1_11&0000 #752 28u | weapon_deagle stage_1_barricade_1_44&0000 #759 30u | logic_relay DTurd #93 30u | logic_timer newH_item_horse_10&0000 #682 32u | snd_event_point exploex #1426 34u | point_soundevent newH_item_horse_5&0000 #678 41u
tool suggestion: handlers [233, 30370] triggers []
config:          handlers [233] triggers []
  missing handlers: []  extra handlers: [30370]
  missing triggers: []  extra triggers: []
  note: template lump 765#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_18_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_18_2&0000 wait = 3
  note: handler cadefix8&0000 (other OnTrigger): same template lump (765#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_18_2&0000 wait = 3
config handler 233 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_18_2&0000 #233 origin=1 1 19 parent=[PR#]stage_1_barricade_1_20&0000 lump=765#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_20&0000 #754 OnPlayerPickup→FireUser1 | logic_relay cadefix8&0000 #30370 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix8&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix8&0000 Trigger [logic_relay]
  distance to weapon: 80u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_18_2&0000 wait = 3)

### "Barricade - Boulder" hammerid=751
weapon: knife=false
  weapon_deagle stage_1_barricade_1_8&0000 #751 origin=4 68 -8 parent=- lump=764#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_6_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_6_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_6&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_6&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_41&0000 #758 9u | weapon_deagle stage_1_barricade_1_20&0000 #754 9u | weapon_deagle stage_1_barricade_1_14&0000 #753 9u | weapon_deagle stage_1_barricade_1_1&0000 #749 9u | weapon_deagle stage_1_barricade_1_47&0000 #760 16u | weapon_deagle stage_1_barricade_1_35&0000 #756 16u | weapon_deagle stage_1_barricade_1_5&0000 #750 16u | weapon_deagle stage_1_barricade_1_38&0000 #757 19u | weapon_deagle stage_1_barricade_1_29&0000 #755 20u | weapon_deagle stage_1_barricade_1_11&0000 #752 20u | logic_relay DTurd #93 23u | weapon_deagle stage_1_barricade_1_44&0000 #759 23u | logic_case newH_item_horse_9&0000 #681 24u | snd_event_point exploex #1426 27u | point_soundevent newH_item_horse_5&0000 #678 36u | logic_timer newH_item_horse_10&0000 #682 37u
tool suggestion: handlers [231, 30371] triggers []
config:          handlers [231] triggers []
  missing handlers: []  extra handlers: [30371]
  missing triggers: []  extra triggers: []
  note: template lump 764#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_6_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_6_2&0000 wait = 3
  note: handler cadefix9&0000 (other OnTrigger): same template lump (764#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_6_2&0000 wait = 3
config handler 231 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_6_2&0000 #231 origin=2 -1 15 parent=[PR#]stage_1_barricade_1_8&0000 lump=764#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_8&0000 #751 OnPlayerPickup→FireUser1 | logic_relay cadefix9&0000 #30371 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix9&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix9&0000 Trigger [logic_relay]
  distance to weapon: 73u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_6_2&0000 wait = 3)

### "Barricade - Barrel" hammerid=750
weapon: knife=false
  weapon_deagle stage_1_barricade_1_5&0000 #750 origin=0 52 -8 parent=- lump=763#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_2_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_2_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_2&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_2&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_35&0000 #756 0u | weapon_deagle stage_1_barricade_1_47&0000 #760 2u | weapon_deagle stage_1_barricade_1_38&0000 #757 3u | weapon_deagle stage_1_barricade_1_29&0000 #755 4u | weapon_deagle stage_1_barricade_1_11&0000 #752 4u | logic_relay DTurd #93 7u | weapon_deagle stage_1_barricade_1_41&0000 #758 8u | weapon_deagle stage_1_barricade_1_14&0000 #753 8u | weapon_deagle stage_1_barricade_1_1&0000 #749 8u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u | weapon_deagle stage_1_barricade_1_8&0000 #751 16u | weapon_deagle stage_1_barricade_1_20&0000 #754 24u | snd_event_point exploex #1426 30u | logic_case newH_item_horse_9&0000 #681 31u | post_processing_volume EXTREME_PP #13143 37u | info_particle_system stage_1_barricade_1_12&0000 #2738 38u
tool suggestion: handlers [243, 30372] triggers []
config:          handlers [243] triggers []
  missing handlers: []  extra handlers: [30372]
  missing triggers: []  extra triggers: []
  note: template lump 763#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_2_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_2_2&0000 wait = 3
  note: handler cadefix10&0000 (other OnTrigger): same template lump (763#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_2_2&0000 wait = 3
config handler 243 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_2_2&0000 #243 origin=-1 0 11 parent=[PR#]stage_1_barricade_1_5&0000 lump=763#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_5&0000 #750 OnPlayerPickup→FireUser1 | logic_relay cadefix10&0000 #30372 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix10&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix10&0000 Trigger [logic_relay]
  distance to weapon: 55u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_2_2&0000 wait = 3)

### "Barricade - Table" hammerid=753
weapon: knife=false
  weapon_deagle stage_1_barricade_1_14&0000 #753 origin=0 60 -8 parent=- lump=762#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_12_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_12_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_12&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_12&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_41&0000 #758 0u | weapon_deagle stage_1_barricade_1_1&0000 #749 0u | weapon_deagle stage_1_barricade_1_35&0000 #756 8u | weapon_deagle stage_1_barricade_1_5&0000 #750 8u | weapon_deagle stage_1_barricade_1_47&0000 #760 8u | weapon_deagle stage_1_barricade_1_8&0000 #751 9u | weapon_deagle stage_1_barricade_1_38&0000 #757 10u | weapon_deagle stage_1_barricade_1_29&0000 #755 12u | weapon_deagle stage_1_barricade_1_11&0000 #752 12u | logic_relay DTurd #93 14u | weapon_deagle stage_1_barricade_1_20&0000 #754 16u | weapon_deagle stage_1_barricade_1_44&0000 #759 17u | logic_case newH_item_horse_9&0000 #681 27u | snd_event_point exploex #1426 29u | point_soundevent newH_item_horse_5&0000 #678 38u | logic_timer newH_item_horse_10&0000 #682 40u
tool suggestion: handlers [247, 30373] triggers []
config:          handlers [247] triggers []
  missing handlers: []  extra handlers: [30373]
  missing triggers: []  extra triggers: []
  note: template lump 762#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_12_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_12_2&0000 wait = 3
  note: handler cadefix11&0000 (other OnTrigger): same template lump (762#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_12_2&0000 wait = 3
config handler 247 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_12_2&0000 #247 origin=1 7 17 parent=[PR#]stage_1_barricade_1_14&0000 lump=762#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_14&0000 #753 OnPlayerPickup→FireUser1 | logic_relay cadefix11&0000 #30373 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix11&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix11&0000 Trigger [logic_relay]
  distance to weapon: 58u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_12_2&0000 wait = 3)

### "Barricade - Crate" hammerid=749
weapon: knife=false
  weapon_deagle stage_1_barricade_1_1&0000 #749 origin=0 60 -8 parent=- lump=761#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_0_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_0_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_0&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_0&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader:1" [unresolved]
  within 512u: weapon_deagle stage_1_barricade_1_41&0000 #758 0u | weapon_deagle stage_1_barricade_1_14&0000 #753 0u | weapon_deagle stage_1_barricade_1_35&0000 #756 8u | weapon_deagle stage_1_barricade_1_5&0000 #750 8u | weapon_deagle stage_1_barricade_1_47&0000 #760 8u | weapon_deagle stage_1_barricade_1_8&0000 #751 9u | weapon_deagle stage_1_barricade_1_38&0000 #757 10u | weapon_deagle stage_1_barricade_1_29&0000 #755 12u | weapon_deagle stage_1_barricade_1_11&0000 #752 12u | logic_relay DTurd #93 14u | weapon_deagle stage_1_barricade_1_20&0000 #754 16u | weapon_deagle stage_1_barricade_1_44&0000 #759 17u | logic_case newH_item_horse_9&0000 #681 27u | snd_event_point exploex #1426 29u | point_soundevent newH_item_horse_5&0000 #678 38u | logic_timer newH_item_horse_10&0000 #682 40u
tool suggestion: handlers [227, 30374] triggers []
config:          handlers [227] triggers []
  missing handlers: []  extra handlers: [30374]
  missing triggers: []  extra triggers: []
  note: template lump 761#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_0_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_0_2&0000 wait = 3
  note: handler cadefix12&0000 (other OnTrigger): same template lump (761#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: stage_1_barricade_1_0_2&0000 wait = 3
config handler 227 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button stage_1_barricade_1_0_2&0000 #227 origin=0 0 24 parent=[PR#]stage_1_barricade_1_1&0000 lump=761#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle stage_1_barricade_1_1&0000 #749 OnPlayerPickup→FireUser1 | logic_relay cadefix12&0000 #30374 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix12&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix12&0000 Trigger [logic_relay]
  distance to weapon: 68u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (stage_1_barricade_1_0_2&0000 wait = 3)

### "Barricade - Explosive Barrel" hammerid=736
weapon: knife=false
  weapon_deagle prop_explosive_temp2&0000 #736 origin=-55 3 -3 parent=- lump=1252#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]prop_explosive_temp1_5 Enable [unresolved]
      OnPlayerPickup → [PR#]prop_explosive_temp1_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]prop_explosive_temp1&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]prop_explosive_temp1&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
  within 512u: trigger_hurt item_oil_10&0000 #8260 28u | func_rotating item_oil_5x&0000 #2760 28u | info_particle_system item_oil_12&0000 #2759 34u | prop_dynamic item_totem_2&0000 #2823 35u | env_physexplosion item_tnt_s3 #83 38u | info_particle_system stage_1_barricade_1_9&0000 #2741 39u | logic_measure_movement item_oil_16&0000 #119 40u | logic_relay prop_explosive_2&0000 #738 47u | prop_dynamic_override nnew1_shortTorch2&0000 #733 47u | prop_dynamic_override new1_shortTorch2&0000 #730 47u | info_particle_system extreme_indicador #3081 47u | prop_dynamic ph_barricade_prop_2&0000 #2757 48u | weapon_knife item_totem_1&0000 #900 50u | weapon_knife item_flag_1&0000 #901 50u | weapon_knife item_armor_2_c&0000 #145 50u | weapon_knife newH_item_horse_2&0000 #675 51u
tool suggestion: handlers [249, 30375] triggers []
config:          handlers [249] triggers []
  missing handlers: []  extra handlers: [30375]
  missing triggers: []  extra triggers: []
  note: template lump 1252#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler prop_explosive_temp1_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: prop_explosive_temp1_2&0000 wait = 3
  note: handler cadefix13&0000 (other OnTrigger): same template lump (1252#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects
  note: cooldown 3s: prop_explosive_temp1_2&0000 wait = 3
config handler 249 type=button event=OnPressed mode=3 cooldown=0 maxuses=1  [found by tool]
  func_button prop_explosive_temp1_2&0000 #249 origin=2 1 16 parent=[PR#]prop_explosive_temp2&0000 lump=1252#entityLumpName (templated)
    keys: spawnflags=17409, wait=3
    fired by: weapon_deagle prop_explosive_temp2&0000 #736 OnPlayerPickup→FireUser1 | logic_relay cadefix13&0000 #30375 OnTrigger→Kill
    outputs:
      OnUser1 → [PR#]cadefix13&0000 Enable [logic_relay]
      OnPressed → [PR#]cadefix13&0000 Trigger [logic_relay]
  distance to weapon: 60u
  tool event guesses: OnPressed (6.8: 7 effects) | OnUser1 (2.3: 7 effects)
  tool cooldown guess: 3s (prop_explosive_temp1_2&0000 wait = 3)

## Summary (config handlers found / extra, config triggers found / extra)
| item | hammerid | handlers cfg/found | extra | triggers cfg/found | extra |
| --- | --- | --- | --- | --- | --- |
| Flag | 901 | 0/0 | 0 | 1/0 | 0 |
| Armor | 145 | 0/0 | 2 | 1/0 | 0 |
| Ammo Barrel | 351 | 1/0 | 1 | 1/1 | 0 |
| Oil Barrel | 865 | 1/0 | 0 | 1/1 | 0 |
| Horse | 675 | 0/0 | 3 | 1/0 | 0 |
| Gandalf | 683 | 2/0 | 3 | 1/1 | 2 |
| White Knight | 695 | 2/2 | 13 | 1/1 | 0 |
| Zombie Totem Pole | 900 | 0/0 | 0 | 1/0 | 0 |
| Zombie TNT Barrel | 1117 | 1/0 | 1 | 1/1 | 1 |
| Zombie Ladder | 157 | 0/0 | 1 | 1/1 | 5 |
| Zombie Ladder | 167 | 0/0 | 1 | 0/0 | 6 |
| Zombie Troll | 348 | 0/0 | 6 | 1/0 | 0 |
| Zombie Balrog | 716 | 2/0 | 2 | 1/1 | 1 |
| Zombie Nazgul | 395 | 0/0 | 6 | 2/0 | 0 |
| Barricade - Toilet | 760 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Bench | 759 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Shelf | 758 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Fence | 757 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Basket | 757 | 1/0 | 2 | 0/0 | 0 |
| Barricade - Plank | 755 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Haybale | 752 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Big Boulder | 754 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Boulder | 751 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Barrel | 750 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Table | 753 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Crate | 749 | 1/1 | 1 | 0/0 | 0 |
| Barricade - Explosive Barrel | 736 | 1/1 | 1 | 0/0 | 0 |

## Weapons not in the config (4)
### weapon_deagle stage_1_barricade_1_35&0000 #756
  weapon_deagle stage_1_barricade_1_35&0000 #756 origin=0 52 -8 parent=- lump=768#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]stage_1_barricade_1_33_5 Enablex [unresolved]
      OnPlayerPickup → [PR#]stage_1_barricade_1_33_2&0000 FireUser1 [func_button]
      OnPlayerPickup → [PR#]stage_1_barricade_1_33&0000 DisableReceivingFlashlight [info_particle_system]
      OnPlayerPickup → [PR#]stage_1_barricade_1_33&0000 KeyValues "disableshadowdepth 1" [info_particle_system]
      OnPlayerPickup → !activator AddContext "cader" [unresolved]
  within 384u: weapon_deagle stage_1_barricade_1_5&0000 #750 0u | weapon_deagle stage_1_barricade_1_47&0000 #760 2u | weapon_deagle stage_1_barricade_1_38&0000 #757 3u | weapon_deagle stage_1_barricade_1_29&0000 #755 4u | weapon_deagle stage_1_barricade_1_11&0000 #752 4u | logic_relay DTurd #93 7u | weapon_deagle stage_1_barricade_1_41&0000 #758 8u | weapon_deagle stage_1_barricade_1_14&0000 #753 8u | weapon_deagle stage_1_barricade_1_1&0000 #749 8u | weapon_deagle stage_1_barricade_1_44&0000 #759 14u
tool suggestion: handlers [225, 30367:OnTrigger] triggers []
  note: template lump 768#entityLumpName: 4 entities (func_button, logic_relay)
  note: handler stage_1_barricade_1_33_2&0000 (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: 7 effects
  note: cooldown 3s: stage_1_barricade_1_33_2&0000 wait = 3
  note: handler cadefix5&0000 (other OnTrigger): same template lump (768#entityLumpName); fed by a button/trigger
  note: event OnTrigger: 8 effects

### weapon_hegrenade item_supply_s3 #353
  weapon_hegrenade item_supply_s3 #353 origin=0 0 0 parent=- lump=354#entityLumpName (templated)
    keys: spawnflags=1
    fired by: logic_branch item_supply_6 #357 OnFalse→Kill +25s
    outputs:
      OnPlayerPickup → [PR#]item_supply_s6 ForceSpawn +1s [env_entity_maker]
      OnPlayerPickup → !self KeyValues "targetname nothing" [unresolved]
  within 384u: prop_dynamic troll_die_model #34624 0u | game_zone_player SpyOnRemainingPlayers #44 0u | skybox_reference (unnamed) #8323 0u | env_entity_maker factory_template_type15em&0000 #832 0u | info_particle_system BloodGush&0000 #2625 0u | logic_relay BloodGush_Relay&0000 #42 0u | prop_dynamic_override debris_wall&0000 #13229 0u | prop_dynamic_override debris_brick&0000 #13228 0u | prop_dynamic_override debris_wood&0000 #13227 0u | prop_dynamic_override prop_explosive&0000 #737 0u
tool suggestion: handlers [] triggers []
  note: weapon is spawned by item_supply_s5 with 0 other template member(s)
  note: Nothing is wired to or grouped with this weapon (no parent, no template, no outputs). Use the I/O search (e.g. "in:unlock") to find the ability entities and add them with "+".

### weapon_deagle nnew1_stage_2_short_torch&0000 #734
  weapon_deagle nnew1_stage_2_short_torch&0000 #734 origin=-11 -13 -46 parent=- lump=1143#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]nnew1_prop_torch3&0000 Kill +70s [logic_relay,info_particle_system]
      OnPlayerPickup → [PR#]global_aviso_antorcha2 ShowHudHint [env_hudhint]
      OnPlayerPickup → [PR#]nnew1_prop_torch3&0000 Enable [logic_relay,info_particle_system]
      OnPlayerPickup → [PR#]nnew1_stage_2_short_torch_2&0000 FireUser1 [func_door]
      OnPlayerPickup → [PR#]global_aviso_antorcha2 HideHudHint +10s [env_hudhint]
      OnPlayerPickup → [PR#]nnew1_prop_torch3p&0000 FireUser2 [trigger_push]
      OnPlayerPickup → [PR#]nnew1_prop_torch3p&0000 Kill +70s [trigger_push]
      OnPlayerPickup → [PR#]nnew1_prop_torch3_light&0000 Kill +70s [light_omni2]
  within 384u: weapon_deagle new1_stage_2_short_torch&0000 #731 0u | logic_relay item_oil_14&0000 #1424 17u | logic_relay nnew1_prop_torch3&0000 #60 27u | path_track stage_1_path_cheap #943 28u | logic_timer item_oil_15&0000 #1425 29u | trigger_hurt item_supply_s1 #8288 37u | prop_dynamic_override nnew1_shortTorch2&0000 #733 39u | prop_dynamic_override new1_shortTorch2&0000 #730 39u | info_particle_system stage_1_barricade_1_9&0000 #2741 40u | info_particle_system item_oil_12&0000 #2759 41u
tool suggestion: handlers [60:OnSpawn] triggers []
  note: template lump 1143#entityLumpName: 6 entities (logic_relay, trigger_push)
  note: handler nnew1_prop_torch3&0000 (other OnSpawn): same template lump (1143#entityLumpName); only gate in the group
  note: event OnSpawn: leads to Enable after 2s (cooldown chain), 3 effects
  note: cooldown 2s: nnew1_prop_torch3&0000 OnSpawn → nnew1_prop_torch3&0000 Enable (+2s)
  note: skipped trigger nnew1_prop_torch3p&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))

### weapon_deagle new1_stage_2_short_torch&0000 #731
  weapon_deagle new1_stage_2_short_torch&0000 #731 origin=-11 -13 -46 parent=- lump=1142#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]new1_shortTorch&0000 Kill +45s [trigger_multiple]
      OnPlayerPickup → [PR#]new1_prop_torch&0000 Kill +45s [logic_relay,info_particle_system]
      OnPlayerPickup → [PR#]global_aviso_antorcha ShowHudHint [env_hudhint]
      OnPlayerPickup → [PR#]new1_shortTorch2_2&0000 FireUser1 [func_door]
      OnPlayerPickup → [PR#]global_aviso_antorcha HideHudHint +10s [env_hudhint]
      OnPlayerPickup → [PR#]new1_prop_torch_light&0000 Kill +45s [light_omni2]
  within 384u: weapon_deagle nnew1_stage_2_short_torch&0000 #734 0u | logic_relay item_oil_14&0000 #1424 17u | logic_relay nnew1_prop_torch3&0000 #60 27u | path_track stage_1_path_cheap #943 28u | logic_timer item_oil_15&0000 #1425 29u | trigger_hurt item_supply_s1 #8288 37u | prop_dynamic_override nnew1_shortTorch2&0000 #733 39u | prop_dynamic_override new1_shortTorch2&0000 #730 39u | info_particle_system stage_1_barricade_1_9&0000 #2741 40u | info_particle_system item_oil_12&0000 #2759 41u
tool suggestion: handlers [61:OnSpawn] triggers []
  note: template lump 1142#entityLumpName: 6 entities (trigger_multiple, logic_relay)
  note: handler new1_prop_torch&0000 (other OnSpawn): same template lump (1142#entityLumpName); only gate in the group
  note: event OnSpawn: leads to Enable after 2s (cooldown chain), 2 effects
  note: skipped trigger new1_shortTorch&0000 (does not fire the item (nothing it outputs reaches a handler))

