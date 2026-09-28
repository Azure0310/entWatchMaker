# ze_tesv_skyrim_p (3242492031.vpk)
entities 2240, weapons 15, connections 2887, lumps 18
warning: Compiled map read from nested package maps/ze_tesv_skyrim_p.vpk

## Config ../CS2-ZE-Configs/entwatch/ze_tesv_skyrim_p.jsonc: 15 items

### "Nightingale" hammerid=29345
weapon: knife=true
  weapon_knife night_knife #29345 origin=-9402 -2254 -5308 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator SetDamageFilter "[PR#]filter_t_no" [unresolved]
      OnPlayerPickup → !activator KeyValue "health 50000" [unresolved]
      OnPlayerPickup → [PR#]night_ui Activate [logic_case]
      OnPlayerPickup → !activator KeyValue "runspeed 1.17" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]night_dead Test [logic_branch]
      OnPlayerPickup → [PR#]night_user KeyValue "targetname " [unresolved]
      OnPlayerPickup → !activator KeyValue "targetname night_user" +0.10000000149011612s [unresolved]
      OnPlayerPickup → [PR#]night_eye_movement SetMeasureTarget "night_user" +0.15000000596046448s [logic_measure_movement]
      OnPlayerPickup → !activator AddContext "ct_item_user:1" [unresolved]
  within 512u: info_teleport_destination night_in #29348 13u | prop_dynamic night #29353 20u | prop_dynamic night_dummy #29362 20u | logic_relay night_attk #29347 28u | trigger_once (unnamed) #29359 36u | logic_case night_ui #29346 39u | logic_measure_movement night_movement #29361 42u | func_physbox night_phbox #29364 55u | filter_proximity night_knife_filter_c #29366 56u | filter_activator_name night_knife_filter_a #29356 58u | filter_activator_class night_knife_filter_b #29357 60u | filter_multi night_knife_filters #29358 66u | snd_event_point night_haal #29349 72u | point_entity_finder night_knife_stripper #29355 75u | logic_branch night_dead #29367 77u | filter_activator_team night_ct #29368 78u
tool suggestion: handlers [29356] triggers [992]
config:          handlers [29347] triggers [992]
  missing handlers: [29347]  extra handlers: [29356]
  missing triggers: []  extra triggers: []
  note: handler night_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger night_t: teleports 13 units from the knife (target night_in (info_teleport_destination))
config handler 29347 type=other event=OnTrigger mode=2 cooldown=4 maxuses=0  [MISSED by tool]
  logic_relay night_attk #29347 origin=-9416 -2251 -5332 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case night_ui #29346 OnCase01→Trigger | func_physbox night_phbox #29364 OnBreak→Kill +1s
    outputs:
      OnTrigger → [PR#]night SetAnimationNotLooping "lask" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +4s [unresolved]
      OnTrigger → [PR#]arrow_maker ForceSpawn +1.5s [env_entity_maker]
      OnTrigger → [PR#]night_haal StartSound +1.5s [snd_event_point]
  distance to weapon: 28u
  tool event guesses: OnTrigger (8.8: leads to Enable after 4s (cooldown chain), 3 effects)
  tool cooldown guess: 4s (night_attk OnTrigger → night_attk Enable (+4s))
config trigger 992  [found by tool]
  trigger_teleport night_t #992 origin=15431 -15002 2699 parent=- lump=default_ents
    keys: target=[PR#]night_in, filtername=[PR#]level1_ct_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_relay warmup_relay #9531 OnTrigger→Kill
    outputs:
      OnStartTouch → !self Kill [unresolved]
      OnStartTouch → [PR#]night_push Kill [trigger_push]
  distance to weapon: 29040u
  strips: no
  teleports to: -9396 -2254 -5320 (target night_in (info_teleport_destination)) → 13u from weapon
knife selection-trigger search: trigger_teleport night_t #992 (teleports 13 units from the knife (target night_in (info_teleport_destination)))

### "Healmage" hammerid=29494
weapon: knife=true
  weapon_knife mg_knife #29494 origin=-9130 -192 -5194 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]mg_ui Activate [logic_case]
      OnPlayerPickup → !activator KeyValue "health 50000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]filter_t_no" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]mg_dead Test [logic_branch]
      OnPlayerPickup → !activator AddContext "ct_item_user:1" [unresolved]
  within 512u: trigger_once (unnamed) #29512 20u | prop_dynamic maag #29493 26u | prop_dynamic mg_dummy #29516 26u | info_teleport_destination mg_in #29505 28u | filter_proximity mg_knife_filter_c #29511 40u | filter_activator_name mg_knife_filter_a #29507 45u | func_physbox mg_phbox #29500 46u | filter_activator_class mg_knife_filter_b #29508 48u | info_particle_system kaitse #29495 48u | trigger_hurt mg_kaitse1 #29496 53u | filter_multi mg_knife_filters #29509 55u | trigger_hurt push_mg #29498 59u | logic_branch mg_dead #29514 63u | filter_activator_team mg_ct #29517 65u | point_entity_finder mg_knife_stripper #29510 66u | info_particle_system push #29492 67u
tool suggestion: handlers [29507] triggers [984]
config:          handlers [29504, 29506] triggers [984]
  missing handlers: [29504, 29506]  extra handlers: [29507]
  missing triggers: []  extra triggers: []
  note: handler mg_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger mg_t: teleports 28 units from the knife (target mg_in (info_teleport_destination))
  note: skipped trigger mg_kaitse1 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger push_mg (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 29504 type=other event=OnTrigger mode=2 cooldown=8 maxuses=0  [MISSED by tool]
  logic_relay mg_push_rel #29504 origin=-9168 -304 -5146 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case mg_ui #29491 OnCase01→Trigger | func_physbox mg_phbox #29500 OnBreak→Kill +2s
    outputs:
      OnTrigger → [PR#]push_mg Enable [trigger_hurt]
      OnTrigger → [PR#]push_mg Disable +1.5s [trigger_hurt]
      OnTrigger → [PR#]push Start [info_particle_system]
      OnTrigger → [PR#]push Stop +1.5s [info_particle_system]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +8s [unresolved]
      OnTrigger → [PR#]maag_look_haal StartSound [snd_event_point]
      OnTrigger → [PR#]maag SetAnimationNotLooping "[PR#]rynnak" [prop_dynamic]
      OnTrigger → [PR#]lvl1_boss_relay Trigger +4s [logic_relay]
  distance to weapon: 128u
  tool event guesses: OnTrigger (10.0: leads to Enable after 8s (cooldown chain), 55 effects)
  tool cooldown guess: 8s (mg_push_rel OnTrigger → mg_push_rel Enable (+8s))
config handler 29506 type=other event=OnTrigger mode=2 cooldown=40 maxuses=0  [MISSED by tool]
  logic_relay mg_kaitse #29506 origin=-9168 -284 -5146 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: math_counter BossHpIterations3 #649 OnHitMin→Kill | logic_case mg_ui #29491 OnCase02→Trigger | func_physbox mg_phbox #29500 OnBreak→Kill +2s
    outputs:
      OnTrigger → [PR#]mg_kaitse1 Enable [trigger_hurt]
      OnTrigger → [PR#]mg_kaitse1 Disable +4s [trigger_hurt]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +40s [unresolved]
      OnTrigger → [PR#]kaitse_haal StartSound [snd_event_point]
      OnTrigger → [PR#]kaitse Start [info_particle_system]
      OnTrigger → [PR#]kaitse Stop +4s [info_particle_system]
      OnTrigger → [PR#]maag SetAnimationLooping "[PR#]kaitse" [prop_dynamic]
      OnTrigger → [PR#]maag SetAnimationLooping "jooks" +4s [prop_dynamic]
  distance to weapon: 111u
  tool event guesses: OnTrigger (9.5: leads to Enable after 40s (cooldown chain), 6 effects)
  tool cooldown guess: 40s (mg_kaitse OnTrigger → mg_kaitse Enable (+40s))
config trigger 984  [found by tool]
  trigger_teleport mg_t #984 origin=15312 -15173 2699 parent=- lump=default_ents
    keys: target=[PR#]mg_in, filtername=[PR#]level1_ct_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_relay warmup_relay #9531 OnTrigger→Kill
    outputs:
      OnStartTouch → !self Kill [unresolved]
      OnStartTouch → [PR#]mg_push Kill [trigger_push]
  distance to weapon: 29735u
  strips: no
  teleports to: -9128 -192 -5222 (target mg_in (info_teleport_destination)) → 28u from weapon
knife selection-trigger search: trigger_teleport mg_t #984 (teleports 28 units from the knife (target mg_in (info_teleport_destination)))

### "Dovahkiin" hammerid=29435
weapon: knife=true
  weapon_knife doh_knife #29435 origin=-9232 -838 -5204 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValue "health 50000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]filter_t_no" [unresolved]
      OnPlayerPickup → [PR#]doh_ui Activate [logic_case]
      OnPlayerPickup → [PR#]level2 TestActivator [filter_activator_context]
      OnPlayerPickup → [PR#]level3 TestActivator [filter_activator_context]
      OnPlayerPickup → [PR#]level4 TestActivator [filter_activator_context]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]doh_dead Test [logic_branch]
      OnPlayerPickup → !activator AddContext "ct_item_user:1" [unresolved]
  within 512u: info_teleport_destination doh_in #29443 16u | prop_dynamic dohvakiin #29470 26u | prop_dynamic dohva_dummy #29487 26u | logic_measure_movement dohva_movement #29486 28u | trigger_once (unnamed) #29484 48u | filter_proximity doh_knife_filter_c #29483 52u | func_physbox doh_phbox #29444 54u | trigger_hurt fire_shout #29454 70u | info_particle_system freeze_part #29473 82u | info_particle_system fire_part #29472 82u | info_particle_system shout_part #29471 83u | info_particle_system dohva_swordpart2 #29474 85u | info_particle_system dohva_swordpart #29469 85u | info_particle_system dohva_swordpart3 #29434 85u | trigger_multiple freeze_shout #29456 86u | filter_activator_name doh_knife_filter_a #29482 101u
tool suggestion: handlers [29482] triggers [982]
config:          handlers [29437, 29451, 29450, 29438] triggers [982]
  missing handlers: [29437, 29451, 29450, 29438]  extra handlers: [29482]
  missing triggers: []  extra triggers: []
  note: handler doh_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger doh_t: teleports 16 units from the knife (target doh_in (info_teleport_destination))
  note: skipped trigger hurt_doh (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger push_shout (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger push_doh (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger fire_shout (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger freeze_shout (does not fire the item (nothing it outputs reaches a handler))
  note: skipped trigger hurt_doh2 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger push_doh2 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger hurt_doh3 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 29437 type=other event=OnTrigger mode=2 cooldown=3 maxuses=0  [MISSED by tool]
  logic_relay rynnak #29437 origin=-9136 -998 -5160 parent=- lump=default_ents
    keys: startdisabled=1
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case doh_ui #29436 OnCase01→Trigger | func_physbox doh_phbox #29444 OnBreak→Kill | filter_activator_context level4 #29475 OnPass→Kill | filter_activator_context level3 #29476 OnPass→Kill | filter_activator_context level2 #29477 OnPass→Enable
    outputs:
      OnTrigger → [PR#]push_doh Enable +0.800000011920929s [trigger_push]
      OnTrigger → [PR#]push_doh Disable +1.2999999523162842s [trigger_push]
      OnTrigger → [PR#]hurt_doh Enable +0.800000011920929s [trigger_hurt]
      OnTrigger → [PR#]hurt_doh Disable +1.2999999523162842s [trigger_hurt]
      OnTrigger → [PR#]dohvakiin SetAnimationNotLooping "[PR#]rynnak" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +3.75s [unresolved]
      OnTrigger → [PR#]flesh StartSound +0.800000011920929s [snd_event_point]
  distance to weapon: 192u
  tool event guesses: OnTrigger (10.0: leads to Enable after 3.75s (cooldown chain), 8 effects)
  tool cooldown guess: 3.75s (rynnak OnTrigger → rynnak Enable (+3.75s))
config handler 29451 type=other event=OnTrigger mode=2 cooldown=60 maxuses=0  [MISSED by tool]
  logic_relay shout_fire #29451 origin=-9184 -998 -5160 parent=- lump=default_ents
    keys: startdisabled=1
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case doh_ui #29436 OnCase02→Trigger | func_physbox doh_phbox #29444 OnBreak→Kill | filter_activator_context level4 #29475 OnPass→Kill | filter_activator_context level3 #29476 OnPass→Kill | filter_activator_context level2 #29477 OnPass→Enable
    outputs:
      OnTrigger → [PR#]fire_shout Enable +2s [trigger_hurt]
      OnTrigger → [PR#]fire_shout Disable +3.5999999046325684s [trigger_hurt]
      OnTrigger → [PR#]dohvakiin SetAnimationNotLooping "shout" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +60s [unresolved]
      OnTrigger → [PR#]fireshout StartSound [snd_event_point]
      OnTrigger → [PR#]fire_part Start +2s [info_particle_system]
      OnTrigger → [PR#]fire_part Stop +3.5999999046325684s [info_particle_system]
      OnTrigger → [PR#]dohva_boss_relay Trigger +2s [logic_relay]
  distance to weapon: 173u
  tool event guesses: OnTrigger (10.0: leads to Enable after 60s (cooldown chain), 57 effects)
  tool cooldown guess: 60s (shout_fire OnTrigger → shout_fire Enable (+60s))
config handler 29450 type=other event=OnTrigger mode=2 cooldown=70 maxuses=0  [MISSED by tool]
  logic_relay shout_freeze #29450 origin=-9168 -998 -5160 parent=- lump=default_ents
    keys: startdisabled=1
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case doh_ui #29436 OnCase02→Trigger | func_physbox doh_phbox #29444 OnBreak→Kill | filter_activator_context level4 #29475 OnPass→Kill | filter_activator_context level3 #29476 OnPass→Enable | filter_activator_context level2 #29477 OnPass→Kill
    outputs:
      OnTrigger → [PR#]freeze_shout Enable +1s [trigger_multiple]
      OnTrigger → [PR#]freeze_shout Disable +2.5999999046325684s [trigger_multiple]
      OnTrigger → [PR#]dohvakiin SetAnimationNotLooping "shout" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +70s [unresolved]
      OnTrigger → [PR#]freezeshout StartSound [snd_event_point]
      OnTrigger → [PR#]freeze_part Start +1s [info_particle_system]
      OnTrigger → [PR#]freeze_part Stop +2.5999999046325684s [info_particle_system]
      OnTrigger → [PR#]dohva_boss_relay Trigger +1s [logic_relay]
      OnTrigger → [PR#]dr_timer Enable +6s [unresolved]
      OnTrigger → [PR#]giant_speedtimer Enable +6s [unresolved]
      OnTrigger → [PR#]giant_speedtimer Disable [unresolved]
      OnTrigger → [PR#]dr_timer Disable [unresolved]
  distance to weapon: 178u
  tool event guesses: OnTrigger (10.0: leads to Enable after 70s (cooldown chain), 61 effects)
  tool cooldown guess: 70s (shout_freeze OnTrigger → shout_freeze Enable (+70s))
config handler 29438 type=other event=OnTrigger mode=2 cooldown=80 maxuses=0  [MISSED by tool]
  logic_relay shout_push #29438 origin=-9152 -998 -5160 parent=- lump=default_ents
    keys: startdisabled=1
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case doh_ui #29436 OnCase02→Trigger | func_physbox doh_phbox #29444 OnBreak→Kill | filter_activator_context level4 #29475 OnPass→Enable | filter_activator_context level3 #29476 OnPass→Kill | filter_activator_context level2 #29477 OnPass→Kill
    outputs:
      OnTrigger → [PR#]push_shout Enable +2s [trigger_push]
      OnTrigger → [PR#]push_shout Disable +3.5999999046325684s [trigger_push]
      OnTrigger → [PR#]dohvakiin SetAnimationNotLooping "shout" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +80s [unresolved]
      OnTrigger → [PR#]fusrodah StartSound [snd_event_point]
      OnTrigger → [PR#]shout_part Start +2s [info_particle_system]
      OnTrigger → [PR#]shout_part Stop +3.5999999046325684s [info_particle_system]
      OnTrigger → [PR#]dohva_boss_relay Trigger +2s [logic_relay]
  distance to weapon: 184u
  tool event guesses: OnTrigger (10.0: leads to Enable after 80s (cooldown chain), 55 effects)
  tool cooldown guess: 80s (shout_push OnTrigger → shout_push Enable (+80s))
config trigger 982  [found by tool]
  trigger_teleport doh_t #982 origin=14860 -15177 2699 parent=- lump=default_ents
    keys: target=[PR#]doh_in, filtername=[PR#]level2_ct_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_relay warmup_relay #9531 OnTrigger→Kill
    outputs:
      OnStartTouch → !self Kill [unresolved]
      OnStartTouch → [PR#]doh_push Kill [trigger_push]
  distance to weapon: 29129u
  strips: no
  teleports to: -9232 -838 -5220 (target doh_in (info_teleport_destination)) → 16u from weapon
knife selection-trigger search: trigger_teleport doh_t #982 (teleports 16 units from the knife (target doh_in (info_teleport_destination)))

### "Archmage" hammerid=29372
weapon: knife=true
  weapon_knife knife_archmage #29372 origin=-8949 -1984 -5225 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValue "health 50000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]filter_t_no" [unresolved]
      OnPlayerPickup → [PR#]archmage_ui Activate [logic_case]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]archmage_dead Test [logic_branch]
      OnPlayerPickup → !activator AddContext "ct_item_user:1" [unresolved]
  within 512u: prop_dynamic archmage #29388 21u | prop_dynamic archmage_dummy #29398 21u | trigger_once (unnamed) #29395 25u | env_shake archmage_shake #29384 26u | filter_proximity archmage_knife_filter_c #29389 29u | info_teleport_destination archmage_in #29385 40u | func_physbox archmage_phbox #29374 44u | trigger_push archmage_push #29379 46u | trigger_hurt archmage_push #29381 46u | trigger_hurt archmage_ulti #29376 50u | info_particle_system archmage_p2 #29371 61u | info_particle_system archmage_p1 #29387 62u | logic_measure_movement archmage_movement #29397 69u | filter_activator_name archmage_knife_filter_a #29390 95u | logic_branch archmage_dead #29391 101u | filter_activator_class archmage_knife_filter_b #29392 110u
tool suggestion: handlers [29390] triggers [1020]
config:          handlers [29383, 29378] triggers [1020]
  missing handlers: [29383, 29378]  extra handlers: [29390]
  missing triggers: []  extra triggers: []
  note: handler archmage_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger arch_tele: teleports 40 units from the knife (target archmage_in (info_teleport_destination))
  note: skipped trigger archmage_ulti (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger archmage_push (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger archmage_push (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 29383 type=other event=OnTrigger mode=2 cooldown=9 maxuses=0  [MISSED by tool]
  logic_relay archmage_attk #29383 origin=-9024 -2080 -5280 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case archmage_ui #29373 OnCase01→Trigger | func_physbox archmage_phbox #29374 OnBreak→Kill +1s | logic_relay archmage_nuke #29378 OnTrigger→Disable | logic_relay archmage_nuke #29378 OnTrigger→Enable +6s
    outputs:
      OnTrigger → [PR#]archmage SetAnimationNotLooping "[PR#]look" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → [PR#]archmage_push Enable [trigger_push,trigger_hurt]
      OnTrigger → [PR#]archmage_push Disable +1s [trigger_push,trigger_hurt]
      OnTrigger → !self Enable +9s [unresolved]
      OnTrigger → [PR#]archmage_p2 Start [info_particle_system]
      OnTrigger → [PR#]archmage_p2 Stop +1s [info_particle_system]
      OnTrigger → [PR#]archmage_haal StartSound [snd_event_point]
  distance to weapon: 134u
  tool event guesses: OnTrigger (9.5: leads to Enable after 9s (cooldown chain), 6 effects)
  tool cooldown guess: 9s (archmage_attk OnTrigger → archmage_attk Enable (+9s))
config handler 29378 type=other event=OnTrigger mode=2 cooldown=60 maxuses=0  [MISSED by tool]
  logic_relay archmage_nuke #29378 origin=-8992 -2080 -5280 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case archmage_ui #29373 OnCase02→Trigger | func_physbox archmage_phbox #29374 OnBreak→Kill +1s
    outputs:
      OnTrigger → [PR#]archmage SetAnimationLooping "ulti" [prop_dynamic]
      OnTrigger → [PR#]archmage_ulti Enable [trigger_hurt]
      OnTrigger → [PR#]archmage_ulti Disable +6s [trigger_hurt]
      OnTrigger → [PR#]archmage_p1 Start [info_particle_system]
      OnTrigger → [PR#]archmage_p1 Stop +6s [info_particle_system]
      OnTrigger → [PR#]archmage SetAnimationLooping "jooks" +6s [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +60s [unresolved]
      OnTrigger → [PR#]archmage_shake StartShake [env_shake]
      OnTrigger → [PR#]archmage_shake StopShake +6s [env_shake]
      OnTrigger → [PR#]archmage_haal StartSound [snd_event_point]
      OnTrigger → [PR#]maag_boss_relay Trigger +4s [logic_relay]
      OnTrigger → [PR#]archmage_attk Disable [logic_relay]
      OnTrigger → [PR#]archmage_attk Enable +6s [logic_relay]
      … +6 more
  distance to weapon: 119u
  tool event guesses: OnTrigger (10.0: leads to Enable after 60s (cooldown chain), 70 effects)
  tool cooldown guess: 60s (archmage_nuke OnTrigger → archmage_nuke Enable (+60s))
config trigger 1020  [found by tool]
  trigger_teleport arch_tele #1020 origin=15218 -14866 2699 parent=- lump=default_ents
    keys: target=[PR#]archmage_in, filtername=[PR#]level3_ct_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_relay warmup_relay #9531 OnTrigger→Kill
    outputs:
      OnStartTouch → !self Kill [unresolved]
      OnStartTouch → [PR#]arch_push Kill [trigger_push]
  distance to weapon: 28509u
  strips: no
  teleports to: -8952 -1984 -5264 (target archmage_in (info_teleport_destination)) → 40u from weapon
knife selection-trigger search: trigger_teleport arch_tele #1020 (teleports 40 units from the knife (target archmage_in (info_teleport_destination)))

### "Daedric" hammerid=29402
weapon: knife=true
  weapon_knife dr_knife #29402 origin=-9136 -1430 -5275 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]dr_ui Activate [logic_case]
      OnPlayerPickup → !activator KeyValue "health 50000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]filter_t_no" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]dr_dead Test [logic_branch]
      OnPlayerPickup → !activator AddContext "ct_item_user:1" [unresolved]
  within 512u: info_teleport_destination dr_in #29407 17u | prop_dynamic daedric #29419 18u | prop_dynamic dr_dummy #29431 18u | env_shake nuke_shake #29413 43u | info_particle_system p_nuk1 #29421 44u | trigger_once (unnamed) #29410 45u | logic_measure_movement dr_movement #29430 51u | filter_proximity dr_knife_filter_c #29428 51u | func_physbox dr_phys #29408 53u | filter_activator_name dr_knife_filter_a #29425 59u | info_particle_system p_nuke #29420 59u | trigger_hurt nuke #29422 59u | filter_activator_class dr_knife_filter_b #29426 61u | filter_multi dr_knife_filters #29427 66u | logic_branch dr_dead #29429 73u | point_entity_finder dr_knife_stripper #29424 75u
tool suggestion: handlers [29425] triggers [979]
config:          handlers [29403, 29412] triggers [979]
  missing handlers: [29403, 29412]  extra handlers: [29425]
  missing triggers: []  extra triggers: []
  note: handler dr_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger dr_t: teleports 17 units from the knife (target dr_in (info_teleport_destination))
  note: skipped trigger hurt_dr (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger push_dr (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger nuke (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 29403 type=other event=OnTrigger mode=2 cooldown=2 maxuses=0  [MISSED by tool]
  logic_relay look_relay #29403 origin=-9296 -1572 -5284 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | logic_case dr_ui #29406 OnCase01→Trigger | func_physbox dr_phys #29408 OnBreak→Kill +2s | logic_relay nuke_relay #29412 OnTrigger→Disable | logic_relay nuke_relay #29412 OnTrigger→Enable +5s
    outputs:
      OnTrigger → [PR#]look StartSound [snd_event_point]
      OnTrigger → [PR#]hurt_dr Enable [trigger_hurt]
      OnTrigger → [PR#]hurt_dr Disable +1s [trigger_hurt]
      OnTrigger → [PR#]push_dr Enable [trigger_push]
      OnTrigger → [PR#]push_dr Disable +1s [trigger_push]
      OnTrigger → [PR#]daedric SetAnimationNotLooping "[PR#]rynnak" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +2.1500000953674316s [unresolved]
  distance to weapon: 214u
  tool event guesses: OnTrigger (9.5: leads to Enable after 2.1500000953674316s (cooldown chain), 6 effects)
  tool cooldown guess: 5s (nuke_relay OnTrigger → look_relay Enable (+5s))
config handler 29412 type=other event=OnTrigger mode=3 cooldown=60 maxuses=2  [MISSED by tool]
  logic_relay nuke_relay #29412 origin=-9296 -1556 -5284 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_relay tk_relay #1348 OnTrigger→Kill | math_counter BossHpIterations2 #10432 OnHitMin→Enable | logic_relay dw_r #10492 OnTrigger→Disable | logic_case dr_ui #29406 OnCase02→Trigger | func_physbox dr_phys #29408 OnBreak→Kill +2s | math_counter nuke_counter #29415 OnHitMax→Kill
    outputs:
      OnTrigger → [PR#]p_nuk1 Start [info_particle_system]
      OnTrigger → [PR#]p_nuk1 Stop +5s [info_particle_system]
      OnTrigger → [PR#]p_nuke Start +5s [info_particle_system]
      OnTrigger → [PR#]p_nuke Stop +6.5s [info_particle_system]
      OnTrigger → [PR#]daedric SetAnimationNotLooping "special" [prop_dynamic]
      OnTrigger → [PR#]nuke Enable +5s [trigger_hurt]
      OnTrigger → [PR#]nuke Disable +5.400000095367432s [trigger_hurt]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +60s [unresolved]
      OnTrigger → [PR#]nuke_sound StartSound [snd_event_point]
      OnTrigger → [PR#]nuke_shake StartShake [env_shake]
      OnTrigger → [PR#]nuke_shake StopShake +6s [env_shake]
      OnTrigger → [PR#]nuke_counter Add "1" [math_counter]
      OnTrigger → [PR#]dr_boss_relay Trigger +5s [logic_relay]
      … +5 more
  distance to weapon: 204u
  tool event guesses: OnTrigger (10.0: leads to Enable after 60s (cooldown chain), 69 effects)
  tool cooldown guess: 60s (nuke_relay OnTrigger → nuke_relay Enable (+60s))
config trigger 979  [found by tool]
  trigger_teleport dr_t #979 origin=15087 -15198 2699 parent=- lump=default_ents
    keys: target=[PR#]dr_in, filtername=[PR#]level4_ct_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_relay warmup_relay #9531 OnTrigger→Kill
    outputs:
      OnStartTouch → !self Kill [unresolved]
      OnStartTouch → [PR#]dr_push Kill [trigger_push]
  distance to weapon: 28981u
  strips: no
  teleports to: -9135 -1430 -5292 (target dr_in (info_teleport_destination)) → 17u from weapon
knife selection-trigger search: trigger_teleport dr_t #979 (teleports 17 units from the knife (target dr_in (info_teleport_destination)))

### "Freeze Staff" hammerid=225
weapon: knife=false
  weapon_p250 special_1_wep #225 origin=5509 -13142 3184 parent=- lump=default_ents
    keys: spawnflags=1
    fired by: logic_relay stage_1_kill #9533 OnTrigger→Kill
    outputs:
      OnPlayerPickup → !activator AddContext "staff:1" +0.10000000149011612s [unresolved]
      OnPlayerPickup → [PR#]player RemoveContext "staff" [unresolved]
  within 512u: logic_measure_movement special_1_wep_measure #10181 34u | prop_dynamic magnus #4459 48u | prop_dynamic ice_dummy #10182 48u | func_button special_1_button #703 52u | math_counter special_1_counter #705 63u | filter_activator_context staff_filter #1110 69u | info_particle_system special_1_part #4460 87u | trigger_multiple special_1_freeze #223 264u | func_door_rotating (unnamed) #221 314u | info_particle_system (unnamed) #29177 328u | light_omni2 (unnamed) #29176 328u | info_particle_system (unnamed) #4461 329u
tool suggestion: handlers [703, 1110] triggers []
config:          handlers [703] triggers []
  missing handlers: []  extra handlers: [1110]
  missing triggers: []  extra triggers: []
  note: handler special_1_button (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: leads to Unlock after 10s (cooldown chain), 10 effects
  note: cooldown 10s: staff_filter OnPass → special_1_button Unlock (+10s)
  note: handler staff_filter (other OnPass): special_1_button OnPressed → TestActivator
  note: event OnPass: leads to Unlock after 10s (cooldown chain), 13 effects
  note: cooldown 10s: staff_filter OnPass → special_1_button Unlock (+10s)
  note: skipped trigger special_1_freeze (effect zone switched on by the item; listing it would make ebanned players immune to it)
config handler 703 type=button event=OnPressed mode=3 cooldown=10 maxuses=2  [found by tool]
  func_button special_1_button #703 origin=5511 -13161 3232 parent=[PR#]special_1_wep lump=default_ents
    keys: spawnflags=17409, wait=0
    fired by: math_counter special_1_counter #705 OnHitMax→Kill | filter_activator_context staff_filter #1110 OnPass→Lock | filter_activator_context staff_filter #1110 OnPass→Unlock +10s | logic_relay stage_1_kill #9533 OnTrigger→Kill
    outputs:
      OnPressed → [PR#]staff_filter TestActivator [filter_activator_context]
  distance to weapon: 52u
  tool event guesses: OnPressed (11.0: leads to Unlock after 10s (cooldown chain), 10 effects)
  tool cooldown guess: 10s (staff_filter OnPass → special_1_button Unlock (+10s))

### "Heal Staff" hammerid=401
weapon: knife=false
  weapon_p250 healelite #401 origin=13618 -10206 3302 parent=- lump=default_ents
    keys: spawnflags=1
    fired by: logic_relay stage_2_kill #9534 OnTrigger→Kill
    outputs:
      OnPlayerPickup → [PR#]player RemoveContext "heal_user" [unresolved]
      OnPlayerPickup → !activator AddContext "heal_user:1" +0.10000000149011612s [unresolved]
  within 512u: logic_measure_movement heal_measure #10180 18u | info_particle_system heal_part2 #4477 23u | logic_relay heal_relay #1107 40u | func_button heal_button #402 42u | math_counter heal_counter #1108 44u | trigger_hurt heal_trigger #404 51u | func_rotating heal_rot #24865 51u | filter_activator_context heal_filter #10179 58u | prop_dynamic healstaff #4479 58u | prop_dynamic heal_dummy #10183 58u | info_particle_system heal_part1 #4478 104u | info_particle_system (unnamed) #30088 134u | light_omni2 (unnamed) #30087 139u | func_door_rotating wr_balcony #551 159u | info_particle_system (unnamed) #30091 250u | light_omni2 (unnamed) #30090 253u
tool suggestion: handlers [402, 1108] triggers []
config:          handlers [402] triggers []
  missing handlers: []  extra handlers: [1108]
  missing triggers: []  extra triggers: []
  note: handler heal_button (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: leads to Unlock after 20s (cooldown chain), 12 effects
  note: cooldown 20s: heal_relay OnTrigger → heal_button Unlock (+20s)
  note: handler heal_counter (counterup): heal_button OnPressed → Add; fed by a button/trigger
  note: skipped heal_relay (logic_relay, sits behind a handler that already reports the use)
config handler 402 type=button event=OnPressed mode=3 cooldown=20 maxuses=2  [found by tool]
  func_button heal_button #402 origin=13636 -10205 3341 parent=[PR#]healelite lump=default_ents
    keys: spawnflags=17409, wait=20
    fired by: math_counter BossHpIterations3 #649 OnHitMin→Kill | logic_relay heal_relay #1107 OnTrigger→Unlock +20s | logic_relay heal_relay #1107 OnTrigger→Lock | math_counter heal_counter #1108 OnHitMax→Kill | logic_relay stage_2_kill #9534 OnTrigger→Kill
    outputs:
      OnPressed → [PR#]heal_counter Add "1" [math_counter]
      OnPressed → [PR#]heal_relay Trigger [logic_relay]
  distance to weapon: 42u
  tool event guesses: OnPressed (11.0: leads to Unlock after 20s (cooldown chain), 12 effects)
  tool cooldown guess: 20s (heal_relay OnTrigger → heal_button Unlock (+20s))

### "Lever" hammerid=2276
weapon: knife=false
  weapon_p250 lever_glock #2276 origin=-12173 -3104 5066 parent=- lump=default_ents
    keys: spawnflags=0
    fired by: logic_relay stage_3_kill #9560 OnTrigger→Kill
  within 512u: logic_relay lever_relay #159 29u | logic_measure_movement lever_measure #10208 58u | func_physbox lever_physbox #2274 60u | prop_dynamic lever_dummy #10207 60u | point_template lever_temp2 #157 63u | env_entity_maker lever_maker #158 63u | func_door st3_door13 #2287 109u | func_door st3_door12 #2277 112u | info_particle_system StartFireParticle #4255 122u | light_omni2 (unnamed) #2037 122u | info_particle_system StartFireParticle #4256 127u | light_omni2 (unnamed) #2036 127u | info_particle_system StartFireParticle #4257 234u | light_omni2 (unnamed) #29643 238u | info_particle_system StartFireParticle #4254 304u | light_omni2 (unnamed) #2038 304u
tool suggestion: handlers [2274] triggers []
config:          handlers [] triggers []
  missing handlers: []  extra handlers: [2274]
  missing triggers: []  extra triggers: []
  note: nothing wired to the weapon; looked at 2 entities within 200 units
  note: handler lever_physbox (button OnPlayerUse): within 60 units of the weapon
  note: event OnPlayerUse: class default (no connections in map)
  note: skipped lever_relay (logic_relay, not fed by the item and no cooldown pattern)

### "Torch" hammerid=2132
weapon: knife=false
  weapon_p250 st3_torchwep #2132 origin=-7716 -1593 5110 parent=- lump=default_ents
    keys: spawnflags=1
    fired by: logic_relay stage_3_kill #9560 OnTrigger→Kill
  within 512u: logic_measure_movement st3_torchwep_measure #10200 32u | filter_activator_name st3_torchfilt #2420 44u | func_physbox st3_torchphys #2133 58u | prop_dynamic st3_torch_dummy #10201 58u | point_template st3_torchtemp #160 61u | env_entity_maker st3_torchmaker #161 61u | info_particle_system st3_torchpart #5438 68u | logic_relay st3_torchrelay #162 102u | info_particle_system StartFireParticle #4289 152u | light_omni2 (unnamed) #29685 152u | light_omni2 (unnamed) #29687 181u | info_particle_system StartFireParticle #4290 182u | light_omni2 (unnamed) #29683 308u | info_particle_system StartFireParticle #4288 308u | info_particle_system StartFireParticle #4291 318u | light_omni2 (unnamed) #29693 319u
tool suggestion: handlers [2133] triggers []
config:          handlers [] triggers []
  missing handlers: []  extra handlers: [2133]
  missing triggers: []  extra triggers: []
  note: nothing wired to the weapon; looked at 3 entities within 200 units
  note: handler st3_torchphys (button OnPlayerUse): within 58 units of the weapon
  note: event OnPlayerUse: class default (no connections in map)
  note: skipped st3_torchfilt (filter, not fed by a button)
  note: skipped st3_torchrelay (logic_relay, not fed by the item and no cooldown pattern)

### "Elder Scroll" hammerid=406
weapon: knife=false
  weapon_elite elder #406 origin=-4956 -11638 -4586 parent=- lump=default_ents
    keys: spawnflags=1
    fired by: logic_relay stage_4_kill #9536 OnTrigger→Kill
  within 512u: logic_relay elder_relay #156 30u | logic_measure_movement stage_4_scroll_measure #10391 46u | point_template elder_temp #154 120u | env_entity_maker elder_maker #155 120u | prop_dynamic stage_4_scroll #4480 130u | prop_dynamic stage_4_scroll_dummy #10390 130u | info_particle_system StartFireParticle #4396 221u | light_omni2 (unnamed) #29867 239u
tool suggestion: handlers [] triggers []
config:          handlers [] triggers []
  missing handlers: []  extra handlers: []
  missing triggers: []  extra triggers: []
  note: nothing wired to the weapon; looked at 1 entities within 200 units
  note: skipped elder_relay (logic_relay, not fed by the item and no cooldown pattern)
  note: No button/filter/relay/counter qualified; see the skipped entries above and add handlers from the tree or the I/O search.

### "Elder Scroll" hammerid=723
weapon: knife=false
  weapon_elite elder_1_wep #723 origin=-2 4 -32 parent=- lump=949#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]ScrollTrigger Enable [logic_relay]
      OnPlayerPickup → !activator AddContext "scroll_user:1" +0.10000000149011612s [unresolved]
      OnPlayerPickup → [PR#]player RemoveContext "scroll_user" [unresolved]
  within 512u: info_particle_system elder_1_part #4698 4u | post_processing_volume cc_rainy #20617 4u | prop_dynamic smalldwboss_prop #10442 10u | func_breakable wr_ladder_2 #4540 14u | func_physbox smalldwboss_physbox #10451 17u | phys_keepupright smalldwboss_keepupright #10444 17u | env_shake elder_shake_1 #728 19u | func_breakable wr_rope2 #4913 20u | phys_thruster smalldwboss_thrust_otse #10447 24u | func_door_rotating lever_button #2117 27u | func_physbox st3_torchbreak #2139 28u | trigger_hurt arrow_hurt&0000 #29340 32u | func_physbox arrow_phbox&0000 #29338 32u | path_track st1_dead_path1 #24793 32u | func_tracktrain st1_dragdeadtrain #24789 32u | func_physbox elder_tar #407 32u
tool suggestion: handlers [724, 20603] triggers []
config:          handlers [1487] triggers []
  missing handlers: [1487]  extra handlers: [724, 20603]
  missing triggers: []  extra triggers: []
  note: weapon is spawned by scroll_template with 7 other template member(s)
  note: template lump 949#entityLumpName: 7 entities (func_button, logic_relay, filter_activator_context)
  note: handler elder_1_button (button OnPressed): parented to weapon (parentname)
  note: event OnPressed: locks something, 15 effects
  note: handler scroll_filter (other OnPass): same point_template (scroll_template)
  note: event OnPass: locks something, 17 effects
  note: cooldown 59s: boss_3_trigger_ex OnStartTouch → scroll_boss Enable (+59s)
  note: skipped ScrollTrigger (logic_relay, sits behind a handler that already reports the use)
config handler 1487 type=other event=OnTrigger mode=3 cooldown=0 maxuses=1  [MISSED by tool]
  logic_relay ScrollTrigger #1487 origin=40 4 8 parent=- lump=949#entityLumpName (templated)
    keys: startdisabled=1
    fired by: weapon_elite elder_1_wep #723 OnPlayerPickup→Enable | filter_activator_context scroll_filter #20603 OnPass→Trigger
    outputs:
      OnTrigger → [PR#]elder_1_ulti Stop +25s [info_particle_system]
      OnTrigger → [PR#]elder_lopp StartSound +5s [snd_event_point]
      OnTrigger → [PR#]elder_algus StopSound "0" +5s [snd_event_point]
      OnTrigger → [PR#]elder_1_ulti Start +5s [info_particle_system]
      OnTrigger → [PR#]elder_1_part Stop +5s [info_particle_system]
      OnTrigger → [PR#]scroll_boss Trigger +1s [logic_relay]
      OnTrigger → [PR#]scroll_maker ForceSpawn [env_entity_maker]
      OnTrigger → [PR#]score2 ApplyScore +0.10000000149011612s [game_score]
      OnTrigger → [PR#]elder_shake_1 StartShake +0.10000000149011612s [env_shake]
      OnTrigger → [PR#]elder_algus StartSound +0.10000000149011612s [snd_event_point]
      OnTrigger → [PR#]elder_1 Disable +0.10000000149011612s [prop_dynamic]
      OnTrigger → [PR#]elder_1_part Start +0.10000000149011612s [info_particle_system]
  distance to weapon: 58u
  tool event guesses: OnTrigger (7.0: locks something, 60 effects)
  tool cooldown guess: 59s (boss_3_trigger_ex OnStartTouch → scroll_boss Enable (+59s))

### "Zombie Wolf" hammerid=29224
weapon: knife=true
  weapon_knife ww_knife&0000 #29224 origin=59 -114 12 parent=- lump=29230#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValue "runspeed 1.09" [unresolved]
      OnPlayerPickup → !activator KeyValue "health 10000" [unresolved]
      OnPlayerPickup → [PR#]ww_ui&0000 Activate [logic_case]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]t_filter" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]ww_push_t&0000 Open [func_movelinear]
      OnPlayerPickup → [PR#]ww_dead&0000 Test "0" [logic_branch]
      OnPlayerPickup → !activator AddContext "t_item_user:1" [unresolved]
  within 512u: trigger_multiple ww_stop2&0000 #29241 44u | trigger_once ww_strip&0000 #29239 48u | func_movelinear troll_push_t&0000 #29220 50u | prop_dynamic ww&0000 #29223 51u | prop_dynamic ww_dummy&0000 #29262 51u | trigger_push ww_push&0000 #29235 52u | trigger_push ww_push3&0000 #29243 52u | trigger_push ww_push2&0000 #29233 52u | trigger_push ww_push4&0000 #29245 52u | func_physbox troll_phbox&0000 #29199 62u | func_physbox ww_phbox&0000 #29249 63u | trigger_hurt ww_attk&0000 #29226 64u | func_movelinear ww_push_t&0000 #29264 65u | func_physbox troll_phbox&0000 #29194 79u | func_physbox troll_phbox&0000 #29203 79u | trigger_push troll_push3&0000 #29207 83u
tool suggestion: handlers [29247, 29249, 29251, 29253, 29255, 29257, 29258, 29228, 29263, 24853] triggers []
config:          handlers [29229, 29237] triggers [987]
  missing handlers: [29229, 29237]  extra handlers: [29247, 29249, 29251, 29253, 29255, 29257, 29258, 29228, 29263, 24853]
  missing triggers: [987]  extra triggers: []
  note: template lump 29230#entityLumpName: 25 entities (logic_case, logic_relay, trigger_hurt, func_physbox, func_physbox, func_physbox, func_physbox, func_physbox, logic_branch, trigger_push, trigger_push, trigger_push, trigger_push, logic_relay, trigger_once, trigger_multiple, filter_activator_name, filter_multi)
  note: handler ww_phbox&0000 (button OnBreak): same template lump (29230#entityLumpName)
  note: event OnBreak: leads to Enable after 25s (cooldown chain), 44 effects
  note: cooldown 25s: ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s)
  note: handler ww_phbox&0000 (button OnBreak): same template lump (29230#entityLumpName)
  note: event OnBreak: leads to Enable after 25s (cooldown chain), 46 effects
  note: cooldown 25s: ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s)
  note: handler ww_phbox&0000 (button OnBreak): same template lump (29230#entityLumpName)
  note: event OnBreak: leads to Enable after 25s (cooldown chain), 43 effects
  note: handler ww_phbox&0000 (button OnBreak): same template lump (29230#entityLumpName)
  note: event OnBreak: leads to Enable after 25s (cooldown chain), 43 effects
  note: handler ww_phbox&0000 (button OnBreak): same template lump (29230#entityLumpName)
  note: event OnBreak: leads to Enable after 25s (cooldown chain), 43 effects
  note: handler ww_knife_filter_a&0000 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: handler ww_knife_filters&0000 (other OnPass): same template lump (29230#entityLumpName)
  note: event OnPass: class default (no connections in map)
  note: handler ww_ui&0000 (other OnCase02): same template lump (29230#entityLumpName); fed by a button/trigger
  note: event OnCase02: leads to Enable after 25s (cooldown chain), 6 effects
  note: cooldown 25s: ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s)
  note: handler ww_dead&0000 (other OnTrue): same template lump (29230#entityLumpName); fed by a button/trigger
  note: event OnTrue: 2 effects
  note: cooldown 25s: ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s)
  note: handler ww_break (other OnTrigger): ww_phbox&0000 OnBreak → Trigger; fed by a button/trigger
  note: templated=false: the weapon is spawned by a template but ww_break is a single map entity
  note: event OnTrigger: locks something, 7 effects
  note: cooldown 25s: ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s)
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped ww_relay&0000 (logic_relay, sits behind a handler that already reports the use)
  note: skipped ww_shout&0000 (logic_relay, sits behind a handler that already reports the use)
  note: skipped trigger ww_attk&0000 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger ww_stop2&0000 (does not fire the item (nothing it outputs reaches a handler))
  note: skipped trigger ww_push&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger ww_push3&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger ww_push2&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger ww_push4&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger ww_strip&0000 (does not fire the item (nothing it outputs reaches a handler))
  note: skipped trigger ww_tele (effect zone switched on by the item; listing it would make ebanned players immune to it)
config handler 29229 type=other event=OnTrigger mode=2 cooldown=2 maxuses=0  [MISSED by tool]
  logic_relay ww_relay&0000 #29229 origin=32 0 0 parent=- lump=29230#entityLumpName (templated)
    keys: startdisabled=0
    fired by: logic_case ww_ui&0000 #29228 OnCase01→Trigger | func_physbox ww_phbox&0000 #29249 OnBreak→Kill +1s
    outputs:
      OnTrigger → [PR#]ww&0000 SetAnimationNotLooping "[PR#]rynnak" [prop_dynamic]
      OnTrigger → [PR#]ww_attk&0000 Enable +0.30000001192092896s [trigger_hurt]
      OnTrigger → [PR#]ww_attk&0000 Disable +0.699999988079071s [trigger_hurt]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +2s [unresolved]
      OnTrigger → [PR#]ww_look&0000 StartSound [snd_event_point]
  distance to weapon: 118u
  tool event guesses: OnTrigger (9.0: leads to Enable after 2s (cooldown chain), 4 effects)
  tool cooldown guess: 2s (ww_relay&0000 OnTrigger → ww_relay&0000 Enable (+2s))
config handler 29237 type=other event=OnTrigger mode=2 cooldown=0 maxuses=25  [MISSED by tool]
  logic_relay ww_shout&0000 #29237 origin=64 0 0 parent=- lump=29230#entityLumpName (templated)
    keys: startdisabled=0
    fired by: logic_case ww_ui&0000 #29228 OnCase02→Trigger | func_physbox ww_phbox&0000 #29249 OnBreak→Kill +1s
    outputs:
      OnTrigger → [PR#]ww&0000 SetAnimationNotLooping "howl" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +25s [unresolved]
      OnTrigger → [PR#]ww_howl&0000 StartSound +0.25s [snd_event_point]
      OnTrigger → !activator KeyValue "movetype 1" [unresolved]
      OnTrigger → [PR#]ww_stop2&0000 Enable +0.4000000059604645s [trigger_multiple]
      OnTrigger → [PR#]ww_stop2&0000 Disable +3s [trigger_multiple]
      OnTrigger → !activator KeyValue "movetype 2" +2.299999952316284s [unresolved]
  distance to weapon: 115u
  tool event guesses: OnTrigger (9.3: leads to Enable after 25s (cooldown chain), 5 effects)
  tool cooldown guess: 25s (ww_shout&0000 OnTrigger → ww_shout&0000 Enable (+25s))
config trigger 987  [MISSED by tool]
  trigger_teleport ww_tele #987 origin=13695 -15179 2675 parent=- lump=default_ents
    keys: target=[PR#]ww_in, filtername=[PR#]level1_t_item_filter, spawnflags=1, startdisabled=0
    fired by: func_physbox ww_phbox&0000 #29249 OnBreak→Enable | logic_branch ww_enabled #24852 OnTrue→Enable | logic_branch ww_enabled #24852 OnFalse→Disable | logic_relay ww_break #24853 OnTrigger→Enable
    outputs:
      OnStartTouch → [PR#]ww_maker ForceSpawn [env_entity_maker]
      OnStartTouch → [PR#]ww_counter Add "1" [math_counter]
      OnStartTouch → !self Disable [unresolved]
      OnStartTouch → [PR#]ww_enabled Test +0.5s [logic_branch]
  distance to weapon: 20494u
  strips: no
  teleports to: -9301 -3314 -5340 (target ww_in (info_teleport_destination)) → 11247u from weapon
knife selection-trigger search: nothing

### "Zombie Troll" hammerid=29179
weapon: knife=true
  weapon_knife troll_knife&0000 #29179 origin=-20 -142 -46 parent=- lump=29192#entityLumpName (templated)
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValue "runspeed 1.04" [unresolved]
      OnPlayerPickup → !activator KeyValue "health 10000" [unresolved]
      OnPlayerPickup → [PR#]troll_ui&0000 Activate [logic_case]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]t_filter" [unresolved]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → [PR#]troll_dead&0000 Test [logic_branch]
      OnPlayerPickup → [PR#]troll_push_t&0000 Open [func_movelinear]
      OnPlayerPickup → !activator AddContext "t_item_user:1" [unresolved]
  within 512u: prop_dynamic troll&0000 #29198 28u | prop_dynamic troll_dummy&0000 #29218 28u | trigger_once troll_strip&0000 #29216 34u | func_physbox troll_phbox&0000 #29194 35u | filter_proximity troll_knife_filter_b&0000 #29214 58u | trigger_push troll_push3&0000 #29207 59u | trigger_push troll_push4&0000 #29209 59u | trigger_push troll_push&0000 #29196 59u | trigger_push troll_push2&0000 #29190 59u | trigger_multiple troll_attk_2&0000 #29188 62u | func_movelinear troll_push_t&0000 #29220 64u | func_physbox troll_phbox&0000 #29205 89u | trigger_hurt troll_attk_1&0000 #29182 91u | func_physbox troll_phbox&0000 #29201 91u | func_physbox troll_phbox&0000 #29199 94u | func_physbox troll_phbox&0000 #29203 94u
tool suggestion: handlers [29194, 29199, 29201, 29203, 29205, 29212, 29211, 29215, 29185, 29184, 29181, 24855] triggers []
config:          handlers [29184, 29185] triggers [990]
  missing handlers: []  extra handlers: [29194, 29199, 29201, 29203, 29205, 29212, 29211, 29215, 29181, 24855]
  missing triggers: [990]  extra triggers: []
  note: template lump 29192#entityLumpName: 25 entities (trigger_push, trigger_hurt, func_physbox, func_physbox, func_physbox, func_physbox, func_physbox, trigger_push, trigger_once, logic_branch, trigger_push, trigger_push, logic_relay, logic_relay, logic_case, trigger_multiple, filter_multi, filter_activator_name, filter_proximity)
  note: handler troll_phbox&0000 (button OnBreak): same template lump (29192#entityLumpName)
  note: event OnBreak: leads to Enable after 35s (cooldown chain), 48 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_phbox&0000 (button OnBreak): same template lump (29192#entityLumpName)
  note: event OnBreak: leads to Enable after 35s (cooldown chain), 46 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_phbox&0000 (button OnBreak): same template lump (29192#entityLumpName)
  note: event OnBreak: leads to Enable after 35s (cooldown chain), 46 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_phbox&0000 (button OnBreak): same template lump (29192#entityLumpName)
  note: event OnBreak: leads to Enable after 35s (cooldown chain), 46 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_phbox&0000 (button OnBreak): same template lump (29192#entityLumpName)
  note: event OnBreak: leads to Enable after 35s (cooldown chain), 46 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_knife_filter_a&0000 (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: handler troll_knife_filters&0000 (other OnPass): same template lump (29192#entityLumpName)
  note: event OnPass: class default (no connections in map)
  note: handler troll_dead&0000 (other OnTrue): same template lump (29192#entityLumpName); fed by a button/trigger
  note: event OnTrue: 2 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_relay_2&0000 (other OnTrigger): same template lump (29192#entityLumpName); fed by a button/trigger
  note: event OnTrigger: leads to Enable after 35s (cooldown chain), 47 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_relay_1&0000 (other OnTrigger): same template lump (29192#entityLumpName); fed by a button/trigger
  note: event OnTrigger: leads to Enable after 2s (cooldown chain), 4 effects
  note: cooldown 2s: troll_relay_1&0000 OnTrigger → troll_relay_1&0000 Enable (+2s)
  note: handler troll_ui&0000 (other OnCase02): same template lump (29192#entityLumpName); fed by a button/trigger
  note: event OnCase02: leads to Enable after 35s (cooldown chain), 43 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: handler troll_break (other OnTrigger): troll_phbox&0000 OnBreak → Trigger; fed by a button/trigger
  note: templated=false: the weapon is spawned by a template but troll_break is a single map entity
  note: event OnTrigger: locks something, 7 effects
  note: cooldown 35s: troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s)
  note: knife item: no strip zone or teleport landing near it was found (radius 256 / 384 units)
  note: skipped troll_knife_filter_b&0000 (filter, not fed by a button)
  note: skipped trigger troll_attk_1&0000 (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger troll_attk_2&0000 (effect zone switched on by the item; listing it would make ebanned players immune to it)
  note: skipped trigger troll_push3&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger troll_push4&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger troll_strip&0000 (does not fire the item (nothing it outputs reaches a handler))
  note: skipped trigger troll_push&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger troll_push2&0000 (trigger_push is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
config handler 29184 type=other event=OnTrigger mode=2 cooldown=2 maxuses=0  [found by tool]
  logic_relay troll_relay_1&0000 #29184 origin=88 2 0 parent=- lump=29192#entityLumpName (templated)
    keys: startdisabled=0
    fired by: func_physbox troll_phbox&0000 #29194 OnBreak→Kill | logic_case troll_ui&0000 #29181 OnCase01→Trigger
    outputs:
      OnTrigger → [PR#]troll&0000 SetAnimationNotLooping "[PR#]rynnak" [prop_dynamic]
      OnTrigger → [PR#]troll_attk_1&0000 Enable +0.5s [trigger_hurt]
      OnTrigger → [PR#]troll_attk_1&0000 Disable +1s [trigger_hurt]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +2s [unresolved]
      OnTrigger → [PR#]troll_look_1&0000 StartSound [snd_event_point]
  distance to weapon: 186u
  tool event guesses: OnTrigger (9.0: leads to Enable after 2s (cooldown chain), 4 effects)
  tool cooldown guess: 2s (troll_relay_1&0000 OnTrigger → troll_relay_1&0000 Enable (+2s))
config handler 29185 type=other event=OnTrigger mode=2 cooldown=35 maxuses=0  [found by tool]
  logic_relay troll_relay_2&0000 #29185 origin=64 2 0 parent=- lump=29192#entityLumpName (templated)
    keys: startdisabled=0
    fired by: func_physbox troll_phbox&0000 #29194 OnBreak→Kill | logic_case troll_ui&0000 #29181 OnCase02→Trigger
    outputs:
      OnTrigger → [PR#]troll&0000 SetAnimationNotLooping "kisa" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +35s [unresolved]
      OnTrigger → [PR#]troll_kisa StartSound [snd_event_point]
      OnTrigger → !activator KeyValue "movetype 1" [unresolved]
      OnTrigger → [PR#]troll_phbox&0000 AddHealth "1500" [func_physbox,func_physbox,func_physbox]
      OnTrigger → [PR#]troll_attk_2&0000 Enable [trigger_multiple]
      OnTrigger → [PR#]troll_attk_2&0000 Disable +2s [trigger_multiple]
      OnTrigger → !activator KeyValue "movetype 2" +2s [unresolved]
  distance to weapon: 173u
  tool event guesses: OnTrigger (10.0: leads to Enable after 35s (cooldown chain), 47 effects)
  tool cooldown guess: 35s (troll_relay_2&0000 OnTrigger → troll_relay_2&0000 Enable (+35s))
config trigger 990  [MISSED by tool]
  trigger_teleport troll_tele #990 origin=13415 -15181 2675 parent=- lump=default_ents
    keys: target=[PR#]troll_in, filtername=[PR#]level2_t_item_filter, spawnflags=1, startdisabled=0
    fired by: logic_branch troll_enabled #24854 OnTrue→Enable | logic_branch troll_enabled #24854 OnFalse→Disable | logic_relay troll_break #24855 OnTrigger→Enable
    outputs:
      OnStartTouch → [PR#]troll_counter Add "1" [math_counter]
      OnStartTouch → [PR#]troll_maker ForceSpawn [env_entity_maker]
      OnStartTouch → !self Disable [unresolved]
      OnStartTouch → [PR#]troll_enabled Test +0.5s [logic_branch]
  distance to weapon: 20349u
  strips: no
  teleports to: -9212 -2822 -5350 (target troll_in (info_teleport_destination)) → 10946u from weapon
knife selection-trigger search: nothing

### "Zombie Giant" hammerid=29267
weapon: knife=true
  weapon_knife giant_knife #29267 origin=-9264 -3680 -5360 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → !activator KeyValue "health 21000" [unresolved]
      OnPlayerPickup → [PR#]giant_ui Activate [logic_case]
      OnPlayerPickup → !activator KeyValue "runspeed 1.04" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]t_filter" [unresolved]
      OnPlayerPickup → [PR#]giant_push_t Open [func_movelinear]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → !activator AddContext "giantplayer:1" +0.05000000074505806s [unresolved]
      OnPlayerPickup → [PR#]giant_dead Test [logic_branch]
      OnPlayerPickup → !activator AddContext "t_item_user:1" [unresolved]
  within 512u: prop_dynamic giant #29275 22u | prop_dynamic giant_dummy #29306 22u | info_teleport_destination giant_in #29276 24u | env_shake giant_shake #29278 40u | func_movelinear giant_push_t #29307 40u | filter_proximity giant_knife_filter_b #29303 42u | trigger_once (unnamed) #29273 49u | func_physbox giant_phbox #29281 49u | trigger_push giant_push2 #29279 51u | trigger_push giant_push #29283 51u | trigger_push giant_push3 #29294 51u | trigger_push giant_push4 #29296 51u | trigger_multiple giant_pauk #29298 96u | snd_event_point g_s_1 #29285 104u | logic_measure_movement giant_movement #29305 105u | snd_event_point g_s_2 #29277 107u
tool suggestion: handlers [29300] triggers [987, 994]
config:          handlers [29270, 29271] triggers [994]
  missing handlers: [29270, 29271]  extra handlers: [29300]
  missing triggers: []  extra triggers: [987]
  note: handler giant_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger ww_tele: teleports 368 units from the knife (target ww_in (info_teleport_destination))
  note: trigger giant_tele: teleports 24 units from the knife (target giant_in (info_teleport_destination))
  note: skipped trigger giant_hurt (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger giant_pauk (does not fire the item (nothing it outputs reaches a handler))
config handler 29270 type=other event=OnTrigger mode=2 cooldown=5 maxuses=0  [MISSED by tool]
  logic_relay giant_look #29270 origin=-9184 -3584 -5320 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_case giant_ui #29272 OnCase01→Trigger | func_physbox giant_phbox #29281 OnBreak→Kill
    outputs:
      OnTrigger → [PR#]giant_hurt Enable +0.699999988079071s [trigger_hurt]
      OnTrigger → [PR#]giant_hurt Disable +1.2999999523162842s [trigger_hurt]
      OnTrigger → [PR#]giant SetAnimationNotLooping "[PR#]look" [prop_dynamic]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +5s [unresolved]
      OnTrigger → [PR#]g_s_1 StartSound +0.4000000059604645s [snd_event_point]
  distance to weapon: 131u
  tool event guesses: OnTrigger (9.0: leads to Enable after 5s (cooldown chain), 4 effects)
  tool cooldown guess: 5s (giant_look OnTrigger → giant_look Enable (+5s))
config handler 29271 type=other event=OnTrigger mode=2 cooldown=15 maxuses=0  [MISSED by tool]
  logic_relay giant_pauk_r #29271 origin=-9208 -3584 -5320 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: logic_case giant_ui #29272 OnCase02→Trigger | func_physbox giant_phbox #29281 OnBreak→Kill
    outputs:
      OnTrigger → [PR#]giant_pauk Enable +1s [trigger_multiple]
      OnTrigger → [PR#]giant_pauk Disable +2s [trigger_multiple]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → !self Enable +15s [unresolved]
      OnTrigger → [PR#]giant SetAnimationNotLooping "jalg" [prop_dynamic]
      OnTrigger → [PR#]g_s_2 StartSound +0.20000000298023224s [snd_event_point]
      OnTrigger → [PR#]giant_shake StartShake +1s [env_shake]
      OnTrigger → !activator KeyValue "movetypes 1" [unresolved]
      OnTrigger → [PR#]giant_speedtimer Disable [unresolved]
      OnTrigger → [PR#]giant_speedtimer Enable +2s [unresolved]
      OnTrigger → !activator KeyValue "movetypes 2" +1.5s [unresolved]
  distance to weapon: 118u
  tool event guesses: OnTrigger (10.0: leads to Enable after 15s (cooldown chain), 8 effects)
  tool cooldown guess: 15s (giant_pauk_r OnTrigger → giant_pauk_r Enable (+15s))
config trigger 994  [found by tool]
  trigger_teleport giant_tele #994 origin=13239 -14997 2675 parent=- lump=default_ents
    keys: target=[PR#]giant_in, filtername=[PR#]level3_t_item_filter, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → !self Disable [unresolved]
  distance to weapon: 26439u
  strips: no
  teleports to: -9260 -3680 -5384 (target giant_in (info_teleport_destination)) → 24u from weapon
knife selection-trigger search: trigger_teleport ww_tele #987 (teleports 368 units from the knife (target ww_in (info_teleport_destination))) | trigger_teleport giant_tele #994 (teleports 24 units from the knife (target giant_in (info_teleport_destination)))

### "Zombie Dragonpriest" hammerid=29313
weapon: knife=true
  weapon_knife knife_dr #29313 origin=-8704 -4544 -5226 parent=- lump=default_ents
    keys: spawnflags=1
    outputs:
      OnPlayerPickup → [PR#]dragon_ui Activate [logic_case]
      OnPlayerPickup → !activator KeyValue "speed 1.0" [unresolved]
      OnPlayerPickup → !activator KeyValue "health 25000" [unresolved]
      OnPlayerPickup → !activator SetDamageFilter "[PR#]t_filter" [unresolved]
      OnPlayerPickup → [PR#]dragon_dead Test [logic_branch]
      OnPlayerPickup → !activator Alpha "0" [unresolved]
      OnPlayerPickup → !activator AddContext "dpplayer:1" +0.05000000074505806s [unresolved]
      OnPlayerPickup → !activator AddContext "t_item_user:1" [unresolved]
  within 512u: prop_dynamic dr #29327 13u | prop_dynamic dragon_dummy #29336 13u | info_teleport_destination dragon_in #29312 26u | trigger_once dragon_strip #29318 40u | filter_proximity dragon_knife_filter_b #29333 42u | func_physbox dr_phbox #29310 54u | trigger_multiple dragon_slow #29320 54u | trigger_hurt dragon_doom #29322 55u | trigger_hurt dr_nuke #29314 58u | trigger_multiple dr_nuke2 #29325 63u | info_particle_system dragon_nuke1 #29328 70u | info_particle_system dragon_nuke2 #29329 82u | logic_measure_movement dragon_movement #29335 106u | logic_relay dragon_nuke #29317 129u | logic_branch dragon_dead #29334 130u | logic_case dragon_ui #29316 131u
tool suggestion: handlers [29332] triggers [1088]
config:          handlers [29317] triggers [1088]
  missing handlers: [29317]  extra handlers: [29332]
  missing triggers: []  extra triggers: []
  note: handler dragon_knife_filter_a (other OnPass): references weapon via filtername
  note: event OnPass: class default (no connections in map)
  note: trigger dr_tele: teleports 26 units from the knife (target dragon_in (info_teleport_destination))
  note: skipped trigger dr_nuke (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger dragon_slow (does not fire the item (nothing it outputs reaches a handler))
  note: skipped trigger dragon_doom (trigger_hurt is not hooked by CS2Fixes (only trigger_teleport/multiple/once))
  note: skipped trigger dr_nuke2 (does not fire the item (nothing it outputs reaches a handler))
config handler 29317 type=other event=OnTrigger mode=3 cooldown=0 maxuses=1  [MISSED by tool]
  logic_relay dragon_nuke #29317 origin=-8708 -4416 -5243 parent=- lump=default_ents
    keys: startdisabled=0
    fired by: trigger_once wr_brk_4 #592 OnStartTouch→Disable | func_button (unnamed) #607 OnPressed→Enable | func_physbox dr_phbox #29310 OnBreak→Kill +1s | logic_case dragon_ui #29316 OnCase01→Trigger
    outputs:
      OnTrigger → !activator KeyValue "movetype 1" [unresolved]
      OnTrigger → [PR#]dr SetAnimationLooping "niisama" [prop_dynamic]
      OnTrigger → [PR#]dr SetAnimation "[PR#]nuke" +3s [prop_dynamic]
      OnTrigger → [PR#]dr_nuke Enable +4s [trigger_hurt]
      OnTrigger → [PR#]dr_nuke Kill +5s [trigger_hurt]
      OnTrigger → [PR#]dragon_nuke1 Start [info_particle_system]
      OnTrigger → [PR#]dragon_nuke1 Kill +4s [info_particle_system]
      OnTrigger → [PR#]dragon_nuke2 Start +4s [info_particle_system]
      OnTrigger → [PR#]dragon_nuke2 Kill +5s [info_particle_system]
      OnTrigger → !self Disable [unresolved]
      OnTrigger → [PR#]dr_haal StartSound [unresolved]
      OnTrigger → [PR#]dr_haal2 StartSound +3s [snd_event_point]
      OnTrigger → !self Kill +7s [unresolved]
      OnTrigger → [PR#]dr_nuke2 Enable [trigger_multiple]
      … +7 more
  distance to weapon: 129u
  tool event guesses: OnTrigger (10.0: leads to Enable after 6s (cooldown chain), 18 effects)
  tool cooldown guess: -
config trigger 1088  [found by tool]
  trigger_teleport dr_tele #1088 origin=13421 -14882 2675 parent=- lump=default_ents
    keys: target=[PR#]dragon_in, filtername=[PR#]level4_t_item_filter, spawnflags=1, startdisabled=0
    outputs:
      OnStartTouch → !self Disable [unresolved]
  distance to weapon: 25668u
  strips: no
  teleports to: -8704 -4544 -5252 (target dragon_in (info_teleport_destination)) → 26u from weapon
knife selection-trigger search: trigger_teleport dr_tele #1088 (teleports 26 units from the knife (target dragon_in (info_teleport_destination)))

## Summary (config handlers found / extra, config triggers found / extra)
| item | hammerid | handlers cfg/found | extra | triggers cfg/found | extra |
| --- | --- | --- | --- | --- | --- |
| Nightingale | 29345 | 1/0 | 1 | 1/1 | 0 |
| Healmage | 29494 | 2/0 | 1 | 1/1 | 0 |
| Dovahkiin | 29435 | 4/0 | 1 | 1/1 | 0 |
| Archmage | 29372 | 2/0 | 1 | 1/1 | 0 |
| Daedric | 29402 | 2/0 | 1 | 1/1 | 0 |
| Freeze Staff | 225 | 1/1 | 1 | 0/0 | 0 |
| Heal Staff | 401 | 1/1 | 1 | 0/0 | 0 |
| Lever | 2276 | 0/0 | 1 | 0/0 | 0 |
| Torch | 2132 | 0/0 | 1 | 0/0 | 0 |
| Elder Scroll | 406 | 0/0 | 0 | 0/0 | 0 |
| Elder Scroll | 723 | 1/0 | 2 | 0/0 | 0 |
| Zombie Wolf | 29224 | 2/0 | 10 | 1/0 | 0 |
| Zombie Troll | 29179 | 2/2 | 10 | 1/0 | 0 |
| Zombie Giant | 29267 | 2/0 | 1 | 1/1 | 1 |
| Zombie Dragonpriest | 29313 | 1/0 | 1 | 1/1 | 0 |

