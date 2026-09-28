/**
 * Writes every entity of a map (properties + connections) as JSON, the same shape as the
 * "Export entities" button in the UI.
 *
 *   npx tsx scripts/dump-entities.ts <map.vpk | map.vmap | folder> [out.json]
 */
import { writeFileSync } from 'node:fs';
import { loadLocalMap } from './loadLocal';

const [target, outArg] = process.argv.slice(2);
if (!target) {
  console.error('usage: npx tsx scripts/dump-entities.ts <map.vpk | map.vmap | folder> [out.json]');
  process.exit(2);
}
const map = await loadLocalMap(target, (m) => console.error(m));
const out = outArg ?? `${map.mapName}.entities.json`;
const dump = {
  tool: 'entWatchMaker',
  mapName: map.mapName,
  sourceKind: map.sourceKind,
  sourceFiles: map.sourceFiles,
  stats: map.stats,
  warnings: map.warnings,
  entities: map.entities.map((e) => ({
    hammerid: e.hammerId,
    classname: e.classname,
    targetname: e.targetname,
    container: e.source.container,
    templated: e.source.templated,
    props: e.props,
    connections: e.connections,
  })),
};
writeFileSync(out, JSON.stringify(dump));
console.error(`wrote ${out}: ${map.stats.entities} entities, ${map.stats.weapons} weapons, ${map.stats.connections} connections`);
