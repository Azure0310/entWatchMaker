/**
 * Unified, structured-clone friendly entity model shared by the parsers, the worker and the UI.
 */

export interface EntityConnection {
  output: string;
  target: string;
  /** EntityIOTargetType_t: 0 classname, 1 classname derives, 2 entity name, 3 component, 4 !activator, 5 !caller, 6 ehandle, 7 name or classname */
  targetType: number;
  input: string;
  param: string;
  delay: number;
  timesToFire: number;
}

export interface EntitySource {
  kind: 'vmap' | 'vpk';
  /** File the entity came from (vmap path or vpk entry path). */
  file: string;
  /** Compiled entity lump name (vpk) or prefab path (vmap). */
  container: string;
  /** Name scope used to resolve targetnames; entities in the same scope see each other. */
  scope: string;
  /** True when the entity lives in a point_template child lump (compiled maps). */
  templated: boolean;
  /** Hammer node lineage (prefab node ids) for vmap sources. */
  lineage?: number[];
}

export interface MapEntity {
  id: number;
  hammerId: string;
  classname: string;
  targetname: string;
  /** Lowercased key -> value string. */
  props: Record<string, string>;
  connections: EntityConnection[];
  source: EntitySource;
}

export interface ParsedMap {
  /** Best guess of the map name (used for the jsonc file name). */
  mapName: string;
  sourceKind: 'vmap' | 'vpk';
  sourceFiles: string[];
  entities: MapEntity[];
  warnings: string[];
  stats: {
    lumps: number;
    entities: number;
    connections: number;
    weapons: number;
  };
}

export const PREFAB_NAME_PREFIX = '[PR#]';

/**
 * Strips the decorations the compiler adds to entity names: the "[PR#]" marker on prefab
 * instanced entities (any case) and the "&0000" instance suffix that point_templates with name
 * fixup put on the entities of their child lump. References in the map (templateNN, outputs,
 * filtername) use the undecorated name, so this is the form names are compared in.
 */
export function friendlyName(name: string): string {
  let s = name;
  if (s.length >= PREFAB_NAME_PREFIX.length && s.slice(0, PREFAB_NAME_PREFIX.length).toUpperCase() === PREFAB_NAME_PREFIX) {
    s = s.slice(PREFAB_NAME_PREFIX.length);
  }
  return s.replace(/&\d{4}$/, '');
}

export function isWeaponEntity(e: MapEntity): boolean {
  return e.classname.startsWith('weapon_');
}

export function entityLabel(e: MapEntity): string {
  const name = friendlyName(e.targetname);
  return name ? `${name} (${e.classname})` : e.classname;
}
