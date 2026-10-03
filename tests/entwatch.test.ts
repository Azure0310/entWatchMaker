import { describe, expect, it } from 'vitest';
import { effectiveHandler, newHandler, newItem, parseEntWatchConfig, serializeEntWatchConfig, stripJsonComments, usesCooldown, usesMaxUses } from '../src/model/entwatch';

const sample = `[
    {
        "name": "Earth Materia",
        "shortname": "Earth",
        "hammerid": "887",
        "message": true,
        "ui": true,
        "transfer": true,
        "color": "orange",
        "handlers": [
            {
                "type": "button",
                "hammerid": "12127",
                "event": "OnPressed",
                "mode": 2,
                "cooldown": 55,
                "maxuses": 0,
                "message": true,
                "ui": true
            }
        ]
    },
    {
        "name": "Electro Materia",  // comment
        "shortname": "Electro",
        "hammerid": "1619",
        "triggers": ["10", "11"],
        "handlers": [
            { "type": "button", "hammerid": "1617" },
            { "type": "counterup", "hammerid": "1625", "mode": 4, "cooldown": 75, "offset": [5, -9], "message": true, "ui": true }
        ]
    }
]`;

describe('entwatch jsonc', () => {
  it('strips comments', () => {
    expect(JSON.parse(stripJsonComments('{"a": 1, // c\n "b": [1,2,], /* x */ }'))).toEqual({ a: 1, b: [1, 2] });
    expect(JSON.parse(stripJsonComments('{"url": "http://x//y"}'))).toEqual({ url: 'http://x//y' });
  });

  it('parses the GFL style config', () => {
    const { config, warnings } = parseEntWatchConfig(sample);
    expect(warnings).toEqual([]);
    expect(config.items).toHaveLength(2);
    expect(config.items[0].hammerid).toBe('887');
    expect(config.items[0].handlers[0].event).toBe('OnPressed');
    expect(config.items[0].handlers[0].cooldown).toBe(55);
    expect(config.items[1].triggers).toEqual(['10', '11']);
    expect(config.items[1].handlers[1].type).toBe('counterup');
    expect(config.items[1].handlers[1].offset).toEqual([5, -9]);
    expect(config.items[1].handlers[0].mode).toBe(1);
  });

  it('round trips through the serializer', () => {
    const { config } = parseEntWatchConfig(sample);
    const text = serializeEntWatchConfig(config, { describeHammerId: (h) => (h === '887' ? 'weapon_knife earth' : undefined) });
    expect(text).toContain('"hammerid": "887", // weapon_knife earth');
    const again = parseEntWatchConfig(text).config;
    expect(again.items.map((i) => ({ ...i, uid: '', handlers: i.handlers.map((h) => ({ ...h, uid: '' })) }))).toEqual(
      config.items.map((i) => ({ ...i, uid: '', handlers: i.handlers.map((h) => ({ ...h, uid: '' })) })),
    );
    // hammerids are strings
    expect(text).not.toMatch(/"hammerid": \d/);
  });

  it('writes counters without event and buttons with event', () => {
    const item = newItem({ name: 'X', hammerid: '1', handlers: [newHandler({ type: 'counterdown', hammerid: '2', mode: 5 }), newHandler({ type: 'button', hammerid: '3', event: 'OnPressed' })] });
    const text = serializeEntWatchConfig({ items: [item] }, { comments: false });
    const parsed = JSON.parse(text);
    expect(parsed[0].handlers[0].event).toBeUndefined();
    expect(parsed[0].handlers[1].event).toBe('OnPressed');
    expect(parsed[0].shortname).toBe('X');
  });

  it('writes only the fields each mode reads, in the GFL layout', () => {
    const handlers = [
      newHandler({ type: 'button', hammerid: '10', event: undefined, mode: 1, message: false, ui: false }),
      // stale numbers the mode ignores are written as 0
      newHandler({ type: 'other', hammerid: '11', event: 'OnPass', mode: 1, cooldown: 45, maxuses: 3, message: false }),
      newHandler({ type: 'other', hammerid: '12', event: 'OnTrigger', mode: 2, cooldown: 60, maxuses: 9 }),
      newHandler({ type: 'button', hammerid: '13', event: 'OnPressed', mode: 3, cooldown: 10, maxuses: 2 }),
      // counters: no event, no maxuses (CS2Fixes forces OutValue and reads min / max)
      newHandler({ type: 'counterup', hammerid: '14', event: 'OnPass', mode: 3, cooldown: 4, maxuses: 5 }),
      newHandler({ type: 'counterdown', hammerid: '15', mode: 4, cooldown: 60 }),
      // a value: no cooldown, no maxuses, no message
      newHandler({ type: 'counterdown', hammerid: '16', mode: 5, cooldown: 30, maxuses: 2, message: true, offset: [0, -1980] }),
    ];
    const text = serializeEntWatchConfig({ items: [newItem({ name: 'X', hammerid: '1', transfer: true, handlers })] }, { comments: false });
    expect(JSON.parse(text)[0].handlers).toEqual([
      { type: 'button', hammerid: '10' },
      { hammerid: '11', event: 'OnPass', mode: 1, cooldown: 0, maxuses: 0, message: false, ui: true },
      { hammerid: '12', event: 'OnTrigger', mode: 2, cooldown: 60, maxuses: 0, message: true, ui: true },
      { type: 'button', hammerid: '13', event: 'OnPressed', mode: 3, cooldown: 10, maxuses: 2, message: true, ui: true },
      { type: 'counterup', hammerid: '14', mode: 3, cooldown: 4, message: true, ui: true },
      { type: 'counterdown', hammerid: '15', mode: 4, cooldown: 60, message: true, ui: true },
      { type: 'counterdown', hammerid: '16', mode: 5, offset: [0, -1980], ui: true },
    ]);
    // key order as GFL writes it
    expect(text).toContain('"hammerid": "12",\n                "event": "OnTrigger",\n                "mode": 2,\n                "cooldown": 60,\n                "maxuses": 0,\n                "message": true,\n                "ui": true\n');
    expect(text).toContain('"type": "counterdown",\n                "hammerid": "16",\n                "mode": 5,\n                "offset": [0, -1980],\n                "ui": true\n');
    expect(usesCooldown(handlers[1])).toBe(false);
    expect(usesMaxUses(handlers[4])).toBe(false);
    expect(effectiveHandler(handlers[6])).toMatchObject({ cooldown: 0, maxuses: 0, message: false });
  });

  it('writes triggers on one line when there are no comments, like GFL', () => {
    const item = newItem({ name: 'Nightingale', hammerid: '29345', transfer: false, color: 'silver', triggers: ['992'] });
    const text = serializeEntWatchConfig({ items: [item] }, { comments: false });
    expect(text).toContain('        "transfer": false,\n        "color": "silver",\n        "triggers": ["992"]\n    }');
    const commented = serializeEntWatchConfig({ items: [item] }, { describeHammerId: (h) => (h === '992' ? 'trigger_teleport tp' : undefined) });
    expect(commented).toContain('"992" // trigger_teleport tp');
  });
});

