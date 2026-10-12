import { describe, expect, it } from 'vitest';
import type { MapEntity } from '../src/model/entity';
import { EntityGraph } from '../src/model/graph';
import { applyCandidate, findCandidates } from '../src/model/stripperCandidates';
import { convertLegacyStripper } from '../src/model/stripperLegacy';
import { simulateStripper } from '../src/model/stripperMatch';

let nextId = 0;
function ent(classname: string, targetname: string, hammerId: string, props: Record<string, string> = {}, container = 'default_ents'): MapEntity {
  return {
    id: nextId++,
    hammerId,
    classname,
    targetname,
    props: { classname, targetname, hammeruniqueid: hammerId, ...props },
    connections: [],
    source: { kind: 'vpk', file: `maps/ze_test/entities/${container}.vents_c`, container, scope: '', templated: container !== 'default_ents' },
  };
}

// a CS2 port: [PR#] names, new ids, "%f" origins, a renamed class, an entity moved into a template lump
const world = (): MapEntity[] => [
  ent('worldspawn', '', '1'),
  ent('func_movelinear', '[PR#]gandalf_door', '20', { origin: '13664.000000 2063.739990 6375.209961' }),
  ent('env_hudhint', '[PR#]HudHintLvMsg_1', '30'),
  ent('func_physbox', '[PR#]ph_troll_hp', '40', {}, '1440#entityLumpName'),
  ent('logic_relay', '[PR#]Auto', '50'),
  ent('logic_relay', '[PR#]Auto', '51'),
  ent('trigger_hurt', '[PR#]item_goliath_4', '60'),
  ent('func_physbox', '', '70', { origin: '6572.750000 3188.129883 -4551.669922' }),
];

const CFG = `
modify:
{
	match:
	{
		"targetname" "gandalf_door"
		"origin" "13664 2063.74 6375.21"
	}
	replace:
	{
		"speed" "200"
	}
}
modify:
{
	match:
	{
		"classname" "env_message"
		"targetname" "HudHintLvMsg_1"
	}
	replace:
	{
		"message" "hi"
	}
}
filter:
{
	"targetname" "ph_troll_hp"
	"classname" "func_physbox_multiplayer"
	"hammerid" "1349"
}
modify:
{
	match:
	{
		"targetname" "Auto"
		"classname" "logic_relay"
		"hammerid" "4042905"
	}
	insert:
	{
		"OnTrigger" "x,Kill,,0,-1"
	}
}
modify:
{
	match:
	{
		"targetname" "item_goliath_4"
		"classname" "trigger_push"
	}
	replace:
	{
		"pushdir" "0 0 0"
	}
}
modify:
{
	match:
	{
		"origin" "6572.75 3188.13 -4551.67"
		"classname" "func_physbox"
	}
	replace:
	{
		"health" "1"
	}
}
`;

describe('candidates for a config ported to a CS2 map', () => {
  const entities = world();
  const graph = new EntityGraph(entities);
  const actions = convertLegacyStripper(CFG, 'default_ents', { prefabNames: true }).actions;
  const [door, hint, troll, auto, goliath, physbox] = actions;

  it('starts with actions that select nothing', () => {
    const sim = simulateStripper(entities, { actions }, 'ze_test');
    expect(actions.map((a) => sim.perAction.get(a.uid)!.matched)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('is sure of a unique name at the same place, a renamed class, and a lump the entity moved to', () => {
    expect(findCandidates(door, graph).sure?.entity.hammerId).toBe('20');
    expect(findCandidates(hint, graph).sure?.entity.classname).toBe('env_hudhint');
    const t = findCandidates(troll, graph).sure;
    expect(t?.entity.hammerId).toBe('40');
    expect(t?.signals).toContainEqual({ kind: 'class', same: false, known: true, from: 'func_physbox_multiplayer', to: 'func_physbox' });
    // an unnamed entity at the very spot of its class
    expect(findCandidates(physbox, graph).sure?.entity.hammerId).toBe('70');
  });

  it('only lists, without being sure, two entities of one name or an unknown class change', () => {
    const a = findCandidates(auto, graph);
    expect(a.candidates.map((c) => c.entity.hammerId).sort()).toEqual(['50', '51']);
    expect(a.sure).toBeNull();
    expect(a.candidates[0].strategy).toBe('id');
    const g = findCandidates(goliath, graph);
    expect(g.candidates[0].entity.hammerId).toBe('60');
    expect(g.sure).toBeNull();
  });

  it('rewrites the match and the lump, keeping the old match in the note', () => {
    const t = findCandidates(troll, graph).sure!;
    if (troll.kind === 'add') throw new Error('kind');
    const fixed = applyCandidate(troll, t, 'ze_test');
    expect(fixed.match).toEqual([
      { key: 'classname', value: 'func_physbox' },
      { key: 'targetname', value: '[PR#]ph_troll_hp' },
    ]);
    expect(fixed.target).toBe('1440#entitylumpname');
    expect(fixed.note).toMatch(/was .*hammeruniqueid=1349/);
    expect(fixed.note).toMatch(/func_physbox_multiplayer → func_physbox/);

    const all = actions.map((a) => {
      if (a.kind === 'add') return a;
      const sure = findCandidates(a, graph).sure;
      return sure ? applyCandidate(a, sure, 'ze_test') : a;
    });
    const sim = simulateStripper(entities, { actions: all }, 'ze_test');
    expect(all.map((a) => sim.perAction.get(a.uid)!.matched)).toEqual([1, 1, 1, 0, 0, 1]);
  });
});
