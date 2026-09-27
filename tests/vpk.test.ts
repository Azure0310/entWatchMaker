import { describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { VpkArchive, bufferByteSource, classifyVpkFileName } from '../src/formats/vpk';
import { parseEntityLump } from '../src/formats/entityLump';

describe('vpk', () => {
  it('reads the directory tree of a single-file CS2 map vpk', async () => {
    const pak = await VpkArchive.open(bufferByteSource(fixture('point_template_test.vpk')));
    expect(pak.version).toBe(2);
    expect(pak.entries).toHaveLength(16);
    const lumps = pak.entries.filter((e) => e.ext === 'vents_c').map((e) => e.path).sort();
    expect(lumps).toContain('maps/point_template_test/entities/default_ents.vents_c');
    expect(lumps).toHaveLength(7);
  });

  it('reads entries and follows point_template child lumps', async () => {
    const pak = await VpkArchive.open(bufferByteSource(fixture('point_template_test.vpk')));
    const main = parseEntityLump(await pak.readEntry(pak.find('maps/point_template_test/entities/default_ents.vents_c')!));
    expect(main.childLumps).toHaveLength(6);
    expect(main.entities).toHaveLength(7);
    const templates = main.entities.filter((e) => e.props.get('classname') === 'point_template');
    expect(templates).toHaveLength(6);

    const childEntities = [];
    for (const child of pak.entries.filter((e) => e.ext === 'vents_c' && !e.path.endsWith('default_ents.vents_c'))) {
      const lump = parseEntityLump(await pak.readEntry(child));
      childEntities.push(...lump.entities.map((e) => ({ lump: lump.name, ...e })));
    }
    expect(childEntities).toHaveLength(7);
    const names = childEntities.map((e) => e.props.get('targetname'));
    expect(names).toContain('[PR#]crate_offset');
    expect(names).toContain('[PR#]crate_rotated');
    // crate_shared is referenced by two templates, so the compiler emitted it into two child lumps
    expect(names.filter((n) => n === '[PR#]crate_shared')).toHaveLength(2);
    // every template's entitylumpname resolves to one of the child lumps
    const lumpNames = new Set(childEntities.map((e) => e.lump));
    for (const t of templates) expect(lumpNames.has(t.props.get('entitylumpname')!)).toBe(true);
  });

  it('reads the entity io test map', async () => {
    const pak = await VpkArchive.open(bufferByteSource(fixture('entity_io_param_map_test.vpk')));
    const lump = parseEntityLump(await pak.readEntry(pak.find('maps/wtf/entities/default_ents.vents_c')!));
    const conns = lump.entities.flatMap((e) => e.connections);
    expect(conns.length).toBeGreaterThan(0);
  });

  it('classifies split archive names', () => {
    expect(classifyVpkFileName('ze_map_dir.vpk')).toEqual({ base: 'ze_map', kind: 'dir', index: -1 });
    expect(classifyVpkFileName('ze_map_003.vpk')).toEqual({ base: 'ze_map', kind: 'archive', index: 3 });
    expect(classifyVpkFileName('ze_map.vpk')).toEqual({ base: 'ze_map', kind: 'single', index: -1 });
  });
});
