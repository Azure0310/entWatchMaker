import { describe, expect, it } from 'vitest';
import { fixturePath } from './helpers';
import { fileByteSource } from '../scripts/nodeByteSource';
import { loadLocalMap } from '../scripts/loadLocal';

describe('local scripts', () => {
  it('reads a vpk from disk through range reads', async () => {
    const src = await fileByteSource(fixturePath('workshop_nested.vpk'));
    const head = await src.read(0, 4);
    expect([...head]).toEqual([0x34, 0x12, 0xaa, 0x55]);
    const tail = await src.read(src.size - 2, 10);
    expect(tail.length).toBe(2);
  });

  it('loads a workshop package and a vmap by path', async () => {
    const pak = await loadLocalMap(fixturePath('workshop_nested.vpk'));
    expect(pak.mapName).toBe('point_template_test');
    expect(pak.entities).toHaveLength(14);
    const vmap = await loadLocalMap(fixturePath('roundtrip_test.vmap'));
    expect(vmap.entities.length).toBeGreaterThan(20);
  });
});
