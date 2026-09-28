import type { EntityGraph } from './graph';
import { friendlyName, type MapEntity } from './entity';
import { HOOKABLE_TRIGGERS } from './suggest';

/**
 * Knife / class items are handed out by touching things rather than pressing buttons: a strip
 * trigger (player_weaponstrip / game_player_equip) sits on the knife so it can be picked up, and
 * often a trigger_teleport drops the player onto that spot from a selection room. Neither is
 * wired to the weapon by name, so they are found by what they do and where they lead.
 */

export function isKnife(e: MapEntity): boolean {
  return e.classname.startsWith('weapon_knife') || e.classname === 'weapon_bayonet';
}

const STRIP_CLASSES = new Set(['player_weaponstrip', 'game_player_equip']);
const STRIP_PLAYER_INPUTS = new Set(['strip', 'stripweapons', 'stripweaponsandsuit', 'removeallweapons']);

export function origin(e: MapEntity): [number, number, number] | null {
  const parts = (e.props.origin ?? '').split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1], parts[2]] : null;
}

export function distance(a: [number, number, number] | null, b: [number, number, number] | null): number | null {
  if (!a || !b) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function label(e: MapEntity): string {
  const name = friendlyName(e.targetname);
  return name ? `${name} (${e.classname})` : e.classname;
}

const SPAWN_CLASSES = new Set(['info_player_counterterrorist', 'info_player_terrorist', 'info_player_start', 'info_deathmatch_spawn', 'info_armsrace_counterterrorist', 'info_armsrace_terrorist']);

/** Round-start strips sit on the spawns; they are never an item's trigger. */
function nearSpawn(graph: EntityGraph, e: MapEntity, radius = 384): boolean {
  const pos = origin(e);
  if (!pos) return false;
  return graph.entities.some((s) => SPAWN_CLASSES.has(s.classname) && (distance(origin(s), pos) ?? Infinity) <= radius);
}

/** Breadth-first walk over outputs; returns the first entity matching `pred` and the path to it. */
function reach(graph: EntityGraph, start: MapEntity, pred: (e: MapEntity, input: string) => boolean, maxDepth: number): { entity: MapEntity; via: string } | null {
  const seen = new Set<number>([start.id]);
  let frontier: { e: MapEntity; via: string }[] = [{ e: start, via: label(start) }];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: { e: MapEntity; via: string }[] = [];
    for (const { e, via } of frontier) {
      for (const rel of graph.relationsOf(e)) {
        if (rel.kind !== 'output' || !rel.connection) continue;
        const path = `${via} ${rel.connection.output} → ${label(rel.other)} ${rel.connection.input}`;
        if (pred(rel.other, rel.connection.input)) return { entity: rel.other, via: path };
        if (!seen.has(rel.other.id)) {
          seen.add(rel.other.id);
          next.push({ e: rel.other, via: path });
        }
      }
    }
    frontier = next;
  }
  return null;
}

export interface TriggerInfo {
  trigger: MapEntity;
  strips: { via: string } | null;
  /** Where a player touching it ends up (trigger_teleport target, or a point_teleport it fires). */
  teleportsTo: { position: [number, number, number]; via: string } | null;
}

export function classifyTrigger(graph: EntityGraph, trig: MapEntity): TriggerInfo {
  const strip = reach(graph, trig, (e, input) => STRIP_CLASSES.has(e.classname) || (e.classname.startsWith('weapon_') === false && STRIP_PLAYER_INPUTS.has(input.toLowerCase())), 2);
  let teleportsTo: TriggerInfo['teleportsTo'] = null;
  if (trig.classname === 'trigger_teleport') {
    const dest = graph.relationsOf(trig).find((r) => r.kind === 'keyref' && r.key === 'target')?.other;
    const pos = dest ? origin(dest) : null;
    if (dest && pos) teleportsTo = { position: pos, via: `target ${label(dest)}` };
  }
  if (!teleportsTo) {
    const pt = reach(graph, trig, (e) => e.classname === 'point_teleport', 2);
    const pos = pt ? origin(pt.entity) : null;
    if (pt && pos) teleportsTo = { position: pos, via: pt.via };
  }
  return { trigger: trig, strips: strip ? { via: strip.via } : null, teleportsTo };
}

export interface SelectionTrigger {
  trigger: MapEntity;
  reason: string;
}

/**
 * Strip triggers on the item and teleports that land on it (or on that strip zone).
 * Radii are generous because brush entity origins are their centres, not their edges.
 */
export function findSelectionTriggers(graph: EntityGraph, weapon: MapEntity, opts: { stripRadius?: number; teleportRadius?: number } = {}): SelectionTrigger[] {
  const stripRadius = opts.stripRadius ?? 256;
  const teleportRadius = opts.teleportRadius ?? 384;
  const wpos = origin(weapon);
  if (!wpos) return [];
  const out: SelectionTrigger[] = [];
  const infos = graph.entities.filter((e) => HOOKABLE_TRIGGERS.has(e.classname)).map((t) => classifyTrigger(graph, t));

  const stripZones: MapEntity[] = [];
  for (const info of infos) {
    if (!info.strips) continue;
    if (nearSpawn(graph, info.trigger)) continue; // round-start strip on the spawns
    const d = distance(origin(info.trigger), wpos);
    if (d !== null && d <= stripRadius) {
      stripZones.push(info.trigger);
      out.push({ trigger: info.trigger, reason: `strip zone ${Math.round(d)} units from the knife (${info.strips.via})` });
    }
  }
  for (const info of infos) {
    if (!info.teleportsTo) continue;
    const dWeapon = distance(info.teleportsTo.position, wpos);
    const dStrip = stripZones.map((z) => distance(info.teleportsTo!.position, origin(z))).filter((d): d is number => d !== null);
    const nearStrip = dStrip.length > 0 ? Math.min(...dStrip) : null;
    if (dWeapon !== null && dWeapon <= teleportRadius) {
      out.push({ trigger: info.trigger, reason: `teleports ${Math.round(dWeapon)} units from the knife (${info.teleportsTo.via})` });
    } else if (nearStrip !== null && nearStrip <= stripRadius) {
      out.push({ trigger: info.trigger, reason: `teleports onto the strip zone (${info.teleportsTo.via})` });
    }
  }
  // dedupe, keep first reason
  const seen = new Set<number>();
  return out.filter((s) => (seen.has(s.trigger.id) ? false : (seen.add(s.trigger.id), true)));
}
