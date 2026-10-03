import { describe, expect, it } from 'vitest';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph } from '../src/model/graph';
import { classifyTrigger, findSelectionTriggers, isKnife, spawnsEntity } from '../src/model/triggers';
import { suggestItemForWeapon } from '../src/model/suggest';

describe('knife / class item triggers', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('classifies strip and teleport triggers', () => {
    expect(isKnife(byName('nazgul_weapon'))).toBe(true);
    expect(isKnife(byName('fire_weapon'))).toBe(true);
    expect(isKnife(byName('heal_weapon'))).toBe(false);
    const strip = classifyTrigger(graph, byName('nazgul_strip'));
    expect(strip.strips?.via).toContain('player_weaponstrip');
    const tp = classifyTrigger(graph, byName('nazgul_tp'));
    expect(tp.teleportsTo?.positions).toEqual([[5000, 5010, 0]]);
    const relayTp = classifyTrigger(graph, byName('nazgul_tp2'));
    expect(relayTp.teleportsTo?.via).toContain('point_teleport');
    // strips through a point_entity_finder that kills the found knife, and through a script relay
    expect(classifyTrigger(graph, byName('dragon_strip')).strips?.via).toContain('point_entity_finder');
    expect(classifyTrigger(graph, byName('h_item_3_t')).strips?.via).toContain('RunScriptInput');
    expect(classifyTrigger(graph, byName('dragon_tele')).strips).toBeNull();
    // a teleport that ForceSpawns the maker of the knife's template
    expect(spawnsEntity(graph, byName('ww_tele'), byName('[PR#]ww_knife&0000'))?.via).toContain('ForceSpawn');
    expect(spawnsEntity(graph, byName('ww_tele'), byName('dragon_knife'))).toBeNull();
  });

  it('finds the strip zone tied to the knife and the teleports landing there, not the spawn strip', () => {
    const sel = findSelectionTriggers(graph, byName('nazgul_weapon'));
    const ids = sel.map((s) => s.trigger.hammerId);
    expect(ids).toContain('2401'); // strip zone parented to the knife
    expect(ids).toContain('2403'); // trigger_teleport whose destination is on the knife
    expect(ids).toContain('2405'); // trigger_multiple firing a point_teleport onto the strip zone
    expect(ids).not.toContain('2410'); // spawn strip far away
    // templated knife: positions come from the maker, the ForceSpawn teleport is listed first
    expect(findSelectionTriggers(graph, byName('[PR#]ww_knife&0000')).map((s) => s.trigger.hammerId)).toEqual(['2502', '2515']);
    // landings go to the nearest knife only; a strip zone that is merely above the knife (not
    // parented, templated with it or killed on pickup) is not the item's trigger
    expect(findSelectionTriggers(graph, byName('dragon_knife')).map((s) => s.trigger.hammerId)).toEqual(['2611']);
    expect(findSelectionTriggers(graph, byName('giant_knife')).map((s) => s.trigger.hammerId)).toEqual(['2704']);
  });

  it('adds them to the item and keeps the ability relay', () => {
    const { item, notes } = suggestItemForWeapon(byName('nazgul_weapon'), graph);
    expect(item.triggers.sort()).toEqual(['2401', '2403', '2405']);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2407', '2408']);
    expect(notes.some((n) => n.includes('strip zone'))).toBe(true);
    // non-knife items do not get spatial strip/teleport guesses
    const heal = suggestItemForWeapon(byName('heal_weapon'), graph);
    expect(heal.item.triggers).toEqual([]);
  });
});
