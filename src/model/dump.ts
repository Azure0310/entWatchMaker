import type { EntityConnection, MapEntity } from './entity';

/**
 * Reads the entity JSON written by "Export entities" / scripts/dump-entities.ts back into the
 * entity model, so heuristics can be checked against real maps without the map files.
 */

export interface EntityDumpEntry {
  hammerid?: string;
  classname?: string;
  targetname?: string;
  container?: string;
  templated?: boolean;
  props?: Record<string, string>;
  connections?: Partial<EntityConnection>[];
}

export interface EntityDump {
  mapName?: string;
  entities: EntityDumpEntry[];
}

export function entitiesFromDump(dump: EntityDump): MapEntity[] {
  return dump.entities.map((d, i) => {
    const props = d.props ?? {};
    return {
      id: i,
      hammerId: d.hammerid ?? props.hammeruniqueid ?? '',
      classname: (d.classname ?? props.classname ?? '').toLowerCase(),
      targetname: d.targetname ?? props.targetname ?? '',
      props,
      connections: (d.connections ?? []).map((c) => ({
        output: c.output ?? '',
        target: c.target ?? '',
        targetType: c.targetType ?? 7,
        input: c.input ?? '',
        param: c.param ?? '',
        delay: c.delay ?? 0,
        timesToFire: c.timesToFire ?? -1,
      })),
      source: { kind: 'vpk', file: dump.mapName ?? 'dump', container: d.container ?? 'default_ents', scope: '', templated: d.templated ?? false },
    };
  });
}
