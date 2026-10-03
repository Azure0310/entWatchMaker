import { describe, expect, it } from 'vitest';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fixture, fixturePath } from './helpers';
import { writeVpk } from './vpkWriter';
import { VpkArchive, bufferByteSource } from '../src/formats/vpk';
import { loadMapFromVpk } from '../src/model/loadMap';

/** Mimics a CS2 workshop item: an addon package with the compiled map vpk nested inside. */
function workshopPackage(): Uint8Array {
  const enc = new TextEncoder();
  return writeVpk([
    { path: 'addoninfo.txt', data: enc.encode('"AddonInfo" { "name" "point_template_test" }') },
    { path: 'materials/dummy.vmat_c', data: new Uint8Array(64) },
    { path: 'maps/point_template_test.vpk', data: fixture('point_template_test.vpk') },
    { path: 'soundevents/soundevents_addon.vsndevts_c', data: new Uint8Array(16) },
  ]);
}

describe('nested (workshop style) vpk', () => {
  const pkg = workshopPackage();

  it('round trips through the test writer', async () => {
    const pak = await VpkArchive.open(bufferByteSource(pkg, '3070000000.vpk'));
    expect(pak.entries.map((e) => e.path).sort()).toEqual([
      'addoninfo.txt',
      'maps/point_template_test.vpk',
      'materials/dummy.vmat_c',
      'soundevents/soundevents_addon.vsndevts_c',
    ]);
    const inner = await pak.readEntry(pak.find('maps/point_template_test.vpk')!);
    expect(inner).toEqual(fixture('point_template_test.vpk'));
  });

  it('opens the nested map package without copying it', async () => {
    const pak = await VpkArchive.open(bufferByteSource(pkg, '3070000000.vpk'));
    const inner = await pak.openNested(pak.find('maps/point_template_test.vpk')!);
    expect(inner.entries).toHaveLength(16);
    const lump = await inner.readEntry(inner.find('maps/point_template_test/entities/default_ents.vents_c')!);
    expect(lump.length).toBe(3209);
  });

  it('loads the map through the workshop package and names it after the inner vpk', async () => {
    const map = await loadMapFromVpk(bufferByteSource(pkg, '3070000000.vpk'), new Map());
    expect(map.mapName).toBe('point_template_test');
    expect(map.entities).toHaveLength(14);
    expect(map.warnings.some((w) => w.includes('nested package maps/point_template_test.vpk'))).toBe(true);
  });

  it('reads the main map, not the biggest stage map, when the package holds several (ze_castlevania)', async () => {
    // stage maps in maps/stages/ are mostly geometry: the biggest nested vpks, some with more
    // entity data than the main map (ze_m0w0m_p); the skybox has almost none
    const stage = (name: string, lump: string, geometry: number) =>
      writeVpk([
        { path: `maps/${name}.vmap_c`, data: new Uint8Array(32) },
        { path: `maps/${name}/entities/default_ents.vents_c`, data: fixture(lump) },
        { path: `maps/${name}/world_physics.vphys_c`, data: new Uint8Array(geometry) },
      ]);
    const enc = new TextEncoder();
    const multi = writeVpk([
      { path: 'addoninfo.txt', data: enc.encode('"AddonInfo" { "name" "castlevania_like" }') },
      { path: 'maps/stages/cv_stage3.vpk', data: stage('cv_stage3', 'graphics_settings_ents.vents_c', 2 * 1024 * 1024) },
      { path: 'maps/point_template_test_skybox.vpk', data: stage('point_template_test_skybox', 'default_ents_kv3_v1.vents_c', 16) },
      { path: 'maps/point_template_test.vpk', data: fixture('point_template_test.vpk') },
    ]);
    const map = await loadMapFromVpk(bufferByteSource(multi, '3767338754.vpk'), new Map());
    expect(map.mapName).toBe('point_template_test');
    expect(map.entities).toHaveLength(14);
    expect(map.warnings.some((w) => w.includes('3 maps') && w.includes('maps/stages/cv_stage3.vpk') && !w.includes('not maps/point_template_test_skybox'))).toBe(true);
  });

  it('explains what a package without a map contains', async () => {
    const enc = new TextEncoder();
    const bad = writeVpk([{ path: 'materials/x.vmat_c', data: enc.encode('x') }, { path: 'models/y.vmdl_c', data: enc.encode('y') }]);
    await expect(loadMapFromVpk(bufferByteSource(bad, 'bad.vpk'), new Map())).rejects.toThrow(/No entity lumps.*2 files: vmat_c×1, vmdl_c×1/);
  });

  it('writes the workshop style fixture used by the browser tests', () => {
    // other test files read this fixture concurrently: rewrite it only when it changed, and atomically
    const target = fixturePath('workshop_nested.vpk');
    let same = false;
    try {
      same = Buffer.compare(readFileSync(target), Buffer.from(pkg)) === 0;
    } catch {
      same = false;
    }
    if (!same) {
      const tmp = `${target}.${process.pid}.tmp`;
      writeFileSync(tmp, pkg);
      renameSync(tmp, target);
    }
  });
});
