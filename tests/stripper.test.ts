import { describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { stripperStrings } from '../src/ui/i18nStripper';
import { translate, type StringKey } from '../src/ui/i18n';
import { bufferByteSource } from '../src/formats/vpk';
import { loadMapFromVmaps, loadMapFromVpk } from '../src/model/loadMap';
import type { EntityConnection, MapEntity } from '../src/model/entity';
import {
  GLOBAL_LUMP,
  GLOBAL_MAP,
  exactValue,
  newAdd,
  newFilter,
  newModify,
  parseJsonc,
  parseStripperFile,
  serializeStripperConfig,
  serializeStripperFile,
  targetForEntity,
  targetsOfEntities,
  type StripperConfig,
} from '../src/model/stripper';
import { crc32, makeZip } from '../src/model/zip';
import { connectionMatches, simulateStripper } from '../src/model/stripperMatch';
import {
  availableStrategies,
  buildMatch,
  cloneForEntity,
  defaultStrategy,
  deleteKeyValue,
  editKeyValue,
  ensureEntityModify,
  filterForEntity,
  findEntityModify,
  ioSpecFor,
  modifyForEntity,
  replaceAction,
  revertKeyValue,
  rewriteOutput,
} from '../src/model/stripperBuild';

const conn = (output: string, target: string, input: string, delay = 0, param = '', timesToFire = -1): EntityConnection => ({
  output,
  target,
  input,
  param,
  delay,
  timesToFire,
  targetType: 7,
});

let nextId = 0;
function ent(classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, connections: EntityConnection[] = [], container = 'default_ents'): MapEntity {
  return {
    id: nextId++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections,
    source: { kind: 'vpk', file: `maps/ze_test/entities/${container}.vents_c`, container, scope: '', templated: false },
  };
}

const world = (): MapEntity[] => [
  ent('worldspawn', '', '1'),
  ent('func_door_rotating', 'door_a', '10', { speed: '100' }, [conn('OnFullyClosed', 'relay', 'Trigger'), conn('OnOpen', 'snd', 'PlaySound', 0.5), conn('OnFullyOpen', 'relay', 'Trigger')]),
  ent('func_door', 'door_b', '11', { speed: '50' }),
  ent('info_player_terrorist', '', '12', { origin: '0 0 0' }),
  ent('info_player_terrorist', '', '13', { origin: '64 0 0' }),
  ent('weapon_ak47', 'Rifle_1', '14'),
];

const sim = (config: StripperConfig, entities = world()) => simulateStripper(entities, config, 'ze_test');

describe('stripper file format', () => {
  it('parses the example from the StripperCS2 repository, duplicate keys and single objects included', () => {
    const text = `{
      "filter": [
        {
          // no terrorists >:(
          "classname": "info_player_terrorist"
        }
      ],
      "modify": [
        {
          "match": { "classname": "func_door_rotating", "io": [ { "outputname": "OnFullyClosed" } ] },
          "replace": { "targetname": "yippe", "io": { "outputname": "OnClose" } },
          "insert": { "renderamt": "100", "io": [ { "outputname": "OnFullyOpened", "inputname": "Lock", "targetname": "lockable_door" } ] },
          "delete": { "model": "models/bruh.mdl" }
        }
      ],
      "add": [ { "classname": "func_button", "origin": "100 10 500" } ],
      // Optional single object style, instead of using array
      "add": { "classname": "trigger_multiple", "origin": "500 80 1000" }
    }`;
    const { actions, warnings } = parseStripperFile(text, 'default_ents');
    expect(warnings).toEqual([]);
    expect(actions.map((a) => a.kind)).toEqual(['filter', 'modify', 'add', 'add']);
    const m = actions[1];
    if (m.kind !== 'modify') throw new Error('modify expected');
    expect(m.match).toEqual([{ key: 'classname', value: 'func_door_rotating' }]);
    expect(m.matchIo).toEqual([{ outputname: 'OnFullyClosed' }]);
    expect(m.replaceIo).toEqual({ outputname: 'OnClose' });
    expect(m.insertIo).toEqual([{ outputname: 'OnFullyOpened', inputname: 'Lock', targetname: 'lockable_door' }]);
    expect(m.delete).toEqual([{ key: 'model', value: 'models/bruh.mdl' }]);
  });

  it('writes valid JSON with comments only, without trailing commas, in plugin execution order', () => {
    const config: StripperConfig = {
      actions: [
        newModify({
          note: 'door_a',
          match: [{ key: 'classname', value: 'func_door_rotating' }],
          matchIo: [{ outputname: 'OnOpen', delay: 0.5 }],
          replace: [{ key: 'speed', value: '200' }],
          replaceIo: { delay: 2 },
          delete: [{ key: 'model', value: '/.*/' }],
          deleteIo: [{ outputname: 'OnFullyOpen' }],
          insert: [{ key: 'renderamt', value: '100' }],
          insertIo: [{ outputname: 'OnClose', targetname: 'x', inputname: 'Kill', timestofire: 1 }],
        }),
        newAdd({ keyvalues: [{ key: 'classname', value: 'logic_relay' }, { key: 'targetname', value: 'r' }], io: [{ outputname: 'OnTrigger', targetname: 'x', inputname: 'Kill' }] }),
        newFilter({ note: 'no t', match: [{ key: 'classname', value: 'info_player_terrorist' }] }),
      ],
    };
    const [file] = serializeStripperConfig(config, 'ze_test');
    expect(file.path).toBe('maps/ze_test/default_ents.jsonc');
    // comments are the only non-JSON in the file
    const { value, warnings } = parseJsonc(file.text);
    expect(warnings).toEqual([]);
    const stripped = file.text.replace(/^\s*\/\/.*$/gm, '');
    expect(() => JSON.parse(stripped)).not.toThrow();
    expect(Object.keys(JSON.parse(stripped))).toEqual(['filter', 'add', 'modify']);
    expect(file.text).toMatch(/\/\/ no t/);
    expect(value).toBeTruthy();
    // and reads back to the same actions
    const back = parseStripperFile(file.text, 'default_ents').actions;
    const strip = (a: unknown) => JSON.parse(JSON.stringify(a, (k, v) => (k === 'uid' || k === 'note' ? undefined : v)));
    expect(strip(back.find((a) => a.kind === 'modify'))).toEqual(strip(config.actions[0]));
    expect(strip(back.find((a) => a.kind === 'add'))).toEqual(strip(config.actions[1]));
  });

  it('keeps regex backslashes and braces intact through a round trip', () => {
    const regex = '/^ze_\\d{1,}_[a-z]+$/';
    const text = serializeStripperFile([newFilter({ match: [{ key: 'targetname', value: regex }] })]);
    const back = parseStripperFile(text, 'default_ents').actions[0];
    expect(back.kind === 'filter' && back.match[0].value).toBe(regex);
  });

  it('flags trailing commas and non-string key values, which the plugin cannot load', () => {
    const r = parseStripperFile('{ "filter": [ { "classname": "a", "skin": 3, }, ], }', 'default_ents');
    expect(r.warnings.some((w) => w.includes('trailing comma'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('not a string'))).toBe(true);
  });

  it('writes one file per target and the global files last', () => {
    const files = serializeStripperConfig(
      {
        actions: [
          newFilter({ target: GLOBAL_LUMP, match: [{ key: 'classname', value: 'a' }] }),
          newFilter({ target: 'prefabs/misc/foo/default_ents', match: [{ key: 'classname', value: 'b' }] }),
          newFilter({ target: GLOBAL_MAP, match: [{ key: 'classname', value: 'c' }] }),
          newFilter({ target: 'default_ents', match: [{ key: 'classname', value: 'd' }] }),
        ],
      },
      'ze_test',
    );
    expect(files.map((f) => f.path)).toEqual([
      'maps/ze_test/prefabs/misc/foo/default_ents.jsonc',
      'maps/ze_test/default_ents.jsonc',
      'global_lump.jsonc',
      'global_map.jsonc',
    ]);
  });

  it('turns text that looks like a regex into an exact anchored regex', () => {
    expect(exactValue('door_a')).toBe('door_a');
    expect(exactValue('/odd/')).toBe('/^\\/odd\\/$/');
  });
});

describe('lump targets', () => {
  it('maps the map world to a top level file and nested worlds to folders', () => {
    const main = ent('worldspawn', '', '1');
    expect(targetForEntity(main, 'ze_test')).toBe('default_ents');
    const tpl = ent('prop_physics', 'x', '2', {}, [], '001#entityLumpName');
    expect(targetForEntity(tpl, 'ze_test')).toBe('001#entitylumpname');
    const prefab = ent('prop_physics', 'x', '3');
    prefab.source.file = 'maps/prefabs/misc/end_of_match/entities/default_ents.vents_c';
    expect(targetForEntity(prefab, 'ze_test')).toBe('prefabs/misc/end_of_match/default_ents');
  });
});

describe('simulation (mirrors StripperCS2 actions.cpp)', () => {
  it('compares plain values exactly and regexes caselessly, unanchored', () => {
    const exact = sim({ actions: [newFilter({ match: [{ key: 'targetname', value: 'rifle_1' }] })] });
    expect([...exact.perAction.values()][0].matched).toBe(0);
    const re = sim({ actions: [newFilter({ match: [{ key: 'targetname', value: '/rifle/' }] })] });
    expect([...re.perAction.values()][0].matched).toBe(1);
    const anchored = sim({ actions: [newFilter({ match: [{ key: 'classname', value: '/^info_player_/' }] })] });
    expect([...anchored.perAction.values()][0].matched).toBe(2);
  });

  it('requires every key to exist on the entity', () => {
    const r = sim({ actions: [newFilter({ match: [{ key: 'classname', value: '/.*/' }, { key: 'origin', value: '0 0 0' }] })] });
    expect([...r.perAction.values()][0].matched).toBe(1);
  });

  it('matches outputs by any combination of fields and by delay', () => {
    const r1 = sim({ actions: [newFilter({ io: [{ outputname: 'OnOpen', delay: 0.5 }] })] });
    expect([...r1.perAction.values()][0].matched).toBe(1);
    const r2 = sim({ actions: [newFilter({ io: [{ outputname: 'OnOpen', delay: 1 }] })] });
    expect([...r2.perAction.values()][0].matched).toBe(0);
    const r3 = sim({ actions: [newFilter({ io: [{ targetname: 'relay' }, { outputname: 'OnOpen' }] })] });
    expect([...r3.perAction.values()][0].matched).toBe(1);
  });

  it('runs filter, then add, then modify, whatever the order in the config', () => {
    const modify = newModify({ match: [{ key: 'targetname', value: 'spawned' }], replace: [{ key: 'speed', value: '9' }] });
    const add = newAdd({ keyvalues: [{ key: 'classname', value: 'logic_relay' }, { key: 'targetname', value: 'spawned' }] });
    const filter = newFilter({ match: [{ key: 'targetname', value: 'spawned' }] });
    const r = sim({ actions: [modify, add, filter] });
    // the filter ran before the add, so it removed nothing; the modify then finds the added entity
    expect(r.perAction.get(filter.uid)!.matched).toBe(0);
    expect(r.perAction.get(modify.uid)!.matched).toBe(1);
    expect(r.perAction.get(modify.uid)!.hitAdded).toBe(1);
    expect(r.added).toBe(1);
  });

  it('records which loaded entities were removed or modified', () => {
    const entities = world();
    const filter = newFilter({ match: [{ key: 'classname', value: 'info_player_terrorist' }] });
    const modify = newModify({ match: [{ key: 'targetname', value: 'door_a' }], replace: [{ key: 'speed', value: '1' }] });
    const r = sim({ actions: [filter, modify] }, entities);
    expect(r.removed).toBe(2);
    expect(r.modified).toBe(1);
    expect(r.touched.get(entities[3].id)).toBe('filter');
    expect(r.touched.get(entities[1].id)).toBe('modify');
  });

  it('replaces only the outputs the match selected, appending the rewritten ones', () => {
    const entities = world();
    const m = newModify({
      match: [{ key: 'classname', value: 'func_door_rotating' }],
      matchIo: [{ outputname: 'OnFullyClosed' }, { outputname: 'OnOpen' }],
      replaceIo: { outputname: 'CustomOutputName' },
    });
    const r = sim({ actions: [m] }, entities);
    const outs = r.after.get(entities[1].id)!.connections.map((c) => `${c.output}>${c.target}.${c.input}@${c.delay}`);
    // OnFullyOpen was not matched and stays first; the matched two were rewritten and moved to the end
    expect(outs).toEqual(['OnFullyOpen>relay.Trigger@0', 'CustomOutputName>relay.Trigger@0', 'CustomOutputName>snd.PlaySound@0.5']);
  });

  it('replace io leaves unspecified fields as they were and needs a matching output', () => {
    const entities = world();
    const m = newModify({ match: [{ key: 'targetname', value: 'door_a' }], matchIo: [{ outputname: 'OnOpen' }], replaceIo: { delay: 3, inputname: 'Kill' } });
    const noMatchIo = newModify({ match: [{ key: 'targetname', value: 'door_b' }], replaceIo: { outputname: 'x' } });
    const r = sim({ actions: [m, noMatchIo] }, entities);
    const c = r.after.get(entities[1].id)!.connections.find((x) => x.input === 'Kill')!;
    expect(c).toMatchObject({ output: 'OnOpen', target: 'snd', input: 'Kill', delay: 3 });
    expect(r.after.get(entities[2].id)!.connections).toEqual([]);
  });

  it('delete only removes a key whose value matches, and outputs by pattern', () => {
    const entities = world();
    const keep = newModify({ match: [{ key: 'targetname', value: 'door_a' }], delete: [{ key: 'speed', value: '999' }] });
    const drop = newModify({ match: [{ key: 'targetname', value: 'door_b' }], delete: [{ key: 'speed', value: '/.*/' }] });
    const dropIo = newModify({ match: [{ key: 'targetname', value: 'door_a' }], deleteIo: [{ outputname: '/^OnFully/' }] });
    const r = sim({ actions: [keep, drop, dropIo] }, entities);
    expect(r.after.get(entities[1].id)!.props.speed).toBe('100');
    expect(r.after.get(entities[2].id)!.props.speed).toBeUndefined();
    expect(r.after.get(entities[1].id)!.connections.map((c) => c.output)).toEqual(['OnOpen']);
  });

  it('insert sets key values and appends outputs with Hammer defaults', () => {
    const entities = world();
    const m = newModify({ match: [{ key: 'targetname', value: 'door_b' }], insert: [{ key: 'renderamt', value: '100' }], insertIo: [{ outputname: 'OnOpen', targetname: 'x', inputname: 'Kill' }] });
    const r = sim({ actions: [m] }, entities);
    const e = r.after.get(entities[2].id)!;
    expect(e.props.renderamt).toBe('100');
    expect(e.connections).toEqual([{ output: 'OnOpen', target: 'x', input: 'Kill', param: '', delay: 0, timesToFire: -1, targetType: 7 }]);
  });

  it('lists created entities and drops filtered ones from the result', () => {
    const entities = world();
    const r = sim({ actions: [newFilter({ match: [{ key: 'targetname', value: 'door_b' }] }), newAdd({ keyvalues: [{ key: 'classname', value: 'logic_relay' }] })] }, entities);
    expect(r.after.has(entities[2].id)).toBe(false);
    expect(r.created).toHaveLength(1);
    expect(r.created[0].target).toBe('default_ents');
  });

  it('applies the lump file, then global_map on the main lump, then global_lump on every lump', () => {
    const entities = [...world(), ent('prop_physics', 'box', '20', {}, [], '001#entityLumpName')];
    const g = newFilter({ target: GLOBAL_LUMP, match: [{ key: 'classname', value: '/^(worldspawn|prop_physics)$/' }] });
    const gm = newFilter({ target: GLOBAL_MAP, match: [{ key: 'classname', value: '/func_door/' }] });
    const r = sim({ actions: [g, gm] }, entities);
    expect(r.perAction.get(gm.uid)!.matched).toBe(2); // func_door_rotating + func_door in default_ents only
    expect(r.perAction.get(g.uid)!.matched).toBe(2); // worldspawn + the box in its template lump
    expect(r.perAction.get(g.uid)!.lumpKnown).toBe(true);
  });

  it('reports regex errors and unknown lumps', () => {
    const bad = newFilter({ match: [{ key: 'classname', value: '/(unclosed/' }] });
    const stray = newFilter({ target: 'nope/default_ents', match: [{ key: 'classname', value: 'a' }] });
    const r = sim({ actions: [bad, stray] });
    expect(r.perAction.get(bad.uid)!.errors).toHaveLength(1);
    expect(r.perAction.get(stray.uid)!.lumpKnown).toBe(false);
  });
});

describe('building actions from entities', () => {
  it('matches by id with the class, falling back to name and origin', () => {
    const e = world()[1];
    expect(buildMatch(e, 'id')).toEqual([{ key: 'classname', value: 'func_door_rotating' }, { key: 'hammeruniqueid', value: '10' }]);
    expect(buildMatch(e, 'name')).toEqual([{ key: 'classname', value: 'func_door_rotating' }, { key: 'targetname', value: 'door_a' }]);
    const spawn = world()[3];
    expect(buildMatch(spawn, 'name')).toEqual([{ key: 'classname', value: 'info_player_terrorist' }, { key: 'origin', value: '0 0 0' }]);
    expect(availableStrategies(spawn)).toEqual(['id', 'origin', 'class']);
    expect(defaultStrategy(spawn)).toBe('id');
  });

  it('selects exactly the entity it was built from', () => {
    const entities = world();
    for (const e of entities) {
      for (const strategy of availableStrategies(e)) {
        if (strategy === 'class') continue;
        const f = filterForEntity(e, 'ze_test', strategy);
        const r = sim({ actions: [f] }, entities);
        expect(r.perAction.get(f.uid)!.samples.map((s) => s.id)).toContain(e.id);
      }
    }
    const f = filterForEntity(entities[3], 'ze_test', 'id');
    expect(sim({ actions: [f] }, entities).perAction.get(f.uid)!.matched).toBe(1);
  });

  it('describes an output with only the fields needed to tell it apart', () => {
    const e = ent('logic_relay', 'r', '30', {}, [
      conn('OnTrigger', 'a', 'Kill'),
      conn('OnTrigger', 'a', 'Kill', 5),
      conn('OnTrigger', 'b', 'Enable', 0, 'x'),
      conn('OnTrigger', 'c', 'Disable'),
    ]);
    expect(ioSpecFor(e, e.connections[3])).toEqual({ outputname: 'OnTrigger', targetname: 'c', inputname: 'Disable' });
    // two outputs differ only in delay, so the delay goes in (and the empty parameter, to tell them apart from "x")
    expect(ioSpecFor(e, e.connections[0])).toMatchObject({ targetname: 'a', delay: 0 });
    expect(ioSpecFor(e, e.connections[1])).toMatchObject({ targetname: 'a', delay: 5 });
    expect(ioSpecFor(e, e.connections[2])).toMatchObject({ targetname: 'b', overrideparam: 'x' });
    // and each description selects only its own output
    e.connections.forEach((c, i) => {
      const spec = ioSpecFor(e, c);
      const hits = e.connections.filter((o) => connectionMatches(o, spec));
      expect(hits, `output ${i}`).toEqual([c]);
    });
  });

  it('edits key values as replace or insert and deletes by current value', () => {
    const entities = world();
    const door = entities[1];
    let m = modifyForEntity(door, 'ze_test');
    m = editKeyValue(m, door, 'speed', '250');
    m = editKeyValue(m, door, 'renderamt', '100');
    m = editKeyValue(m, door, 'targetname', 'door_a'); // unchanged value: no edit
    m = deleteKeyValue(m, door, 'hammeruniqueid');
    expect(m.replace).toEqual([{ key: 'speed', value: '250' }]);
    expect(m.insert).toEqual([{ key: 'renderamt', value: '100' }]);
    expect(m.delete).toEqual([{ key: 'hammeruniqueid', value: '10' }]);
    m = revertKeyValue(m, 'speed');
    expect(m.replace).toEqual([]);
  });

  it('reuses one modify per entity and keeps output rewrites separate', () => {
    const entities = world();
    const door = entities[1];
    let config: StripperConfig = { actions: [] };
    const first = ensureEntityModify(config, door, 'ze_test');
    config = replaceAction(first.config, editKeyValue(first.action, door, 'speed', '1'));
    const second = ensureEntityModify(config, door, 'ze_test');
    expect(second.action.uid).toBe(first.action.uid);
    expect(config.actions).toHaveLength(1);
    const rewrite = rewriteOutput(door, door.connections[1], 'ze_test');
    rewrite.replaceIo = { delay: 4 };
    config = { actions: [...config.actions, rewrite] };
    expect(findEntityModify(config, door, 'ze_test')!.uid).toBe(first.action.uid);
    const r = sim(config, entities);
    expect(r.perAction.get(rewrite.uid)!.matched).toBe(1);
    const after = r.after.get(door.id)!;
    expect(after.props.speed).toBe('1');
    expect(after.connections.find((c) => c.output === 'OnOpen')!.delay).toBe(4);
  });

  it('clones an entity as an add without its hammer id', () => {
    const door = world()[1];
    const add = cloneForEntity(door, 'ze_test');
    expect(add.keyvalues[0]).toEqual({ key: 'classname', value: 'func_door_rotating' });
    expect(add.keyvalues.some((kv) => kv.key === 'hammeruniqueid')).toBe(false);
    expect(add.io).toHaveLength(3);
    expect(add.io[1]).toEqual({ outputname: 'OnOpen', targetname: 'snd', inputname: 'PlaySound', delay: 0.5 });
  });
});

describe('zip writer', () => {
  it('writes a readable stored archive', () => {
    const enc = new TextEncoder();
    const files = [
      { path: 'addons/StripperCS2/maps/ze_test/default_ents.jsonc', data: enc.encode('{ "filter": [] }\n') },
      { path: 'addons/StripperCS2/global_lump.jsonc', data: enc.encode('{}\n') },
    ];
    const zip = makeZip(files, new Date(2026, 0, 2, 3, 4, 6));
    const dv = new DataView(zip.buffer);
    // end of central directory
    const eocd = zip.length - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 10, true)).toBe(2);
    // walk the central directory and check names, sizes and CRCs against the local data
    let pos = dv.getUint32(eocd + 16, true);
    for (const f of files) {
      expect(dv.getUint32(pos, true)).toBe(0x02014b50);
      const crc = dv.getUint32(pos + 16, true);
      const size = dv.getUint32(pos + 24, true);
      const nameLen = dv.getUint16(pos + 28, true);
      const localPos = dv.getUint32(pos + 42, true);
      expect(new TextDecoder().decode(zip.subarray(pos + 46, pos + 46 + nameLen))).toBe(f.path);
      expect(size).toBe(f.data.length);
      expect(crc).toBe(crc32(f.data));
      const localNameLen = dv.getUint16(localPos + 26, true);
      const dataStart = localPos + 30 + localNameLen;
      expect(Array.from(zip.subarray(dataStart, dataStart + size))).toEqual(Array.from(f.data));
      pos += 46 + nameLen;
    }
    // well known CRC-32 check value
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('against a compiled map (point_template_test.vpk)', () => {
  it('maps lumps to config files and selects exactly each entity through a written file', async () => {
    const map = await loadMapFromVpk(bufferByteSource(fixture('point_template_test.vpk'), 'point_template_test.vpk'), new Map());
    expect(map.mapName).toBe('point_template_test');
    const targets = targetsOfEntities(map.entities, map.mapName);
    expect(targets[0]).toBe('default_ents');
    expect(targets).toContain('9#entitylumpname');

    for (const e of map.entities) {
      for (const strategy of availableStrategies(e).filter((s) => s !== 'class')) {
        const written = serializeStripperConfig({ actions: [filterForEntity(e, map.mapName, strategy)] }, map.mapName);
        expect(written).toHaveLength(1);
        expect(written[0].path).toBe(`maps/point_template_test/${targetForEntity(e, map.mapName)}.jsonc`);
        // read the file back as the plugin would and run it over the map
        const parsed = parseStripperFile(written[0].text, targetForEntity(e, map.mapName)).actions;
        const r = simulateStripper(map.entities, { actions: parsed }, map.mapName);
        const hit = r.perAction.get(parsed[0].uid)!;
        expect(hit.samples.map((x) => x.id), `${e.classname} ${e.hammerId} by ${strategy}`).toContain(e.id);
        if (strategy === 'id') expect(hit.matched).toBe(1);
      }
    }
  });

  it('a modify written for one entity changes only that entity', async () => {
    const map = await loadMapFromVpk(bufferByteSource(fixture('point_template_test.vpk'), 'point_template_test.vpk'), new Map());
    const target = map.entities.find((e) => e.targetname)!;
    expect(target).toBeDefined();
    let config: StripperConfig = { actions: [] };
    const ensured = ensureEntityModify(config, target, map.mapName);
    config = replaceAction(ensured.config, editKeyValue(ensured.action, target, 'targetname', 'renamed_by_stripper'));
    const r = simulateStripper(map.entities, config, map.mapName);
    expect(r.modified).toBe(1);
    expect(r.after.get(target.id)!.props.targetname).toBe('renamed_by_stripper');
    for (const e of map.entities) if (e.id !== target.id) expect(r.after.get(e.id)!.props.targetname).toBe(e.props.targetname);
  });
});

describe('simulation leaves the loaded map alone', () => {
  it('copies an entity before changing it', () => {
    const entities = world();
    const before = JSON.stringify(entities);
    const r = sim(
      {
        actions: [
          newModify({ match: [{ key: 'targetname', value: 'door_a' }], replace: [{ key: 'speed', value: '1' }], delete: [{ key: 'hammeruniqueid', value: '/.*/' }], deleteIo: [{ outputname: 'OnOpen' }], insertIo: [{ outputname: 'x' }] }),
          newFilter({ match: [{ key: 'targetname', value: 'door_b' }] }),
        ],
      },
      entities,
    );
    expect(r.after.get(entities[1].id)!.props.speed).toBe('1');
    expect(JSON.stringify(entities)).toBe(before);
    // an untouched entity is the loaded one itself, which is what keeps large maps cheap
    expect(r.after.get(entities[3].id)!.props).toBe(entities[3].props);
  });

  it('accepts maps whose keys are not lowercased', () => {
    const e = ent('func_door', 'Door_X', '40', { Speed: '5' });
    const m = newModify({ match: [{ key: 'speed', value: '5' }], replace: [{ key: 'SPEED', value: '6' }] });
    const r = sim({ actions: [m] }, [e]);
    expect(r.perAction.get(m.uid)!.matched).toBe(1);
    expect(r.after.get(e.id)!.props.speed).toBe('6');
    expect(e.props.Speed).toBe('5');
  });
});

describe('stripper strings', () => {
  it('has every key in both languages', () => {
    const ja = Object.keys(stripperStrings.ja).sort();
    const en = Object.keys(stripperStrings.en).sort();
    expect(en).toEqual(ja);
    for (const k of ja) {
      expect(translate('ja', k as StringKey)).not.toBe(k);
      expect(translate('en', k as StringKey)).not.toBe(k);
    }
  });
});

describe('against a Hammer map (cs2_map.vmap)', () => {
  it('puts everything in the main lump and selects each entity by id', () => {
    const map = loadMapFromVmaps([{ name: 'cs2_map.vmap', bytes: fixture('cs2_map.vmap') }]);
    expect(map.entities.length).toBeGreaterThan(0);
    expect(targetsOfEntities(map.entities, map.mapName)).toEqual(['default_ents']);
    for (const e of map.entities) {
      const f = filterForEntity(e, map.mapName, 'id');
      const r = simulateStripper(map.entities, { actions: [f] }, map.mapName);
      expect(r.perAction.get(f.uid)!.matched, `${e.classname} #${e.hammerId}`).toBe(1);
    }
  });
});
