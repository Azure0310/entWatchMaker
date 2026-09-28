import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entitiesFromDump } from '../src/model/dump';
import { EntityGraph } from '../src/model/graph';
import { suggestItemForWeapon } from '../src/model/suggest';
import type { ItemConfig } from '../src/model/entwatch';

/**
 * Scores the suggestions against real workshop maps. Point DIAG_DUMP_DIR at a folder holding
 * skyrim.entities.json / minas.entities.json (written by `npm run dump:entities`); the
 * expectations are the handlers and triggers of the GFL configs for ze_tesv_skyrim_p and
 * ze_lotr_minas_tirith_p. Skipped when the dumps are not there.
 */

interface Expect {
  name: string;
  weapon: string;
  handlers?: string[];
  triggers?: string[];
  /** Known misses that are tolerated (key combos, second-stage counters). */
  optionalHandlers?: string[];
  notTriggers?: string[];
  cooldown?: Record<string, number>;
  event?: Record<string, string>;
}

const SKYRIM: Expect[] = [
  { name: 'Nightingale', weapon: '29345', handlers: ['29347'], triggers: ['992'], cooldown: { 29347: 4 }, event: { 29347: 'OnTrigger' } },
  { name: 'Healmage', weapon: '29494', handlers: ['29504', '29506'], triggers: ['984'], cooldown: { 29504: 8, 29506: 40 } },
  { name: 'Dovahkiin', weapon: '29435', handlers: ['29437', '29451', '29450', '29438'], triggers: ['982'], cooldown: { 29451: 60, 29450: 70, 29438: 80 } },
  { name: 'Archmage', weapon: '29372', handlers: ['29383', '29378'], triggers: ['1020'], cooldown: { 29383: 9, 29378: 60 } },
  { name: 'Daedric', weapon: '29402', handlers: ['29403', '29412'], triggers: ['979'], cooldown: { 29412: 60 } },
  { name: 'Freeze Staff', weapon: '225', handlers: ['703'] },
  { name: 'Heal Staff', weapon: '401', handlers: ['402'] },
  { name: 'Elder Scroll', weapon: '723', handlers: ['1487'] },
  { name: 'Zombie Wolf', weapon: '29224', handlers: ['29229', '29237'], triggers: ['987'], cooldown: { 29229: 2, 29237: 25 } },
  { name: 'Zombie Troll', weapon: '29179', handlers: ['29184', '29185'], triggers: ['990'] },
  { name: 'Zombie Giant', weapon: '29267', handlers: ['29270', '29271'], triggers: ['994'], notTriggers: ['987', '990'], cooldown: { 29270: 5, 29271: 15 } },
  { name: 'Zombie Dragonpriest', weapon: '29313', handlers: ['29317'], triggers: ['1088'] },
];

const MINAS: Expect[] = [
  { name: 'Flag', weapon: '901', triggers: ['7779'] },
  { name: 'Armor', weapon: '145', triggers: ['7781'] },
  { name: 'Ammo Barrel', weapon: '351', handlers: ['357'], triggers: ['7783'], cooldown: { 357: 60 }, event: { 357: 'OnFalse' } },
  { name: 'Oil Barrel', weapon: '865', optionalHandlers: ['868', '866'], triggers: ['7870'] },
  { name: 'Horse', weapon: '675', triggers: ['7785'], notTriggers: ['7781', '7787'] },
  { name: 'Gandalf', weapon: '683', handlers: ['686'], optionalHandlers: ['687'], triggers: ['7787'], notTriggers: ['7781', '7785'], cooldown: { 686: 75 }, event: { 686: 'OnEqualTo' } },
  { name: 'White Knight', weapon: '695', handlers: ['713'], optionalHandlers: ['699'], triggers: ['7789'] },
  { name: 'Zombie Totem Pole', weapon: '900', triggers: ['7862'] },
  { name: 'Zombie TNT Barrel', weapon: '1117', handlers: ['1115'], triggers: ['7864'], cooldown: { 1115: 20 }, event: { 1115: 'OnTrue' } },
  { name: 'Zombie Ladder', weapon: '157', triggers: ['7866'] },
  { name: 'Zombie Troll', weapon: '348', triggers: ['7797'] },
  { name: 'Zombie Balrog', weapon: '716', handlers: ['720', '718'], triggers: ['7799'], event: { 720: 'OnUser1', 718: 'OnUser1' } },
  { name: 'Zombie Nazgul', weapon: '395', triggers: ['7755', '7753'] },
  { name: 'Barricade - Basket', weapon: '756', handlers: ['225'] },
];

const dir = process.env.DIAG_DUMP_DIR ?? '';
const have = (f: string) => dir.length > 0 && existsSync(join(dir, f));

function load(file: string): EntityGraph {
  const dump = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  return new EntityGraph(entitiesFromDump(dump));
}

function check(graph: EntityGraph, expectations: Expect[]): string[] {
  const rows: string[] = [];
  const problems: string[] = [];
  for (const x of expectations) {
    const w = graph.byHammerId.get(x.weapon)?.[0];
    expect(w, `weapon ${x.weapon} (${x.name}) in dump`).toBeDefined();
    const { item } = suggestItemForWeapon(w!, graph);
    const h = item.handlers.map((k) => k.hammerid);
    const t = item.triggers;
    const wanted = x.handlers ?? [];
    const missedH = wanted.filter((id) => !h.includes(id));
    const extraH = h.filter((id) => !wanted.includes(id) && !(x.optionalHandlers ?? []).includes(id));
    const missedT = (x.triggers ?? []).filter((id) => !t.includes(id));
    const extraT = t.filter((id) => !(x.triggers ?? []).includes(id));
    rows.push(`${x.name.padEnd(20)} handlers ${wanted.length}/${wanted.length - missedH.length} extra [${extraH.join(' ')}]  triggers ${(x.triggers ?? []).length}/${(x.triggers ?? []).length - missedT.length} extra [${extraT.join(' ')}]`);
    if (missedH.length > 0) problems.push(`${x.name}: missed handlers ${missedH.join(', ')} (got ${h.join(', ') || 'none'})`);
    if (missedT.length > 0) problems.push(`${x.name}: missed triggers ${missedT.join(', ')} (got ${t.join(', ') || 'none'})`);
    for (const id of x.notTriggers ?? []) if (t.includes(id)) problems.push(`${x.name}: trigger ${id} belongs to another item`);
    for (const [id, cd] of Object.entries(x.cooldown ?? {})) {
      const hh = item.handlers.find((k) => k.hammerid === id);
      if (hh && hh.cooldown !== cd) problems.push(`${x.name}: handler ${id} cooldown ${hh.cooldown} (config ${cd})`);
    }
    for (const [id, ev] of Object.entries(x.event ?? {})) {
      const hh = item.handlers.find((k) => k.hammerid === id);
      if (hh && hh.event !== ev) problems.push(`${x.name}: handler ${id} event ${hh.event} (config ${ev})`);
    }
    if (extraH.length > 3) problems.push(`${x.name}: ${extraH.length} extra handlers ${extraH.join(', ')}`);
  }
  console.log(rows.join('\n'));
  return problems;
}

describe.skipIf(!have('skyrim.entities.json'))('ze_tesv_skyrim_p (DIAG_DUMP_DIR)', () => {
  it('reproduces the GFL config', () => {
    const problems = check(load('skyrim.entities.json'), SKYRIM);
    expect(problems).toEqual([]);
  });
});

describe.skipIf(!have('minas.entities.json'))('ze_lotr_minas_tirith_p (DIAG_DUMP_DIR)', () => {
  it('reproduces the GFL config', () => {
    const problems = check(load('minas.entities.json'), MINAS);
    expect(problems).toEqual([]);
  });
});

export type { ItemConfig };
