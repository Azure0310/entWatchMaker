import { describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { dmxElementArray, isDmxElement, parseDmx } from '../src/formats/dmx';

describe('dmx binary 9 (CS2 vmap)', () => {
  it('parses the cs2 sample map', () => {
    const doc = parseDmx(fixture('cs2_map.vmap'));
    expect(doc.encodingVersion).toBe(9);
    expect(doc.format).toBe('vmap');
    expect(doc.formatVersion).toBe(35);
    expect(doc.prefix.get('asset_preview_thumbnail_format')).toBe('jpg');
    expect(doc.root?.type).toBe('CMapRootElement');
    const world = doc.root!.attrs.get('world');
    expect(isDmxElement(world) && world.type).toBe('CMapWorld');
    const types = new Map<string, number>();
    for (const e of doc.elements) types.set(e.type, (types.get(e.type) ?? 0) + 1);
    expect(types.get('CMapEntity') ?? 0).toBeGreaterThan(0);
    // entity_properties holds the key values
    const ent = doc.elements.find((e) => e.type === 'CMapEntity')!;
    const props = ent.attrs.get('entity_properties');
    expect(isDmxElement(props)).toBe(true);
    expect(isDmxElement(props) && props.attrs.get('classname')).toBeTypeOf('string');
    expect(typeof ent.attrs.get('nodeID')).toBe('number');
  });

  it('parses a map with prefabs and connections', () => {
    const doc = parseDmx(fixture('roundtrip_test.vmap'));
    expect(doc.formatVersion).toBe(40);
    const prefabs = doc.elements.filter((e) => e.type === 'CMapPrefab');
    expect(prefabs.length).toBeGreaterThan(0);
    expect(typeof prefabs[0].attrs.get('targetMapPath')).toBe('string');
    const connections = doc.elements.filter((e) => e.type === 'DmeConnectionData');
    expect(connections.length).toBeGreaterThan(0);
    const c = connections[0].attrs;
    expect(typeof c.get('outputName')).toBe('string');
    expect(typeof c.get('targetName')).toBe('string');
    expect(typeof c.get('inputName')).toBe('string');
    const owner = doc.elements.find((e) => dmxElementArray(e.attrs.get('connectionsData')).length > 0)!;
    expect(owner).toBeDefined();
  });

  it('parses a prefab file', () => {
    const doc = parseDmx(fixture('roundtrip_test_prefab1.vmap'));
    expect(doc.root?.type).toBe('CMapRootElement');
    expect(typeof doc.root?.attrs.get('isprefab')).toBe('boolean');
  });
});
