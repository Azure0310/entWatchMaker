import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph } from '../src/model/graph';
import { suggestEvents } from '../src/model/events';
import { suggestHandler, suggestItemForWeapon } from '../src/model/suggest';
import { parseEntWatchConfig, serializeEntWatchConfig } from '../src/model/entwatch';
import type { MapEntity } from '../src/model/entity';

describe('event inference', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('prefers the output whose chain unlocks the button after a delay', () => {
    const g = suggestEvents(graph, byName('fire_button'));
    expect(g[0].event).toBe('OnPressed');
    expect(g[0].reason).toContain('Unlock after 45s');
    expect(suggestEvents(graph, byName('fire_filter'))[0].event).toBe('OnPass');
    expect(suggestEvents(graph, byName('heal_relay'))[0].event).toBe('OnTrigger');
    expect(suggestEvents(graph, byName('heal_ui'))[0].event).toBe('PressedAttack');
  });

  it('picks the ability output of a relay over its housekeeping output', () => {
    const relay: MapEntity = {
      id: 900,
      hammerId: '9000',
      classname: 'logic_relay',
      targetname: 'multi_relay',
      props: { classname: 'logic_relay', targetname: 'multi_relay', hammeruniqueid: '9000' },
      connections: [
        { output: 'OnTrigger', target: '!self', targetType: 7, input: 'Disable', param: '', delay: 0, timesToFire: -1 },
        { output: 'OnTrigger', target: '!self', targetType: 7, input: 'Enable', param: '', delay: 30, timesToFire: -1 },
        { output: 'OnUser4', target: 'fire_particle', targetType: 7, input: 'Start', param: '', delay: 0, timesToFire: -1 },
        { output: 'OnUser4', target: 'fire_hurt', targetType: 7, input: 'Enable', param: '', delay: 0, timesToFire: -1 },
        { output: 'OnUser1', target: '!self', targetType: 7, input: 'Kill', param: '', delay: 0, timesToFire: -1 },
      ],
      source: { kind: 'vpk', file: 'x', container: 'default_ents', scope: '', templated: false },
    };
    const g2 = new EntityGraph([...map.entities, relay]);
    const guesses = suggestEvents(g2, relay);
    expect(guesses[0].event).toBe('OnTrigger'); // cooldown chain wins
    expect(guesses[1].event).toBe('OnUser4'); // real effects next
    expect(guesses[guesses.length - 1].event).toBe('OnUser1'); // self kill last
    const s = suggestHandler(relay, g2);
    expect(s.event).toBe('OnTrigger');
    expect(s.cooldown).toBe(30);
  });

  it('falls back to class defaults when the entity has no connections', () => {
    const bare: MapEntity = { ...byName('fire_button'), id: 901, hammerId: '9001', connections: [] };
    expect(suggestEvents(graph, bare)[0].event).toBe('OnPressed');
  });

  it('writes event handlers without "type" like the GFL configs', () => {
    const { item } = suggestItemForWeapon(byName('fire_weapon'), graph);
    const text = serializeEntWatchConfig({ items: [item] }, { comments: false });
    const parsed = JSON.parse(text);
    const relay = parsed[0].handlers.find((h: { hammerid: string }) => h.hammerid === '1204');
    expect(relay.type).toBeUndefined();
    expect(relay.event).toBe('OnTrigger');
    expect(parseEntWatchConfig(text).config.items[0].handlers.find((h) => h.hammerid === '1204')?.type).toBe('other');
  });
});

// Optional robustness check against the GFL config corpus when it is available locally.
// Point GFL_ENTWATCH_DIR at a checkout of gflze/CS2-ZE-Configs/entwatch to run it.
const corpus = process.env.GFL_ENTWATCH_DIR ?? '';
describe.skipIf(!corpus || !existsSync(corpus))('GFL corpus', () => {
  it('parses every config and round trips the item count', () => {
    const files = readdirSync(corpus).filter((f) => f.endsWith('.jsonc'));
    expect(files.length).toBeGreaterThan(100);
    let items = 0;
    for (const f of files) {
      const text = readFileSync(path.join(corpus, f), 'utf8');
      const { config } = parseEntWatchConfig(text);
      items += config.items.length;
      const again = parseEntWatchConfig(serializeEntWatchConfig(config)).config;
      expect(again.items.length).toBe(config.items.length);
      for (let i = 0; i < config.items.length; i++) {
        expect(again.items[i].hammerid).toBe(config.items[i].hammerid);
        // counters ignore "event" (CS2Fixes forces OutValue), so the writer drops it for them
        const key = (h: { hammerid: string; event?: string; mode: number; type: string }) => [h.hammerid, h.type === 'counterup' || h.type === 'counterdown' ? '' : (h.event ?? ''), h.mode];
        expect(again.items[i].handlers.map(key)).toEqual(config.items[i].handlers.map(key));
      }
    }
    expect(items).toBeGreaterThan(1500);
  });

  it('writes most configs back exactly as GFL wrote them', () => {
    // read → write without comments gives the same text; what is left are minority styles (mode 2
    // without maxuses, GFL's own "type": "counter" / mode 6, message on mode 5 counters)
    const files = readdirSync(corpus).filter((f) => f.endsWith('.jsonc') && f !== 'template.jsonc');
    const same = files.filter((f) => {
      const text = readFileSync(path.join(corpus, f), 'utf8').replace(/\r\n/g, '\n');
      return serializeEntWatchConfig(parseEntWatchConfig(text).config, { comments: false }).trim() === text.trim();
    });
    expect(same.length).toBeGreaterThanOrEqual(140);
  });
});
