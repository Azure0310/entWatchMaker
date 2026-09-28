/**
 * Compares what the tool would suggest for each weapon with an existing EntWatch config, and
 * prints the wiring around the config's handlers and triggers so the heuristics can be tuned.
 *
 *   npx tsx scripts/diagnose.ts <map.vpk | map.vmap | folder> [config.jsonc] [--all]
 *
 * --all also prints weapons that are not in the config (brief).
 */
import { readFileSync } from 'node:fs';
import { loadLocalMap } from './loadLocal';
import { EntityGraph } from '../src/model/graph';
import { friendlyName, type MapEntity } from '../src/model/entity';
import { parseEntWatchConfig, type EntWatchConfig } from '../src/model/entwatch';
import { suggestItemForWeapon } from '../src/model/suggest';
import { classifyTrigger, distance, findSelectionTriggers, isKnife, origin } from '../src/model/triggers';
import { inferCooldown } from '../src/model/cooldown';
import { suggestEvents } from '../src/model/events';

const args = process.argv.slice(2);
const all = args.includes('--all');
const [target, configPath] = args.filter((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: npx tsx scripts/diagnose.ts <map.vpk | map.vmap | folder> [config.jsonc] [--all]');
  process.exit(2);
}

const map = await loadLocalMap(target, (m) => console.error(m));
const graph = new EntityGraph(map.entities);
const config: EntWatchConfig | null = configPath ? parseEntWatchConfig(readFileSync(configPath, 'utf8')).config : null;

const L = (e: MapEntity) => `${e.classname} ${friendlyName(e.targetname) || '(unnamed)'} #${e.hammerId}`;
const pos = (e: MapEntity) => (origin(e) ? origin(e)!.map((n) => Math.round(n)).join(' ') : '?');
const dist = (a: MapEntity, b: MapEntity) => {
  const d = distance(origin(a), origin(b));
  return d === null ? '?' : `${Math.round(d)}u`;
};
const out: string[] = [];
const p = (s = '') => out.push(s);

p(`# ${map.mapName} (${map.sourceFiles.join(', ')})`);
p(`entities ${map.stats.entities}, weapons ${map.stats.weapons}, connections ${map.stats.connections}, lumps ${map.stats.lumps}`);
for (const w of map.warnings) p(`warning: ${w}`);
p();

function describeEntity(e: MapEntity, indent = '  '): void {
  p(`${indent}${L(e)} origin=${pos(e)} parent=${e.props.parentname || '-'} lump=${e.source.container}${e.source.templated ? ' (templated)' : ''}`);
  const keys = ['target', 'filtername', 'spawnflags', 'wait', 'startdisabled', 'entitylumpname', 'template01', 'template02', 'template03', 'template04'];
  const kv = keys.filter((k) => e.props[k]).map((k) => `${k}=${e.props[k]}`);
  if (kv.length) p(`${indent}  keys: ${kv.join(', ')}`);
  const inc = graph.incomingConnections(e);
  if (inc.length) p(`${indent}  fired by: ${inc.slice(0, 8).map(({ from, connection }) => `${L(from)} ${connection.output}→${connection.input}${connection.delay ? ` +${connection.delay}s` : ''}`).join(' | ')}${inc.length > 8 ? ` | +${inc.length - 8}` : ''}`);
  if (e.connections.length) {
    p(`${indent}  outputs:`);
    for (const c of e.connections.slice(0, 14)) {
      const targets = graph.connectionTargets(e, c);
      p(`${indent}    ${c.output} → ${c.target} ${c.input}${c.param ? ` "${c.param}"` : ''}${c.delay ? ` +${c.delay}s` : ''}${targets.length ? ` [${targets.slice(0, 3).map((t) => t.classname).join(',')}]` : ' [unresolved]'}`);
    }
    if (e.connections.length > 14) p(`${indent}    … +${e.connections.length - 14} more`);
  }
}

function neighbourhood(w: MapEntity, radius = 512, limit = 16): void {
  const wp = origin(w);
  if (!wp) return;
  const near = map.entities
    .filter((e) => e.id !== w.id && !['prop_static', 'light', 'light_spot', 'light_omni', 'env_cubemap', 'env_cubemap_box', 'info_overlay', 'env_sprite', 'worldspawn'].includes(e.classname))
    .map((e) => ({ e, d: distance(origin(e), wp) }))
    .filter((x): x is { e: MapEntity; d: number } => x.d !== null && x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
  p(`  within ${radius}u: ${near.map(({ e, d }) => `${L(e)} ${Math.round(d)}u`).join(' | ') || 'nothing'}`);
}

const weapons = map.entities.filter((e) => e.classname.startsWith('weapon_'));
const covered = new Set<string>();

if (config) {
  p(`## Config ${configPath}: ${config.items.length} items`);
  p();
  const summary: string[] = [];
  for (const item of config.items) {
    const w = graph.byHammerId.get(item.hammerid)?.[0];
    p(`### "${item.name}" hammerid=${item.hammerid}${w ? '' : ' (NOT FOUND IN MAP)'}`);
    if (!w) {
      p();
      continue;
    }
    covered.add(w.hammerId);
    p(`weapon: knife=${isKnife(w)}`);
    describeEntity(w);
    neighbourhood(w);
    const { item: sug, notes } = suggestItemForWeapon(w, graph);
    const sugH = sug.handlers.map((h) => h.hammerid);
    const cfgH = item.handlers.map((h) => h.hammerid);
    const sugT = sug.triggers;
    const cfgT = item.triggers;
    p(`tool suggestion: handlers [${sugH.join(', ')}] triggers [${sugT.join(', ')}]`);
    p(`config:          handlers [${cfgH.join(', ')}] triggers [${cfgT.join(', ')}]`);
    p(`  missing handlers: [${cfgH.filter((h) => !sugH.includes(h)).join(', ')}]  extra handlers: [${sugH.filter((h) => !cfgH.includes(h)).join(', ')}]`);
    p(`  missing triggers: [${cfgT.filter((t) => !sugT.includes(t)).join(', ')}]  extra triggers: [${sugT.filter((t) => !cfgT.includes(t)).join(', ')}]`);
    for (const n of notes) p(`  note: ${n}`);
    for (const h of item.handlers) {
      const e = graph.byHammerId.get(h.hammerid)?.[0];
      p(`config handler ${h.hammerid} type=${h.type} event=${h.event ?? '-'} mode=${h.mode} cooldown=${h.cooldown ?? 0} maxuses=${h.maxuses ?? 0}${sugH.includes(h.hammerid) ? '  [found by tool]' : '  [MISSED by tool]'}`);
      if (!e) {
        p('  NOT FOUND IN MAP');
        continue;
      }
      describeEntity(e);
      p(`  distance to weapon: ${dist(e, w)}`);
      const ev = suggestEvents(graph, e).slice(0, 3);
      p(`  tool event guesses: ${ev.map((g) => `${g.event} (${g.score.toFixed(1)}: ${g.reason})`).join(' | ') || '-'}`);
      const cd = inferCooldown(graph, e);
      p(`  tool cooldown guess: ${cd ? `${cd.seconds}s (${cd.reason})` : '-'}`);
    }
    for (const t of item.triggers) {
      const e = graph.byHammerId.get(t)?.[0];
      p(`config trigger ${t}${sugT.includes(t) ? '  [found by tool]' : '  [MISSED by tool]'}`);
      if (!e) {
        p('  NOT FOUND IN MAP');
        continue;
      }
      describeEntity(e);
      p(`  distance to weapon: ${dist(e, w)}`);
      const info = classifyTrigger(graph, e);
      p(`  strips: ${info.strips ? info.strips.via : 'no'}`);
      if (info.teleportsTo) {
        const d = distance(info.teleportsTo.position, origin(w));
        p(`  teleports to: ${info.teleportsTo.position.map((n) => Math.round(n)).join(' ')} (${info.teleportsTo.via}) → ${d === null ? '?' : Math.round(d) + 'u'} from weapon`);
      } else p('  teleports to: no');
    }
    if (isKnife(w)) {
      const sel = findSelectionTriggers(graph, w);
      p(`knife selection-trigger search: ${sel.map((s) => `${L(s.trigger)} (${s.reason})`).join(' | ') || 'nothing'}`);
    }
    summary.push(`| ${item.name} | ${item.hammerid} | ${cfgH.length}/${cfgH.filter((h) => sugH.includes(h)).length} | ${sugH.filter((h) => !cfgH.includes(h)).length} | ${cfgT.length}/${cfgT.filter((t) => sugT.includes(t)).length} | ${sugT.filter((t) => !cfgT.includes(t)).length} |`);
    p();
  }
  p('## Summary (config handlers found / extra, config triggers found / extra)');
  p('| item | hammerid | handlers cfg/found | extra | triggers cfg/found | extra |');
  p('| --- | --- | --- | --- | --- | --- |');
  for (const s of summary) p(s);
  p();
}

const rest = weapons.filter((w) => !covered.has(w.hammerId));
if (rest.length) {
  p(`## Weapons not in the config (${rest.length})`);
  for (const w of rest) {
    if (all) {
      p(`### ${L(w)}`);
      describeEntity(w);
      neighbourhood(w, 384, 10);
      const { item: sug, notes } = suggestItemForWeapon(w, graph);
      p(`tool suggestion: handlers [${sug.handlers.map((h) => `${h.hammerid}${h.event ? ':' + h.event : ''}`).join(', ')}] triggers [${sug.triggers.join(', ')}]`);
      for (const n of notes.slice(0, 6)) p(`  note: ${n}`);
      p();
    } else p(`- ${L(w)} origin=${pos(w)} lump=${w.source.container}`);
  }
}

console.log(out.join('\n'));
