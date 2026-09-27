import { describe, expect, it } from 'vitest';
import { newHandler, newItem, parseEntWatchConfig, serializeEntWatchConfig, stripJsonComments } from '../src/model/entwatch';

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
});
