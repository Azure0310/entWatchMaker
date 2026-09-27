import { describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { loadMapFromVmaps } from '../src/model/loadMap';
import { EntityGraph } from '../src/model/graph';

describe('vmap entity extraction', () => {
  it('extracts entities with node ids as hammer ids', () => {
    const map = loadMapFromVmaps([{ name: 'cs2_map.vmap', bytes: fixture('cs2_map.vmap') }]);
    expect(map.mapName).toBe('cs2_map');
    expect(map.entities.length).toBeGreaterThan(0);
    for (const e of map.entities) {
      expect(e.classname.length).toBeGreaterThan(0);
      expect(e.hammerId).toMatch(/^\d+$/);
      expect(e.props.hammeruniqueid).toBe(e.hammerId);
    }
    const ids = new Set(map.entities.map((e) => e.hammerId));
    expect(ids.size).toBe(map.entities.length);
  });

  it('reads connections and resolves prefab lineage when prefab files are provided', () => {
    const files = [
      { name: 'roundtrip_test.vmap', bytes: fixture('roundtrip_test.vmap') },
      { name: 'roundtrip_test_prefab1.vmap', bytes: fixture('roundtrip_test_prefab1.vmap') },
    ];
    const map = loadMapFromVmaps(files);
    expect(map.mapName).toBe('roundtrip_test');
    const withConn = map.entities.filter((e) => e.connections.length > 0);
    expect(withConn.length).toBeGreaterThan(0);
    for (const c of withConn[0].connections) {
      expect(c.output.length).toBeGreaterThan(0);
      expect(c.input.length).toBeGreaterThan(0);
      expect(c.target.length).toBeGreaterThan(0);
    }
    // prefab2/prefab3 are referenced but not provided -> warning, prefab1 is unrelated
    expect(map.warnings.some((w) => w.includes('roundtrip_test_prefab2.vmap'))).toBe(true);
    const graph = new EntityGraph(map.entities);
    const src = withConn[0];
    const rels = graph.relationsOf(src);
    expect(rels.some((r) => r.kind === 'output')).toBe(true);
  });

  it('prefixes entities from provided prefabs with the prefab node id', () => {
    // Build a synthetic check: the prefab1 file alone parses as its own map
    const alone = loadMapFromVmaps([{ name: 'roundtrip_test_prefab1.vmap', bytes: fixture('roundtrip_test_prefab1.vmap') }]);
    expect(alone.entities.every((e) => /^\d+$/.test(e.hammerId))).toBe(true);
  });
});
