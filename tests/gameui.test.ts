import { describe, expect, it } from 'vitest';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon } from '../src/model/suggest';
import { abilityOutputs, hasUseOutput, isGameUi } from '../src/model/roles';
import { hasSelfCooldown, inferCooldown } from '../src/model/cooldown';
import { validateConfig } from '../src/model/validate';

describe('game_ui implemented as a logic_case script', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('recognises the script logic_case and its pressed keys', () => {
    expect(isGameUi(byName('dragon_ui'))).toBe(true);
    expect(isGameUi(byName('heal_ui'))).toBe(true);
    expect(isGameUi(byName('ice_case'))).toBe(false);
    expect(abilityOutputs(byName('dragon_ui'))).toEqual([
      { output: 'OnCase01', key: 'PressedAttack' },
      { output: 'OnCase02', key: 'PressedAttack2' },
    ]);
    // PlayerOn is the activation, not a press
    expect(abilityOutputs(byName('supplyui'))).toEqual([{ output: 'OnCase16', key: 'PressedAttack2' }]);
    expect(hasUseOutput(byName('dragon_phbox'))).toBe(false); // OnBreak housekeeping only
    expect(hasUseOutput(byName('heal_physbox'))).toBe(true);
  });

  it('hands the handlers to the relays behind the keys, main attack first and unnamed like GFL', () => {
    const { item, notes } = suggestItemForWeapon(byName('dragon_knife'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2602', '2603']);
    const [attk, nuke] = item.handlers;
    // GFL never names handlers after the key (skyrim Healmage / Archmage: two keys, no names)
    expect(attk.name).toBeUndefined();
    expect(attk.event).toBe('OnTrigger');
    expect(attk.cooldown).toBe(5);
    // a 5 s attack is fired over and over: chat off, as GFL writes it
    expect(attk.message).toBe(false);
    expect(nuke.name).toBeUndefined();
    expect(nuke.cooldown).toBe(60);
    expect(nuke.message).toBe(true);
    expect(nuke.type).toBe('other');
    // the ui itself, the housekeeping physbox and the output-less filter are not handlers
    expect(notes.some((n) => n.includes('dragon_phbox') && n.includes('housekeeping'))).toBe(true);
    expect(notes.some((n) => n.includes('dragon_knife_filter_a') && n.includes('no outputs'))).toBe(true);
    expect(notes.some((n) => n.startsWith('game_ui dragon_ui'))).toBe(true);
    // the selection teleport; not the giant's teleport, and not the knife-removal trigger_once above
    // the knife: nothing ties it to the knife (like skyrim, where GFL lists only the teleport)
    expect([...item.triggers].sort()).toEqual(['2611']);
    expect(validateConfig({ items: [item] }, graph).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('keeps a single-key item unnamed and gives the landing to the nearest knife only', () => {
    const { item } = suggestItemForWeapon(byName('giant_knife'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2702']);
    expect(item.handlers[0].name).toBeUndefined();
    expect(item.triggers).toEqual(['2704']);
  });

  it('follows the template chain: maker origin + local origin, &0000 names, ForceSpawn trigger', () => {
    const { item, notes } = suggestItemForWeapon(byName('[PR#]ww_knife&0000'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2511', '2512']);
    expect(item.handlers.map((h) => h.name)).toEqual([undefined, undefined]);
    // the attack relay re-enables itself after 2s: a double-press guard, not a cooldown, so the
    // attack has no cooldown at all (mode 1, chat off)
    expect(item.handlers.map((h) => h.cooldown)).toEqual([0, 25]);
    expect(item.handlers.map((h) => h.mode)).toEqual([1, 2]);
    expect(item.handlers.map((h) => h.message)).toEqual([false, true]);
    expect(item.handlers.every((h) => h.templated === undefined)).toBe(true);
    expect([...item.triggers].sort()).toEqual(['2502', '2515']);
    expect(notes.some((n) => n.includes('ww_tele') && n.includes('spawns'))).toBe(true);
    expect(notes.some((n) => n.includes('ww_strip') && n.includes('strip zone'))).toBe(true);
  });

  it('reads SetValue 1 / SetValue 0 cooldowns and ignores strip relays', () => {
    const branch = byName('item_supply_6');
    expect(hasSelfCooldown(graph, branch)).toBe(true);
    const cd = inferCooldown(graph, branch);
    expect(cd?.seconds).toBe(60);
    expect(cd?.reason).toContain('SetValue');
    const { item, notes } = suggestItemForWeapon(byName('item_supply_1'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2802']);
    expect(item.handlers[0].event).toBe('OnFalse');
    expect(item.handlers[0].cooldown).toBe(60);
    expect(item.handlers[0].mode).toBe(2);
    // the strip relay fired by the trigger_once on the knife is selection wiring, not an ability
    expect(notes.some((n) => n.includes('StripAndCleanPlayer') && n.includes('strips the player'))).toBe(true);
    expect([...item.triggers].sort()).toEqual(['2806', '2810']);
    expect(notes.some((n) => n.includes('h_item_3_t') && n.includes('teleports'))).toBe(true);
  });

  it('uses the relay behind a real game_ui and keeps the physbox as a plain +use hook', () => {
    const { item } = suggestItemForWeapon(byName('heal_weapon'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['1401', '1403']);
    expect(item.handlers[0].type).toBe('button');
    expect(item.handlers[0].event).toBeUndefined();
    expect(item.handlers[1].event).toBe('OnTrigger');
    expect(item.handlers[1].cooldown).toBe(60);
  });
});
