import { describe, expect, it } from 'vitest';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import { parseStripperFile, serializeStripperFile, type StripperConfig } from '../src/model/stripper';
import { simulateStripper } from '../src/model/stripperMatch';
import { editKeyValue, ensureEntityModify, replaceAction } from '../src/model/stripperBuild';
import {
  applyGroupTranslation,
  applyTranslation,
  applyTranslationTable,
  detectTextLang,
  exportTranslationTable,
  groupTexts,
  parseTranslationTable,
  scanTexts,
  translationOf,
} from '../src/model/stripperText';

const conn = (output: string, target: string, input: string, param = ''): EntityConnection => ({ output, target, input, param, delay: 0, timesToFire: -1, targetType: 7 });

let nextId = 0;
function ent(classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, connections: EntityConnection[] = []): MapEntity {
  return {
    id: nextId++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections,
    source: { kind: 'vpk', file: 'maps/ze_test/entities/default_ents.vents_c', container: 'default_ents', scope: '', templated: false },
  };
}

const MAP = 'ze_test';
const empty: StripperConfig = { actions: [] };

function fixtureMap() {
  const text = ent('game_text', 'txt_boss', '10', { message: '僵尸来了！快跑', color: '255 0 0' });
  const world = ent('point_worldtext', '中文名字', '11', { message: 'Hello' });
  const relay = ent('logic_relay', 'relay_a', '12', {}, [
    conn('OnTrigger', 'cmd', 'Command', 'say ***僵尸来了！快跑***'),
    conn('OnTrigger', 'cmd', 'Command', 'say ***门将在10秒后打开***'),
    conn('OnTrigger', 'door', 'Open'),
  ]);
  const relay2 = ent('logic_relay', 'relay_b', '13', {}, [conn('OnTrigger', 'cmd', 'Command', 'say ***门将在10秒后打开***')]);
  const jp = ent('game_text', 'txt_jp', '14', { message: 'ゾンビが来た' });
  return [text, world, relay, relay2, jp];
}

describe('detectTextLang', () => {
  it('tells Chinese from Japanese and Korean', () => {
    expect(detectTextLang('say ***僵尸来了***')).toBe('zh');
    expect(detectTextLang('門が開きます')).toBe('ja');
    expect(detectTextLang('좀비가 온다')).toBe('ko');
    expect(detectTextLang('say ***GO***')).toBeNull();
    expect(detectTextLang('，。')).toBeNull();
  });
});

describe('scanTexts', () => {
  it('finds key values and output parameters, skipping names', () => {
    const hits = scanTexts(fixtureMap());
    const zh = hits.filter((h) => h.lang === 'zh');
    expect(zh.map((h) => (h.kind === 'key' ? `${h.entity.hammerId}:${h.key}` : `${h.entity.hammerId}:io`))).toEqual(['10:message', '12:io', '12:io', '13:io']);
    expect(hits.some((h) => h.lang === 'ja')).toBe(true);
  });

  it('groups identical texts', () => {
    const groups = groupTexts(scanTexts(fixtureMap()));
    const door = groups.find((g) => g.text === 'say ***门将在10秒后打开***');
    expect(door?.hits.length).toBe(2);
  });
});

describe('translations as actions', () => {
  it('translates a key value with a replace and an output with replace.io', () => {
    const entities = fixtureMap();
    const groups = groupTexts(scanTexts(entities));
    let c = empty;
    for (const g of groups.filter((x) => x.lang === 'zh')) c = applyGroupTranslation(c, g, `EN(${g.text})`, MAP);

    const sim = simulateStripper(entities, c, MAP);
    expect(sim.after.get(entities[0].id)?.props.message).toBe('EN(僵尸来了！快跑)');
    expect(sim.after.get(entities[2].id)?.connections.map((x) => x.param).sort()).toEqual(['', 'EN(say ***僵尸来了！快跑***)', 'EN(say ***门将在10秒后打开***)']);
    expect(sim.after.get(entities[3].id)?.connections[0].param).toBe('EN(say ***门将在10秒后打开***)');
    // the untouched entity keeps its text
    expect(sim.after.get(entities[4].id)?.props.message).toBe('ゾンビが来た');

    for (const g of groups.filter((x) => x.lang === 'zh')) for (const h of g.hits) expect(translationOf(c, h, MAP)).toBe(`EN(${g.text})`);

    // the written file reads back to the same actions
    const text = serializeStripperFile(c.actions, { comments: true });
    const back = parseStripperFile(text, 'default_ents');
    expect(back.warnings).toEqual([]);
    expect(simulateStripper(entities, { actions: back.actions }, MAP).after.get(entities[3].id)?.connections[0].param).toBe('EN(say ***门将在10秒后打开***)');
  });

  it('updates and reverts a translation without duplicating actions', () => {
    const entities = fixtureMap();
    const hit = scanTexts(entities).find((h) => h.kind === 'io')!;
    let c = applyTranslation(empty, hit, 'say A', MAP);
    c = applyTranslation(c, hit, 'say B', MAP);
    expect(c.actions.length).toBe(1);
    expect(translationOf(c, hit, MAP)).toBe('say B');
    c = applyTranslation(c, hit, '', MAP);
    expect(c.actions.length).toBe(0);
  });

  it('keeps other edits of the entity when a key translation is reverted', () => {
    const entities = fixtureMap();
    const e = entities[0];
    const ensured = ensureEntityModify(empty, e, MAP);
    let c = replaceAction(ensured.config, editKeyValue(ensured.action, e, 'color', '0 255 0'));
    const hit = scanTexts(entities).find((h) => h.kind === 'key' && h.entity === e)!;
    c = applyTranslation(c, hit, 'Zombies!', MAP);
    expect(c.actions.length).toBe(1);
    c = applyTranslation(c, hit, '', MAP);
    expect(c.actions.length).toBe(1);
    expect(c.actions[0].kind === 'modify' && c.actions[0].replace).toEqual([{ key: 'color', value: '0 255 0' }]);
  });
});

describe('translation table', () => {
  it('exports, parses JSON and TSV, and applies', () => {
    const entities = fixtureMap();
    const groups = groupTexts(scanTexts(entities)).filter((g) => g.lang === 'zh');
    const table = JSON.parse(exportTranslationTable(groups, empty, MAP)) as Record<string, string>;
    expect(Object.values(table).every((v) => v === '')).toBe(true);
    table['say ***门将在10秒后打开***'] = 'say ***Door opens in 10s***';

    const parsed = parseTranslationTable(JSON.stringify(table));
    expect(parsed.size).toBe(1);
    const { config, applied } = applyTranslationTable(empty, groups, parsed, MAP);
    expect(applied).toBe(1);
    expect(config.actions.length).toBe(2);

    const tsv = parseTranslationTable('僵尸来了！快跑\tZombies are coming! Run\nno tab line\n');
    expect(tsv.get('僵尸来了！快跑')).toBe('Zombies are coming! Run');
    expect(tsv.size).toBe(1);
  });
});
