import { describe, expect, it } from 'vitest';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph } from '../src/model/graph';
import { friendlyName } from '../src/model/entity';
import { spawnersOf, templateOf, worldPositions } from '../src/model/position';

describe('compiler name decorations', () => {
  it('strips the [PR#] prefix in any case and the &0000 template suffix', () => {
    expect(friendlyName('[PR#]ww_knife&0000')).toBe('ww_knife');
    expect(friendlyName('[pr#]ww_knife')).toBe('ww_knife');
    expect(friendlyName('ww_relay&0001')).toBe('ww_relay');
    expect(friendlyName('name&12')).toBe('name&12');
    expect(friendlyName('plain')).toBe('plain');
  });

  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('resolves references with and without the decorations', () => {
    const knife = byName('[PR#]ww_knife&0000');
    expect(graph.resolveName('[PR#]ww_knife')).toEqual([knife]);
    expect(graph.resolveName('ww_knife')).toEqual([knife]);
    expect(graph.resolveName('[pr#]WW_KNIFE&0000')).toEqual([knife]);
    expect(graph.resolveName('[PR#]ww_relay&0000')).toEqual([byName('[PR#]ww_relay&0000')]);
    // templateNN keys of the point_template reach the fixed-up lump entities
    const tpl = byName('ww_template');
    const members = graph.relationsOf(tpl).filter((r) => r.kind === 'template').map((r) => r.other.targetname);
    expect(members).toContain('[PR#]ww_knife&0000');
    expect(members).toContain('[PR#]ww_ui&0000');
    // and the OnCase outputs inside the lump resolve to the relays
    const ui = byName('[PR#]ww_ui&0000');
    expect(graph.connectionTargets(ui, ui.connections[0]).map((e) => e.hammerId)).toEqual(['2511']);
  });

  it('finds the template and the maker of a lump entity and computes world positions', () => {
    const knife = byName('[PR#]ww_knife&0000');
    const tpl = templateOf(graph, knife);
    expect(tpl?.targetname).toBe('ww_template');
    expect(spawnersOf(graph, tpl!).map((m) => m.targetname)).toEqual(['ww_maker']);
    const pos = worldPositions(graph, knife);
    expect(pos).toHaveLength(1);
    expect(pos[0].position).toEqual([-9376 + 59, -3200 - 114, -5336 + 12]);
    expect(pos[0].via).toContain('ww_maker');
    // a lump whose template has no maker and no origin keeps the local origin
    expect(worldPositions(graph, byName('ice_weapon'))[0].position).toEqual([-256, 64, 32]);
    expect(worldPositions(graph, byName('sleep_weapon'))).toEqual([]);
    // ordinary entities: their origin
    expect(worldPositions(graph, byName('dragon_knife'))[0]).toEqual({ position: [-8704, -4544, -5226], via: 'origin' });
  });
});
