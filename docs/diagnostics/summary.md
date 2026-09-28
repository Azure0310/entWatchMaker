# Skyrim / Minas Tirith 診断まとめ

- ツール: entWatchMaker `claude/funny-dirac-qu7tgu` @ 6e81b6e。`npm test` は 58 passed + 1 skipped（GFL コーパスのテストはパスが固定されているため）で、`GFL_ENTWATCH_DIR` を clone した設定に向けると 59/59 passed。比較設定は gflze/CS2-ZE-Configs @ dfa2d0e（2026-09-24）。
- マップ: Workshop 3242492031 = ze_tesv_skyrim_p（15 items）、3314560349 = ze_lotr_minas_tirith_p（27 items、分割 VPK）。レポート先頭のマップ名と設定名は一致し、`NOT FOUND IN MAP` は 0 件なので差し替えはしていない。どちらもエラーなく約 1 秒で完了。
- 全文: [skyrim.report.md](skyrim.report.md) と [minas.report.md](minas.report.md)（`npm run --silent diagnose -- <folder> <config> --all`）。二次資料: skyrim.entities.json（2.2 MB）、minas.entities.json（3.0 MB）。距離は origin 間の値で、テンプレート lump（`NNN#entityLumpName`）内の origin は point_template #NNN を基準にしたローカル座標。

## 両マップ共通の結論（MISSED: Skyrim 19 件、Minas 15 件）
1. **game_ui の実体が `logic_case`**（`vscripts=game_ui`、`case01=PressedAttack` など）。武器の `OnPlayerPickup → *_ui Activate` の先にあるが、ツールは pickup 出力を辿らず、logic_case を use エンティティとして扱わない。そのため `OnCaseNN` の先にあるハンドラが候補に入らない。該当は Skyrim 16 件、Minas 7 件。
2. **テンプレート武器の origin がローカル座標**。lump 名の NNN は point_template の hammerid。その origin（ForceSpawn する env_entity_maker があればその origin）を足すと、着地点は武器から 0〜40u。ツールは 1.6k〜16k u と判定していた。トリガーの見逃しのうち Skyrim 2 件、Minas 7 件がこれ。
3. **`&0000` の名前修飾**。名前修飾ありの point_template（spawnflags に 2 が無いもの）では、lump 内の名前が `[PR#]ww_knife&0000` になり、`templateNN=[PR#]ww_knife` が解決しない。「トリガー → maker ForceSpawn → template → 武器」の連鎖がここで切れる。未解決の名前キーのうち、Skyrim は 49/49 件、Minas は 207/295 件がこれ。
4. **strip が想定外のクラス**。両マップとも player_weaponstrip は 0 個。Skyrim は各ナイフの上の trigger_once → `point_entity_finder`（OnFoundEntity → `!caller Kill`）。Minas は `logic_relay StripAndCleanPlayer(T)` → `point_script RunScriptInput "StripKnife"`。どちらもツールは認識できず、判定は全件 `strips: no`。
5. 余分な提案の主な原因は 3 つ。武器名を filtername で参照するだけの出力の無い filter を拾うこと、func_physbox（当たり判定で、OnBreak→Kill は後始末）を button 扱いすること、半径 384u で隣のアイテムの着地点まで拾うこと。

## ze_tesv_skyrim_p
### A. Summary (config handlers found / extra, config triggers found / extra)
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

### B. [MISSED by tool]（fired by 欄では tk_relay・BossHp・`*_phbox` OnBreak からの Kill など、後始末の入力を省略）
| item | id | class / targetname | origin | parent / lump | fired by | outputs（要約） | 武器まで |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nightingale | 29347 | logic_relay night_attk | -9416 -2251 -5332 | - / default_ents | night_ui OnCase01 (=PressedAttack2) | arrow_maker ForceSpawn +1.5s、アニメ・音、!self Disable→Enable +4s | 28u |
| Healmage | 29504 | logic_relay mg_push_rel | -9168 -304 -5146 | - / default_ents | mg_ui OnCase01 (PressedAttack) | push_mg(hurt) Enable→Disable 1.5s、particle、lvl1_boss_relay +4s、!self Enable +8s | 128u |
| Healmage | 29506 | logic_relay mg_kaitse | -9168 -284 -5146 | - / default_ents | mg_ui OnCase02 (PressedAttack2) | mg_kaitse1(hurt) Enable→Disable 4s、particle、!self Enable +40s | 111u |
| Dovahkiin | 29437 | logic_relay rynnak (startdisabled) | -9136 -998 -5160 | - / default_ents | doh_ui OnCase01 (PressedAttack)。pickup 時に level2 OnPass→Enable、level3/4→Kill | push_doh/hurt_doh Enable 0.8s→Disable 1.3s、!self Enable +3.75s | 192u |
| Dovahkiin | 29451 / 29450 / 29438 | logic_relay shout_fire / shout_freeze / shout_push (startdisabled) | x -9184 / -9168 / -9152, y -998, z -5160 | - / default_ents | doh_ui OnCase02 (PressedAttack2)。level2 / level3 / level4 の OnPass→Enable（他は Kill） | fire_shout(hurt) / freeze_shout(multiple) / push_shout(push) Enable→Disable、dohva_boss_relay、!self Enable +60/70/80s | 173 / 178 / 184u |
| Archmage | 29383 | logic_relay archmage_attk | -9024 -2080 -5280 | - / default_ents | archmage_ui OnCase01 (PressedAttack)。archmage_nuke から Disable→Enable +6s | archmage_push(push+hurt) Enable→Disable 1s、!self Enable +9s | 134u |
| Archmage | 29378 | logic_relay archmage_nuke | -8992 -2080 -5280 | - / default_ents | archmage_ui OnCase02 (PressedAttack2) | archmage_ulti(hurt) Enable→Disable 6s、shake、maag_boss_relay +4s、!self Enable +60s ほか 6 | 119u |
| Daedric | 29403 | logic_relay look_relay | -9296 -1572 -5284 | - / default_ents | dr_ui OnCase01 (PressedAttack)。nuke_relay から Disable→Enable +5s | hurt_dr/push_dr Enable→Disable 1s、!self Enable +2.15s | 214u |
| Daedric | 29412 | logic_relay nuke_relay | -9296 -1556 -5284 | - / default_ents | dr_ui OnCase02 (PressedAttack2)。BossHpIterations2 OnHitMin→Enable、nuke_counter OnHitMax→Kill（2 回まで） | nuke(hurt) Enable +5s→Disable +5.4s、nuke_counter Add、dr_boss_relay +5s、!self Enable +60s | 204u |
| Elder Scroll (723) | 1487 | logic_relay ScrollTrigger (startdisabled) | 40 4 8（ローカル） | - / 949#entityLumpName | scroll_filter OnPass→Trigger ← elder_1_button OnPressed。武器の OnPlayerPickup→Enable | scroll_boss +1s、scroll_maker ForceSpawn、score、shake、particle | 58u |
| Zombie Wolf | 29229 | logic_relay ww_relay&0000 | 32 0 0（ローカル） | - / 29230#entityLumpName | ww_ui&0000 OnCase01 (PressedAttack) | ww_attk(hurt) Enable 0.3s→Disable 0.7s、!self Enable +2s | 118u |
| Zombie Wolf | 29237 | logic_relay ww_shout&0000 | 64 0 0（ローカル） | - / 29230#entityLumpName | ww_ui&0000 OnCase02 (PressedAttack2) | ww_stop2(multiple) Enable 0.4s→Disable 3s、!activator movetype 1→2、!self Enable +25s | 115u |
| Zombie Wolf | trigger 987 | trigger_teleport ww_tele | 13695 -15179 2675 | - / default_ents | ww_phbox OnBreak→Enable、ww_enabled OnTrue/OnFalse、ww_break | OnStartTouch→ww_maker ForceSpawn・ww_counter Add・!self Disable。strips: no。teleports to ww_in (-9301 -3314 -5340) = 11247u | 20494u |
| Zombie Troll | trigger 990 | trigger_teleport troll_tele | 13415 -15181 2675 | - / default_ents | troll_enabled OnTrue/OnFalse、troll_break | OnStartTouch→troll_maker ForceSpawn・troll_counter Add・!self Disable。strips: no。teleports to troll_in (-9212 -2822 -5350) = 10946u | 20349u |
| Zombie Giant | 29270 | logic_relay giant_look | -9184 -3584 -5320 | - / default_ents | giant_ui OnCase01 (PressedAttack) | giant_hurt Enable 0.7s→Disable 1.3s、!self Enable +5s | 131u |
| Zombie Giant | 29271 | logic_relay giant_pauk_r | -9208 -3584 -5320 | - / default_ents | giant_ui OnCase02 (PressedAttack2) | giant_pauk(multiple) Enable 1s→Disable 2s、shake、!self Enable +15s | 118u |
| Zombie Dragonpriest | 29317 | logic_relay dragon_nuke | -8708 -4416 -5243 | - / default_ents | dragon_ui OnCase01 (=PressedAttack2)。wr_brk_4→Disable、ステージのレバー func_button #607→Enable | dr_nuke(hurt) Enable +4s→Kill +5s、dr_nuke2(multiple) Enable、!self Kill +7s（1 回きり） | 129u |

### C. トリガーの正体
- 設定のトリガー 9 件はすべて **(2) 選択部屋のテレポート**。`trigger_teleport` の `target` で `info_teleport_destination *_in` を直接指定している（point_teleport も relay も経由しない）。部屋の範囲は x 13239〜15431、y -15198〜-14866、z 2675〜2699。filtername は `levelN_ct_item_filter` / `levelN_t_item_filter`。
- 着地点から武器までの距離: Nightingale 13u、Healmage 28u、Dovahkiin 16u、Archmage 40u、Daedric 17u、Giant 24u、Dragonpriest 26u。Wolf 987 / Troll 990 はテレポート自身が env_entity_maker（ww_maker / troll_maker）を ForceSpawn する。maker の原点にローカル origin を足すと 23u / 16u（point_template の原点基準なら 16u / 0u）。
- CT 用のテレポートは OnStartTouch で `!self Kill` と `*_push Kill` を撃つ（1 回きり）。ZM 用は `!self Disable` し、counter と logic_branch で再び有効にする。
- strip: 設定のトリガーはどれも strip しない。map に player_weaponstrip / game_player_equip は無い。代わりに各ナイフの上に trigger_once（ナイフから 20〜49u。#29359、#29512、ww_strip&0000、dragon_strip など）がある。これが `point_entity_finder *_knife_stripper` の FindEntity を撃ち（filter_multi の条件: class=weapon_knife、name≠そのナイフ、128u 以内）、OnFoundEntity→`!caller Kill` で手持ちのナイフを消す。設定には載っていない。

### D. 能力ハンドラを撃っているもの
- ナイフ 9 種（CT 5・ZM 4）はすべて **game_ui**。実体は `logic_case *_ui`（`vscripts=game_ui`、`case01=PressedAttack` / `case02=PressedAttack2`。Nightingale と Dragonpriest は `case01=PressedAttack2` のみ）。武器の OnPlayerPickup→Activate で有効になり、`*_phbox` の OnBreak→Deactivate で止まる。func_button / trigger / logic_timer は使っていない。ui は親付けされていない。Wolf と Troll は ui・relay・ナイフが同じテンプレート lump、他は default_ents にある。
- Dovahkiin は OnCase01 が rynnak / rynnak2 / rynnak3 に、OnCase02 が shout 3 種に分岐する。pickup 時に `filter_activator_context level2/3/4` がそのうち 1 つだけを Enable し、残りを Kill する。設定には攻撃として rynnak（level2 用）しか載っておらず、rynnak3 #29463（level3）と rynnak2 #29462（level4）は未記載。
- Freeze Staff 703 / Heal Staff 402 は func_button が武器に直接親付けされている（default_ents、テンプレートなし）ので、ツールも見つけている。Elder Scroll 723 は func_button elder_1_button が武器に親付けされ、同じ point_template（scroll_template、名前修飾なし）に入っている。ボタン → filter → ScrollTrigger の順に撃つ。Lever / Torch / Elder Scroll 406 は設定にもハンドラが無い（func_physbox と logic_measure_movement で持ち運ぶアイテム）。

### E. 見逃した理由（推測）
1. **pickup の先を見ていない**。suggest.ts は tier 1 で OnPlayerPickup 出力をスキップし（`PICKUP_OUTPUTS`）、logic_case は `USE_CLASSES` に入っていない。武器 → ui → relay の名前参照自体は解決できているのに、`*_ui` の OnCase 先（16 件、すべて 1 段）が候補に入らない。
2. tier 1 で `*_knife_filter_a` を拾う（filtername=ナイフ名、negated、ナイフ除去用 filter_multi の部品で、出力なし）。これで `usable()` が真になり、200u の近接フォールバックも走らない（relay は 28〜214u の位置）。この filter が各ナイフの「extra 1」になっている。
3. Wolf は ww_ui 自体をハンドラとして採用し、ww_relay / ww_shout を「既にあるハンドラの後ろ」として除外した。Troll の relay が found になったのは、troll_phbox の OnBreak→Kill（後始末）を「ボタンから撃たれている」と数えたうえ、lump 内の並びで relay が ui より先に評価されたから（順序に依存している）。func_physbox を button 扱いするので、余分が 5 件ずつ出る。
4. トリガー 987 / 990 は、武器の origin がローカル座標なので着地点まで 11k u になり、384u の判定に入らない（閾値の問題ではない）。名前でも辿れない。ww_tele → ww_maker (ForceSpawn) → ww_template (entitytemplate) までは行けるが、その先の `template07=[PR#]ww_knife` が `&0000` 付きの実名に解決しない。
5. Elder Scroll 723 はボタン → filter → relay の 2 段。ツールは relay を「冗長」として落とすが、GFL は 1 回きりの relay のほうを数えている。
6. 余分な提案: Giant に ww_tele が付く（ww_in が giant ナイフから 368u < 384u）。Lever / Torch には、出力が 1 つも無い func_physbox を 200u フォールバックで提案している。

### F. 設定に無い武器
- なし（武器 15 本すべてが設定にある）。

## ze_lotr_minas_tirith_p
### A. Summary (config handlers found / extra, config triggers found / extra)
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

### B. [MISSED by tool]
| item | id | class / targetname | origin | parent / lump | fired by | outputs（要約） | 武器まで |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flag | trigger 7779 | trigger_teleport h_item_1_t | 8416 1564 10066 | - / default_ents | h_t_flag_c2 OnCase01〜04→AddOutput | OnStartTouch→StripAndCleanPlayer。strips: no。teleports to h_item_1 (8592 766 12879) = 15505u | 13219u |
| Armor | trigger 7781 | trigger_teleport h_item_2_t | 8416 1756 10066 | - / default_ents | h_t_armor_c2 OnCase02→AddOutput | →StripAndCleanPlayer。strips: no。→h_item_2 (8596 1081 12919) = 15559u | 13242u |
| Ammo Barrel | 357 | logic_branch item_supply_6 | 8637 1717 12917 | - / default_ents | supplyui OnCase16 (PressedAttack2)→Test | OnFalse: item_supply_4 ForceSpawn、手榴弾の maker を ForceSpawn +1s→Kill +25s、!self SetValue 1→0 +60s、音 | 62u |
| Oil Barrel | 868 | math_counter item_oil_8 | 9270 1863 12856 | - / default_ents | item_oil_4 (logic_compare) OnEqualTo→Add ← oilui OnCase16 (PressedAttack2)→Compare | OnHitMax: item_oil_4 SetValue 1→0 +60s、particle、!self SetValue 0 +60s | 73u |
| Horse | trigger 7785 | trigger_teleport h_item_5_t | 8608 2140 10066 | - / default_ents | h_t_horse_c2 OnCase02→AddOutput | →StripAndCleanPlayer。strips: no。→h_item_5 (8928 720 12864) = 15679u | 13421u |
| Gandalf | 686 | logic_compare item_gandalf_6 | 8950 1224 12905 | - / default_ents | item_gandalf_5 OnCase16 (PressedAttack2)→Compare | item_gandalf_7(push×3) Enable→Disable 10s、!self SetValue 1→0 +75s、physbox SetHealth ほか | 137u |
| Gandalf | 687 | logic_compare item_gandalf_10 | 8916 1229 12904 | - / default_ents | combo2_paso_4→Compare。paso_1〜4 は item_gandalf_5 の移動キー（D→A→W→D→S）で、各段が次段を 0.4s だけ Enable | item_gandalf_11(push) Enable 4.7s→Disable 6s、env_physexplosion、SetValue 1→0 +75s | 139u |
| Zombie Totem Pole | trigger 7862 | trigger_teleport triggers_spawan2_z_lv1 (startdisabled) | 10624 2136 10086 | - / default_ents | SOGMAHT / logica_extreme→Enable、GameMode_Totem OnTrue→AddOutput | →StripAndCleanPlayerT。strips: no。→z_item_1 (9619 766 12870) = 16089u | 14809u |
| Zombie TNT Barrel | 1115 | logic_branch item_tnt_3 | 9670 1447 12620 | - / default_ents | item_tnt_2 OnCase16 (PressedAttack2)→Test | OnTrue: !self SetValue 0→1 +20s、item_tnt_4 ForceSpawn（TNT 設置）、item_tnt_82 Compare | 52u |
| Zombie Troll | trigger 7797 | trigger_teleport triggers_spawan_z_lv3 | 11104 1756 10086 | - / default_ents | SOGMAHT / logica_extreme→Kill、GameMode_Troll OnFalse→AddOutput | →StripAndCleanPlayerT。strips: no。→z_item_4 (9922 1112 12856) = 16233u | 15065u |
| Zombie Balrog | 720 | logic_relay item_balrog_7 | 60 165 3（ローカル） | - / 138#entityLumpName | 同じ lump の game_ui である item_balrog_11 の OnCase15 (PressedAttack)。item_balrog_8 から Disable→Enable +6.5s | OnTrigger→!self FireUser1。OnUser1: item_balrog_10(hurt) Enable 1.75s→Disable 2.2s、physexplosion、!self Enable +3.5s、AddOutput で再装填 | 18299u |
| Zombie Balrog | 718 | logic_relay item_balrog_8 | 60 197 3（ローカル） | - / 138#entityLumpName | item_balrog_11 OnCase16 (PressedAttack2) | OnUser1: item_balrog_12(multiple) Enable→Disable 3s、!self Enable +15s、item_balrog_7 Disable→Enable +6.5s | 18293u |
| Zombie Nazgul | trigger 7755 | trigger_teleport stage_1_triggerx (startdisabled) | -6192 1864 5780 | - / default_ents | 人間側の trigger_once 8 個が OnStartTouch→FireUser1（→ !self Enable）、max_3_naz OnHitMax→Disable | item_nazgul_TemplateM ForceSpawn、StripAndCleanPlayer、max_3_naz Add。strips: no。→stage_1_item_naz_tele (-6582 2228 7072) = 9882u | 8642u |
| Zombie Nazgul | trigger 7753 | trigger_teleport stage_1_triggerx | 5035 -380 -3452 | - / default_ents | 同上 | item_nazgul_TemplateM2 ForceSpawn、StripAndCleanPlayer、max_3_naz Add。strips: no。→stage_1_item_naz_tele2 (-1590 476 254) = 1669u | 6144u |
| Barricade - Basket | 225 | func_button stage_1_barricade_1_33_2&0000 | 0 0 13（ローカル） | stage_1_barricade_1_35&0000 (#756) / 768#entityLumpName | 武器 #756 の OnPlayerPickup→FireUser1 | OnPressed→cadefix5 Trigger | 54u（別の lump 同士のローカル座標） |

### C. トリガーの正体
- 設定のトリガー 12 件はすべて `trigger_teleport` で、`target` を直接指定している（point_teleport は map に 0 個、relay を経由するテレポートも無い）。Nazgul 以外は **(2) 選択部屋のテレポート**（部屋の範囲は x 8412〜11104、y 1564〜2140、z 10066〜10086）。着地点から武器まで: Ammo 16u、Oil 9u、Gandalf 0u、White Knight 7u、TNT 0u、Ladder 2u、Balrog 0u。テンプレート武器は point_template の原点にローカル origin を足すと、Flag 0u、Armor 0u、Horse 3u、Totem 0u、Troll 2u（ツールの値は 15〜16k u）。
- strip は **relay 経由 + スクリプト**。選択部屋のテレポートは OnStartTouch で `logic_relay StripAndCleanPlayer`（CT）/ `StripAndCleanPlayerT`（ZM）を撃ち、その relay が `point_script script_minas RunScriptInput "StripKnife"`（+0.02s）と `!activator KeyValues`（体力・速度・重力を戻す）を撃つ。player_weaponstrip は 0 個。game_player_equip は quitarTodo（strip-all。I/O の入力が無いのでスクリプト側から使うと思われる）と dar_municion（弾薬）の 2 個だけ。Flag / Armor / Horse / Totem / Troll では、この strip 出力を logic_case のカウンタや `GameMode_*` branch が AddOutput でも追加している。
- **(3) Nazgul 7755 / 7753** は、ステージ途中にある ZM 用テレポート `stage_1_triggerx`（人間の到達で有効になり、max_3_naz で 3 体まで）。触れると env_entity_maker item_nazgul_TemplateM / M2 を ForceSpawn し、生成されるナイフの約 40u 下に着地、StripAndCleanPlayer で strip される。
- Balrog 7799（found）は、テレポートが point_template z_t_balrog を ForceSpawn して自身を Kill する。strip はナイフに親付けされた trigger_once item_balrog_18 → StripAndCleanPlayer（設定には無い。ツールはこれを余分なトリガーとして提案している）。
- Totem / TNT / Troll / Ladder では `triggers_spawan_*` と `triggers_spawan2_*` の 2 系統が同じ着地点を持ち、`GameMode_*` がどちらに strip を追加するかを選ぶ。GFL は片方だけを載せている。

### D. 能力ハンドラを撃っているもの
- Ammo / Oil / Gandalf / White Knight / TNT / Balrog は **game_ui**（`logic_case` + `vscripts=game_ui`、武器の OnPlayerPickup→Activate）。supplyui / oilui は `case01=PlayerOn` と `case16=PressedAttack2`、それ以外は `case11〜16` = Forward / MoveLeft / Back / MoveRight / Attack / Attack2。
  - 1 段: Ammo 357、TNT 1115、Gandalf 686、White Knight 713（いずれも OnCase16）、Balrog 720 / 718（OnCase15 / 16）。
  - 2 段: Oil 868（oilui → logic_compare item_oil_4 → math_counter）。
  - キーコンボ: Gandalf 687（combo2_paso_1〜4 → logic_compare）、White Knight 699（7 段の combo3_paso_1〜7 → relay）。paso は startdisabled で、次の paso を 0.4〜0.5s だけ Enable する。
- Balrog の ui と relay はテンプレート lump 138（z_t_balrog、名前修飾なし、テレポート 7799 が生成）にあり、ナイフ本体は default_ents にある。
- Barricade 13 件は、func_button が武器に親付けされ同じテンプレート lump に入っている（factory_template_typeN。ultra_optimize が KeyValues origin → ForceSpawn で多数の位置に生成）。ボタンが cadefixN relay を撃つ。Basket 以外はツールも見つけている。Flag / Armor / Horse / Totem / Troll / Nazgul / Ladder は設定にハンドラが無い。

### E. 見逃した理由（推測）
1. game_ui の logic_case（Skyrim と同じ理由）: Ammo / Oil / Gandalf / TNT / Balrog の 7 件。TNT では TFilter_4（`filtername=[PR#]item_tnt*` のワイルドカードで、出力なし）を拾って `usable()` が真になり、フォールバックが走らない。
2. 近接フォールバックで拾っても落としている。Ammo の item_supply_6（62u）と Oil の item_oil_4 / item_oil_8（34 / 73u）は「use から撃たれていない、Disable/Enable 型のクールダウンも無い」として却下された。実際のクールダウンは branch / compare / counter の `SetValue 1 → SetValue 0 +60s` で、inferCooldown が扱えない形。代わりに Disable/Enable を持つ w_ammo_timer を採用している。
3. Gandalf: item_gandalf_5 自体は physbox の OnBreak→Deactivate によって「撃たれている」扱いで採用されるが、tier 3 の展開はボタン / filter / hookable trigger からしか行わないので、logic_case の OnCase 先までは広がらない。687 はさらにコンボ relay 4 段の先にある。
4. Balrog はハンドラが別の lump（138）にあり、武器とのつながりは、無視される OnPlayerPickup→item_balrog_11 Activate とテンプレートだけ。距離の 18k u は、ローカル座標とワールド座標を比べた値。逆に、ナイフに親付けされた strip 用の trigger_once item_balrog_18 を activation trigger と判定し、その先の StripAndCleanPlayer をハンドラとして採用している（循環した誤検出）。
5. テンプレート武器のトリガー 5 件（Flag / Armor / Horse / Totem / Troll）: ローカル座標のため 15〜16k u になる。h_t_flag / h_t_armor / h_t_horse / z_t_totem / troll_spawner の templateNN も `&0000` のため未解決。ただし lump 名の 148 / 139 / 177 / 217 / 1440 がそのまま template の hammerid なので、名前を使わずに対応付けできる。
6. Nazgul 2 件も同じくローカル座標（maker 基準なら 40u）。trigger → maker (ForceSpawn) → item_nazgul_Template → item_nazgul_5&0000 の連鎖が `&0000` で切れる。
7. strip 判定: StripAndCleanPlayer(T) → point_script RunScriptInput "StripKnife" は `STRIP_CLASSES` にも `STRIP_PLAYER_INPUTS` にも無いので、全テレポートが `strips: no` になる。
8. Basket は設定側の誤り。Fence と同じ hammerid 757 になっているが、設定のコメントは "lump 768" で、lump 768 の武器は #756。ボタン 225 も #756 に親付けされている。
9. 余分な提案: 半径 384u で隣の着地点を拾っている（Gandalf に armor 324u・horse 372u、Ladder に totem 319u・troll 347u）。TNT / Ladder の spawan と spawan2 は着地点が同じ別経路なので、提案として妥当。White Knight の 2 件は physbox の OnBreak→Disable / CancelPending（後始末）経由でたまたま found になっており、余分が 13 件ある。

### F. 設定に無い武器（4）
- `weapon_deagle stage_1_barricade_1_35&0000 #756`（lump 768）: 本来の「Barricade - Basket」。ツールの提案 [225, 30367] に含まれる 225 が、設定の Basket のハンドラそのもの。
- `weapon_hegrenade item_supply_s3 #353`: Ammo Barrel の能力で配られる手榴弾（item_supply_s5 テンプレート。拾われると 1s 後に再生成し、自分を "nothing" に改名、25s 後に Kill）。消耗品なので設定に無くて妥当。
- `weapon_deagle nnew1_stage_2_short_torch&0000 #734` / `new1_stage_2_short_torch&0000 #731`: ステージ 2 の松明。template_torchShort2 / template_torchShort を ultra_optimize が位置を変えながら多数生成する。拾うと func_door を開いて灯り・push・HUD ヒントを出し、70s / 45s で消える。use 能力は無い（ツールは同じ lump の relay の OnSpawn を候補にしているが、誤検出）。

## 推定精度を上げるための候補（効果の大きい順）
1. 武器の OnPlayerPickup→Activate の先が、`vscripts=game_ui` を持つか caseNN が `Pressed*` / `PlayerOn` の logic_case なら、game_ui として扱う。OnCaseNN の直接の先をハンドラにし、キー名は caseNN の値から付ける。これだけで Skyrim 16 件、Minas 5 件が取れる（Oil は 2 段、コンボは relay の鎖）。
2. `NNN#entityLumpName` から point_template #NNN と、それを entitytemplate に持つ env_entity_maker を引く。テンプレート武器の位置を「spawner の原点 + ローカル origin」として距離を測り、トリガー → ForceSpawn → template → lump の連鎖も直接つなぐ。Skyrim 2 件、Minas 7 件が対象。
3. graph.ts の名前解決で `&\d{4}` の接尾辞を落とす。あわせて、`friendlyName` が小文字化の後に呼ばれているため `[pr#]` を落とせていない点も直す（Minas で 21 キーが該当。今回のアイテムには影響しない）。
4. strip 判定に `point_script RunScriptInput "*Strip*"` と `point_entity_finder FindEntity → Kill` を追加する。
5. 出力の無い filter / physbox はハンドラにしない。Kill / Disable / Deactivate / CancelPending の入力は「fed by」に数えない（後始末の入力で relay を拾う、順序依存の挙動をなくす）。
6. 着地点は最も近い武器にだけ割り当てる（または半径を 128u 程度に縮める）。
