import { describe, expect, it } from 'vitest';
import { buildDemoMap } from '../src/model/demo';
import { EntityGraph, buildRelationTree } from '../src/model/graph';
import { suggestItemForWeapon, suggestItemName } from '../src/model/suggest';
import { validateConfig } from '../src/model/validate';
import { serializeEntWatchConfig } from '../src/model/entwatch';
import { inferCooldown } from '../src/model/cooldown';

describe('graph + suggestions on the demo map', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const fire = map.entities.find((e) => e.targetname === 'fire_weapon')!;
  const ice = map.entities.find((e) => e.targetname === 'ice_weapon')!;
  const heal = map.entities.find((e) => e.targetname === 'heal_weapon')!;

  it('links parented buttons, outputs and filters', () => {
    const rels = graph.relationsOf(fire);
    expect(rels.some((r) => r.kind === 'child' && r.other.targetname === 'fire_button')).toBe(true);
    expect(rels.some((r) => r.kind === 'output' && r.other.targetname === 'fire_pickup_relay')).toBe(true);
    expect(rels.some((r) => r.kind === 'keyref-in' && r.other.targetname === 'fire_filter' && r.key === 'filtername')).toBe(true);
    expect(rels.some((r) => r.kind === 'input' && r.other.targetname === 'fire_strip_trigger')).toBe(true);
    const tree = buildRelationTree(graph, fire, 3);
    const names = new Set<string>();
    const walk = (n: typeof tree) => {
      names.add(n.entity.targetname);
      n.children.forEach(walk);
    };
    walk(tree);
    expect(names.has('fire_relay')).toBe(true);
    expect(names.has('fire_particle')).toBe(true);
  });

  it('suggests a button + filter chain for the fire materia', () => {
    const { item } = suggestItemForWeapon(fire, graph);
    expect(item.hammerid).toBe('1201');
    expect(item.name).toBe('Fire');
    expect(item.color).toBe('red');
    const byId = new Map(item.handlers.map((h) => [h.hammerid, h]));
    expect(byId.get('1202')?.type).toBe('button');
    // plain +use hook because the filter handler carries the message
    expect(byId.get('1202')?.mode).toBe(1);
    expect(byId.get('1202')?.event).toBeUndefined();
    expect(byId.get('1202')?.message).toBe(false);
    expect(byId.get('1203')?.type).toBe('other');
    expect(byId.get('1203')?.event).toBe('OnPass');
    // the relay behind the filter and the pickup relay are not ability handlers
    expect(byId.has('1204')).toBe(false);
    expect(byId.has('1205')).toBe(false);
    // trigger_hurt is not hooked by CS2Fixes and the strip trigger does not fire the item
    expect(item.triggers).toEqual([]);
  });

  it('suggests counter handlers for templated items without spelling out templated', () => {
    const { item } = suggestItemForWeapon(ice, graph);
    expect(item.templated).toBeUndefined();
    const counter = item.handlers.find((h) => h.hammerid === '1303');
    expect(counter?.type).toBe('counterdown');
    expect(counter?.mode).toBe(5);
    expect(counter?.event).toBeUndefined();
  });

  it('handles physbox + game_ui items', () => {
    const { item } = suggestItemForWeapon(heal, graph);
    expect(item.color).toBe('white');
    expect(item.handlers.some((h) => h.hammerid === '1401' && h.type === 'button')).toBe(true);
    // the relay behind PressedAttack reports the use; the game_ui itself is not repeated as a handler
    expect(item.handlers.some((h) => h.hammerid === '1403' && h.event === 'OnTrigger')).toBe(true);
    expect(item.handlers.some((h) => h.hammerid === '1402')).toBe(false);
  });

  it('names items from targetnames', () => {
    expect(suggestItemName({ ...fire, targetname: 'materia_ultima_weapon_1' }).name).toBe('Ultima');
    expect(suggestItemName({ ...fire, targetname: '[PR#]Heal_Item' }).name).toBe('Heal');
  });

  it('validates and serializes a full auto config without errors', () => {
    const items = [fire, ice, heal].map((w) => suggestItemForWeapon(w, graph).item);
    const issues = validateConfig({ items }, graph);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    const text = serializeEntWatchConfig({ items }, { describeHammerId: (h) => graph.byHammerId.get(h)?.[0]?.classname });
    expect(text).toContain('"hammerid": "1201", // weapon_knife');
    // plain button hook is written in the compact form
    expect(text).toMatch(/"type": "button",\n\s+"hammerid": "1202" \/\/ func_button\n\s+\}/);
    expect(JSON.parse(text.replace(/\/\/.*$/gm, ''))).toHaveLength(3);
  });

  it('flags hammerids that are not in the map', () => {
    const { item } = suggestItemForWeapon(fire, graph);
    item.handlers.push({ ...item.handlers[0], uid: 'x', hammerid: '99999' });
    const issues = validateConfig({ items: [item] }, graph);
    expect(issues.some((i) => i.key === 'v.handlerNotInMap')).toBe(true);
  });
});

describe('cooldown inference from Lock/Unlock wiring', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('reads the delayed Unlock on the button behind a filter handler', () => {
    const { item, notes } = suggestItemForWeapon(byName('fire_weapon'), graph);
    const filter = item.handlers.find((h) => h.hammerid === '1203')!;
    expect(filter.cooldown).toBe(45);
    expect(filter.mode).toBe(2);
    expect(notes.some((n) => n.includes('cooldown 45s') && n.includes('Unlock'))).toBe(true);
    // the plain +use button hook stays without cooldown
    expect(item.handlers.find((h) => h.hammerid === '1202')!.cooldown).toBe(0);
  });

  it('reads the delayed Enable of the relay behind a game_ui', () => {
    const { item } = suggestItemForWeapon(byName('heal_weapon'), graph);
    const relay = item.handlers.find((h) => h.hammerid === '1403')!;
    expect(relay.cooldown).toBe(60);
    expect(relay.mode).toBe(2);
    // asked directly, the game_ui inherits the relay's cooldown too
    expect(inferCooldown(graph, byName('heal_ui'))?.seconds).toBe(60);
  });

  it('falls back to the button wait key and leaves counters alone', () => {
    const btn = byName('ice_button');
    const guess = inferCooldown(graph, btn);
    expect(guess?.seconds).toBe(2);
    expect(guess?.reason).toContain('wait');
    const { item } = suggestItemForWeapon(byName('ice_weapon'), graph);
    expect(item.handlers.find((h) => h.hammerid === '1303')!.cooldown).toBe(0);
  });
});

describe('template style items without name references', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('finds the button via the shared parent prop and the relay via the template', () => {
    const { item, notes } = suggestItemForWeapon(byName('sleep_weapon'), graph);
    const ids = item.handlers.map((h) => h.hammerid);
    expect(ids).toContain('2003'); // button, sibling under sleep_prop
    expect(ids).toContain('2004'); // relay, template member fed by the button
    const relay = item.handlers.find((h) => h.hammerid === '2004')!;
    expect(relay.event).toBe('OnTrigger');
    expect(relay.cooldown).toBe(60);
    expect(relay.mode).toBe(2);
    const button = item.handlers.find((h) => h.hammerid === '2003')!;
    expect(button.type).toBe('button');
    expect(button.event).toBeUndefined(); // plain +use hook
    // sleep_zone is an effect zone switched on by the relay: never a "triggers" entry
    expect(item.triggers).toEqual([]);
    expect(notes.some((n) => n.includes('sleep_zone') && n.includes('effect zone'))).toBe(true);
    expect(item.templated).toBeUndefined(); // CS2Fixes auto-detects it from the name suffix
    expect(item.color).toBe('purple');
    expect(notes.some((n) => n.includes('sleep_prop'))).toBe(true);
    expect(notes.some((n) => n.includes('sleep_template'))).toBe(true);
  });

  it('takes a lone relay with its own Disable/Enable cooldown from the same template', () => {
    const { item } = suggestItemForWeapon(byName('gravity_weapon'), graph);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2102']);
    expect(item.handlers[0].event).toBe('OnTrigger');
    expect(item.handlers[0].cooldown).toBe(45);
  });

  it('still explains itself when nothing is found', () => {
    const lonely = { ...byName('gravity_weapon'), id: 999, hammerId: '9999', targetname: 'lonely', props: { classname: 'weapon_mac10', targetname: 'lonely', hammeruniqueid: '9999' }, source: { ...byName('gravity_weapon').source, templated: false, container: 'default_ents' } };
    const g2 = new EntityGraph([...map.entities, lonely]);
    const { item, notes } = suggestItemForWeapon(lonely, g2);
    expect(item.handlers).toEqual([]);
    expect(notes.some((n) => n.includes('I/O search'))).toBe(true);
  });
});


describe('activation triggers vs effect zones', () => {
  const map = buildDemoMap();
  const graph = new EntityGraph(map.entities);
  const byName = (n: string) => map.entities.find((e) => e.targetname === n)!;

  it('lists the trigger the holder touches to fire the item, not the zone it switches on', () => {
    const { item, notes } = suggestItemForWeapon(byName('push_weapon'), graph);
    expect(item.triggers).toEqual(['2201']);
    expect(item.handlers.map((h) => h.hammerid)).toEqual(['2202']);
    expect(item.handlers[0].event).toBe('OnTrigger');
    expect(item.handlers[0].cooldown).toBe(30);
    expect(notes.some((n) => n.includes('push_zone') && n.includes('effect zone'))).toBe(true);
  });

  it('writes templated=false only for a shared handler of a templated weapon', () => {
    const sleep = byName('sleep_weapon');
    const sharedButton = { ...byName('sleep_button'), id: 950, hammerId: '9500', source: { ...byName('sleep_button').source, templated: false, container: 'default_ents' } };
    const g2 = new EntityGraph([...map.entities, sharedButton]);
    const { item } = suggestItemForWeapon(sleep, g2);
    const h = item.handlers.find((x) => x.hammerid === '9500');
    expect(h?.templated).toBe(false);
    expect(item.handlers.find((x) => x.hammerid === '2003')?.templated).toBeUndefined();
  });

  it('warns about non-hookable classes and effect zones in the triggers list', () => {
    const { item } = suggestItemForWeapon(byName('push_weapon'), graph);
    item.triggers = ['2201', '2203', '1207'];
    const issues = validateConfig({ items: [item] }, graph);
    expect(issues.some((i) => i.key === 'v.triggerEffectZone' && i.detail?.startsWith('2203'))).toBe(true);
    expect(issues.some((i) => i.key === 'v.triggerNotHookable' && i.detail?.startsWith('1207'))).toBe(true);
    expect(issues.some((i) => i.detail?.startsWith('2201'))).toBe(false);
  });
});
