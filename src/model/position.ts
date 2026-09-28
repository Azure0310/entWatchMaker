import type { EntityGraph } from './graph';
import type { MapEntity } from './entity';

/**
 * World positions. Entities compiled into a point_template child lump (`NNN#entityLumpName`)
 * carry origins relative to their point_template, so comparing them with world coordinates
 * gives distances of thousands of units. The template is spawned either by itself (entities
 * land at template origin + local origin) or by an env_entity_maker that references it
 * (maker origin + local origin), so a templated entity can have several world positions.
 */

export type Vec3 = [number, number, number];

export function origin(e: MapEntity): Vec3 | null {
  const parts = (e.props.origin ?? '').split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1], parts[2]] : null;
}

export function distance(a: Vec3 | null, b: Vec3 | null): number | null {
  if (!a || !b) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

interface TemplateIndex {
  /** lowercase lump name -> point_template that owns it */
  byLump: Map<string, MapEntity>;
  /** point_template hammerid -> point_template */
  byHammerId: Map<string, MapEntity>;
}

const indexCache = new WeakMap<EntityGraph, TemplateIndex>();

function templateIndex(graph: EntityGraph): TemplateIndex {
  let idx = indexCache.get(graph);
  if (idx) return idx;
  idx = { byLump: new Map(), byHammerId: new Map() };
  for (const e of graph.entities) {
    if (e.classname !== 'point_template') continue;
    const lump = (e.props.entitylumpname ?? '').toLowerCase();
    if (lump) idx.byLump.set(lump, e);
    if (e.hammerId) idx.byHammerId.set(e.hammerId, e);
  }
  indexCache.set(graph, idx);
  return idx;
}

/** The point_template whose child lump holds `e` (null for ordinary entities). */
export function templateOf(graph: EntityGraph, e: MapEntity): MapEntity | null {
  if (!e.source.templated) return null;
  const idx = templateIndex(graph);
  const container = e.source.container;
  const byLump = idx.byLump.get(container.toLowerCase());
  if (byLump) return byLump;
  // compiled lump names are "<template hammerid>#entityLumpName"
  const m = /^(\d+)#/.exec(container);
  if (m) {
    const t = idx.byHammerId.get(m[1]);
    if (t) return t;
  }
  return null;
}

/** env_entity_makers that spawn `template` (entitytemplate key). */
export function spawnersOf(graph: EntityGraph, template: MapEntity): MapEntity[] {
  return graph
    .relationsOf(template)
    .filter((r) => r.kind === 'keyref-in' && r.key === 'entitytemplate' && r.other.classname === 'env_entity_maker')
    .map((r) => r.other);
}

export interface WorldPosition {
  position: Vec3;
  /** What the position is relative to: the entity itself, its template or a maker. */
  via: string;
}

/**
 * Every place `e` can end up in world coordinates. Ordinary entities have one (their origin);
 * templated ones have one per env_entity_maker spawning their template, or the template's
 * origin plus their local offset when nothing but the template itself spawns them.
 */
export function worldPositions(graph: EntityGraph, e: MapEntity): WorldPosition[] {
  const local = origin(e);
  if (!local) return [];
  const tpl = templateOf(graph, e);
  if (!tpl) return [{ position: local, via: 'origin' }];
  const out: WorldPosition[] = [];
  for (const maker of spawnersOf(graph, tpl)) {
    const mo = origin(maker);
    if (mo) out.push({ position: add(mo, local), via: `spawned by ${maker.targetname || maker.classname} at its origin` });
  }
  if (out.length === 0) {
    const to = origin(tpl);
    if (to) out.push({ position: add(to, local), via: `relative to ${tpl.targetname || tpl.classname}` });
  }
  return out.length > 0 ? out : [{ position: local, via: 'origin (template position unknown)' }];
}

/** Smallest distance between any world position of `a` and any of `b`. */
export function minDistance(graph: EntityGraph, a: MapEntity, b: MapEntity): number | null {
  return minDistanceTo(graph, a, worldPositions(graph, b).map((p) => p.position));
}

/** Smallest distance between any world position of `e` and any of `positions`. */
export function minDistanceTo(graph: EntityGraph, e: MapEntity, positions: Vec3[]): number | null {
  let best: number | null = null;
  for (const p of worldPositions(graph, e)) {
    for (const q of positions) {
      const d = distance(p.position, q);
      if (d !== null && (best === null || d < best)) best = d;
    }
  }
  return best;
}
