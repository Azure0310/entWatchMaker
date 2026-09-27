import { describe, expect, it } from 'vitest';
import { fixture, fixtureText } from './helpers';
import { readResourceKV3Data } from '../src/formats/resource';
import { parseEntityLump } from '../src/formats/entityLump';

function goldenHammerIds(golden: string): string[] {
  return [...golden.matchAll(/hammerUniqueId = "([^"]*)"/g)].map((m) => m[1]);
}

describe('entity lump (KV3 v5, uncompressed, keyValues3Data)', () => {
  const bytes = fixture('graphics_settings_ents.vents_c');
  const lump = parseEntityLump(bytes);
  const golden = fixtureText('golden/graphics_settings_ents.txt');

  it('parses lump metadata', () => {
    expect(readResourceKV3Data(bytes).version).toBe(5);
    expect(lump.name).toBe('default_ents');
    expect(lump.childLumps).toEqual([]);
  });

  it('matches the golden dump entity list', () => {
    const ids = lump.entities.map((e) => e.props.get('hammeruniqueid'));
    expect(ids).toEqual(goldenHammerIds(golden));
    expect(lump.entities[0].props.get('classname')).toBe('worldspawn');
    expect(lump.entities[0].props.get('skyname')).toBe('sky_day01_01');
    expect(lump.entities[0].props.get('startcolor')).toBe('0 0 0');
    expect(lump.entities[0].props.get('startdark')).toBe('0');
    expect(lump.entities[0].props.get('minpropscreenwidth')).toBe('0');
    expect(lump.entities[0].props.get('maxpropscreenwidth')).toBe('-1');
  });

  it('reads connections', () => {
    const withConn = lump.entities.find((e) => e.connections.length > 0)!;
    expect(withConn).toBeDefined();
    const c = withConn.connections[0];
    expect(c).toEqual({
      output: 'OnMapSpawn',
      targetType: 7,
      target: '[PR#]cam_models',
      input: 'SetOn',
      param: '',
      delay: 0,
      timesToFire: -1,
    });
    const cam = lump.entities.find((e) => e.props.get('targetname') === '[PR#]cam_models')!;
    expect(cam.props.get('classname')).toBe('point_camera');
  });
});

describe('entity lump (KV3 v2, packed m_keyValuesData with hashed keys)', () => {
  const lump = parseEntityLump(fixture('ascent_speedup_switch_template_ents.vents_c'));

  it('decodes hashed keys', () => {
    expect(lump.name).toBe('ascent_speedup_switch_breakable_template_1');
    expect(lump.hammerUniqueId).toBe('3687:3860');
    expect(lump.entities).toHaveLength(1);
    const e = lump.entities[0];
    expect(e.props.get('classname')).toBe('func_physbox');
    expect(e.props.get('targetname')).toBe('[PR#]ascent_conveyor_100_speedup_lever_breakable');
    expect(e.props.get('origin')).toBe('5.000000 41.000000 5.000000');
    expect(e.props.get('scales')).toBe('1.000000 1.000000 1.000000');
    expect(e.props.get('hammeruniqueid')).toBeDefined();
  });
});

describe('entity lump (other KV3 versions)', () => {
  it('parses KV3 v4 with zstd', () => {
    const bytes = fixture('default_ents_kv3_v4_zstd.vents_c');
    expect(readResourceKV3Data(bytes).version).toBe(4);
    const lump = parseEntityLump(bytes);
    expect(lump.entities.length).toBeGreaterThan(10);
    expect(lump.entities[0].props.get('classname')).toBe('worldspawn');
    for (const e of lump.entities) expect(e.props.get('classname')).toBeTruthy();
  });

  it('parses KV3 v1', () => {
    const bytes = fixture('default_ents_kv3_v1.vents_c');
    expect(readResourceKV3Data(bytes).version).toBe(1);
    const lump = parseEntityLump(bytes);
    expect(lump.entities.length).toBeGreaterThan(0);
    expect(lump.entities[0].props.get('classname')).toBe('worldspawn');
  });

  it('parses legacy KV3 v0', () => {
    const bytes = fixture('default_ents_kv3_v0.vents_c');
    expect(readResourceKV3Data(bytes).version).toBe(0);
    const lump = parseEntityLump(bytes);
    expect(lump.entities.length).toBeGreaterThan(0);
    expect(lump.entities[0].props.get('classname')).toBe('worldspawn');
  });
});
