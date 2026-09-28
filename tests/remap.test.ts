import { describe, expect, it } from 'vitest';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon } from '../src/model/suggest';
import { serializeEntWatchConfig } from '../src/model/entwatch';
import { hintsFromGraph, hintsFromJsonc, remapConfig, replaceHammerId } from '../src/model/remap';
import type { ParsedMap } from '../src/model/entity';

/** A "next version" of the demo map where every hammerid changed. */
function bumpedMap(offset: number, mutate?: (m: ParsedMap) => void): ParsedMap {
  const m = buildDemoMap();
  for (const e of m.entities) {
    const id = String(parseInt(e.hammerId, 10) + offset);
    e.hammerId = id;
    e.props.hammeruniqueid = id;
  }
  mutate?.(m);
  return m;
}

describe('hammerid remapping across map versions', () => {
  const v1 = buildDemoMap();
  const g1 = new EntityGraph(v1.entities);
  const items = v1.entities.filter((e) => e.classname.startsWith('weapon_')).map((w) => suggestItemForWeapon(w, g1).item);
  const config = { items };

  it('re-resolves every id using hints from the previous map', () => {
    const hints = hintsFromGraph(config, g1);
    const g2 = new EntityGraph(bumpedMap(5000).entities);
    const r = remapConfig(config, g2, hints);
    expect(r.unresolved).toEqual([]);
    expect(r.changes.length).toBeGreaterThan(5);
    expect(r.config.items[0].hammerid).toBe('6201');
    expect(r.config.items[0].handlers.map((h) => h.hammerid)).toContain('6202');
    const push = r.config.items.find((i) => i.hammerid === '7200')!;
    expect(push.triggers).toEqual(['7201']);
    expect(push.handlers.map((h) => h.hammerid)).toEqual(['7202']);
  });

  it('re-resolves from the comments in an exported jsonc', () => {
    const text = serializeEntWatchConfig(config, {
      describeHammerId: (h) => {
        const e = g1.byHammerId.get(h)?.[0];
        return e ? `${e.classname}${e.targetname ? ' ' + e.targetname : ''}${e.source.templated ? ' (templated)' : ''}` : 'NOT FOUND IN MAP';
      },
    });
    const hints = hintsFromJsonc(text);
    expect(hints.get('1201')).toEqual({ classname: 'weapon_knife', targetname: 'fire_weapon' });
    expect(hints.get('2201')).toEqual({ classname: 'trigger_multiple', targetname: 'push_trigger' });
    expect(hints.get('1303')?.classname).toBe('math_counter');
    const g2 = new EntityGraph(bumpedMap(100).entities);
    const r = remapConfig(config, g2, hints);
    expect(r.unresolved).toEqual([]);
    expect(r.config.items.map((i) => i.hammerid)).toEqual(['1301', '1401', '1500', '2102', '2201', '2300', '2500']);
  });

  it('anchors unnamed entities to the item weapon and reports ambiguity', () => {
    // v2: buttons lost their names, and a second unrelated relay named fire_relay appears
    const v2 = bumpedMap(10, (m) => {
      for (const e of m.entities) {
        if (e.classname === 'func_button') {
          e.targetname = '';
          e.props.targetname = '';
        }
      }
    });
    const hints = hintsFromGraph(config, g1);
    for (const h of hints.values()) if (h.classname === 'func_button') h.targetname = undefined;
    const g2 = new EntityGraph(v2.entities);
    const r = remapConfig(config, g2, hints);
    const fireButton = r.changes.find((c) => c.from === '1202');
    expect(fireButton?.to).toBe('1212');
    expect(fireButton?.reason).toMatch(/wired to the item weapon/);
    expect(r.unresolved).toEqual([]);
  });

  it('lists candidates when nothing matches uniquely', () => {
    const g2 = new EntityGraph(bumpedMap(10).entities);
    const hints = new Map([['1203', { classname: 'logic_relay' }]]);
    const r = remapConfig({ items: [{ ...items[0], hammerid: '9999', handlers: items[0].handlers.filter((h) => h.hammerid === '1203') }] }, g2, hints);
    const u = r.unresolved.find((x) => x.hammerid === '1203');
    expect(u).toBeDefined();
    expect(u!.candidates.length).toBeGreaterThan(1);
    const fixed = replaceHammerId(r.config, '1203', u!.candidates[0].hammerId);
    expect(fixed.items[0].handlers[0].hammerid).toBe(u!.candidates[0].hammerId);
  });
});
