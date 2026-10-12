import { describe, expect, it } from 'vitest';
import { parseJsonc, serializeStripperFile } from '../src/model/stripper';
import { convertLegacyStripper, isLegacyStripperText } from '../src/model/stripperLegacy';

const CFG = `; ze_example stripper
filter:
{
"classname" "weapon_knife"
"hammerid" "1234"
}
remove:
{
"targetname" "/^old_.*$/"
}

add:
{
	"classname" "logic_auto"
	"origin" "0 0 0"
	"OnMapSpawn" "relay,Trigger,,5,-1"
	"OnMapSpawn" "console,Command,say hi,0,1"
}

modify:
{
	match:
	{
	"targetname" "door1"
	"OnFullyOpen" "door1_relay,Trigger,,0,-1"
	}
	replace:
	{
	"speed" "200"
	"OnFullyOpen" "door2_relay,Trigger,,1,-1"
	}
	delete:
	{
	"OnStartTouch" "/.*/"
	"model" "models/props/crate.mdl"
	}
	insert:
	{
	"OnClose" "!self,Kill,,0,1"
	}
}
`;

describe('CS:GO Stripper:Source conversion', () => {
  it('tells the old .cfg format from StripperCS2 jsonc', () => {
    expect(isLegacyStripperText(CFG)).toBe(true);
    expect(isLegacyStripperText('{ "filter": [ { "classname": "x" } ] }')).toBe(false);
    expect(isLegacyStripperText('// note\n{\n  "add": []\n}')).toBe(false);
  });

  it('converts filter / remove / add / modify with outputs split into io fields', () => {
    const { actions, warnings } = convertLegacyStripper(CFG, 'default_ents');
    expect(actions.map((a) => a.kind)).toEqual(['filter', 'filter', 'add', 'modify']);

    const [f1, f2, add, mod] = actions;
    if (f1.kind !== 'filter' || f2.kind !== 'filter' || add.kind !== 'add' || mod.kind !== 'modify') throw new Error('kinds');
    expect(f1.match).toEqual([
      { key: 'classname', value: 'weapon_knife' },
      { key: 'hammeruniqueid', value: '1234' },
    ]);
    expect(f1.note).toMatch(/hammeruniqueid/);
    expect(f2.match).toEqual([{ key: 'targetname', value: '/^old_.*$/' }]);

    expect(add.keyvalues).toEqual([
      { key: 'classname', value: 'logic_auto' },
      { key: 'origin', value: '0 0 0' },
    ]);
    expect(add.io).toEqual([
      { outputname: 'OnMapSpawn', targetname: 'relay', inputname: 'Trigger', delay: 5 },
      { outputname: 'OnMapSpawn', targetname: 'console', inputname: 'Command', overrideparam: 'say hi', timestofire: 1 },
    ]);

    expect(mod.match).toEqual([{ key: 'targetname', value: 'door1' }]);
    expect(mod.matchIo).toEqual([{ outputname: 'OnFullyOpen', targetname: 'door1_relay', inputname: 'Trigger', overrideparam: '', delay: 0, timestofire: -1 }]);
    expect(mod.replace).toEqual([{ key: 'speed', value: '200' }]);
    expect(mod.replaceIo).toEqual({ targetname: 'door2_relay', inputname: 'Trigger', delay: 1 });
    expect(mod.deleteIo).toEqual([{ outputname: 'OnStartTouch' }]);
    expect(mod.delete).toEqual([{ key: 'model', value: 'models/props/crate.vmdl' }]);
    expect(mod.insertIo).toEqual([{ outputname: 'OnClose', targetname: '!self', inputname: 'Kill', timestofire: 1 }]);
    expect(warnings.some((w) => w.startsWith('modify[0]') && w.includes('.vmdl'))).toBe(true);
  });

  it('writes a file StripperCS2 can load', () => {
    const { actions } = convertLegacyStripper(CFG);
    const text = serializeStripperFile(actions);
    expect(parseJsonc(text).warnings).toEqual([]);
    expect(() => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''))).not.toThrow();
  });

  it('accepts ESC-separated outputs, regex outputs split into fields, and braces on the header line', () => {
    const { actions, warnings } = convertLegacyStripper(
      'modify: {\n match: { "classname" "func_button" "OnPressed" "/relay_.*,Trigger,.*,.*,.*/" }\n delete: { "OnPressed" "/relay_.*,Trigger,.*,.*,.*/" }\n insert: { "OnPressed" "a\x1bAddOutput\x1bOnUser1 b:Kill::0:-1\x1b0\x1b-1" } }',
    );
    const m = actions[0];
    if (m.kind !== 'modify') throw new Error('modify');
    expect(m.matchIo).toEqual([{ outputname: 'OnPressed', targetname: '/^(?:relay_.*)$/', inputname: '/^(?:Trigger)$/' }]);
    expect(m.insertIo).toEqual([{ outputname: 'OnPressed', targetname: 'a', inputname: 'AddOutput', overrideparam: 'OnUser1 b:Kill::0:-1' }]);
    expect(warnings.some((w) => w.includes('AddOutput'))).toBe(true);
  });

  it('reads what Stripper:Source let through: connections blocks, text after "{", match: inside a filter', () => {
    const { actions, warnings } = convertLegacyStripper(
      [
        'add:\n{\n"classname" "trigger_once"\n"targetname" "t1"\nconnections\n{stage_2_door\n"OnStartTouch" "door,Trigger,,0,-1"\n}\n}',
        'filter:\n{\nmatch:\n{\n"targetname" "SpawnPush"\n"classname" "trigger_push"\n}\n\n}',
      ].join('\n'),
    );
    const [add, filter] = actions;
    if (add.kind !== 'add' || filter.kind !== 'filter') throw new Error('kinds');
    expect(add.keyvalues).toEqual([
      { key: 'classname', value: 'trigger_once' },
      { key: 'targetname', value: 't1' },
    ]);
    expect(add.io).toEqual([{ outputname: 'OnStartTouch', targetname: 'door', inputname: 'Trigger' }]);
    expect(filter.match).toEqual([
      { key: 'targetname', value: 'SpawnPush' },
      { key: 'classname', value: 'trigger_push' },
    ]);
    expect(warnings.some((w) => w.includes('"stage_2_door"'))).toBe(true);
    expect(warnings.some((w) => w.includes('"match:"'))).toBe(true);
  });

  it('reports where a broken file goes wrong', () => {
    expect(() => convertLegacyStripper('filter:\n{\n"classname" "a"\n')).toThrow(/Missing "}"/);
    expect(() => convertLegacyStripper('{ "classname" "a" }')).toThrow(/before any/);
  });
});
