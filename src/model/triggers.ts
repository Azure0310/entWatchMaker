import type { EntityGraph } from './graph';
import { friendlyName, isWeaponEntity, type MapEntity } from './entity';
import { HOOKABLE_TRIGGERS, causedOutputs } from './roles';
import { distance, minDistanceTo, origin, spawnersOf, templateOf, worldPositions, type Vec3 } from './position';

export { distance, origin } from './position';

/**
 * Knife / class items are handed out by touching things rather than pressing buttons: a strip
 * trigger sits on the knife so it can be picked up, and usually a trigger_teleport drops the
 * player onto that spot from a selection room. Neither is wired to the weapon by name, so they
 * are found by what they do (strip, teleport, spawn the knife) and where they lead.
 */

export function isKnife(e: MapEntity): boolean {
  return e.classname.startsWith('weapon_knife') || e.classname === 'weapon_bayonet';
}

const STRIP_CLASSES = new Set(['player_weaponstrip', 'game_player_equip']);
const STRIP_PLAYER_INPUTS = new Set(['strip', 'stripweapons', 'stripweaponsandsuit', 'removeallweapons']);

/**
 * True when firing `input` (with `param`) at `e` takes the player's weapons away. Besides the
 * plain player_weaponstrip, workshop maps strip through scripts (point_script
 * RunScriptInput "StripKnife") or by finding the held knife with a point_entity_finder whose
 * OnFoundEntity kills it.
 */
export function isStripInput(e: MapEntity, input: string, param: string): boolean {
  const inp = input.toLowerCase();
  if (STRIP_CLASSES.has(e.classname)) return true;
  if (!isWeaponEntity(e) && STRIP_PLAYER_INPUTS.has(inp)) return true;
  if ((e.classname === 'point_script' || e.classname === 'logic_script') && inp === 'runscriptinput' && /strip/i.test(param)) return true;
  if (e.classname === 'point_entity_finder' && inp === 'findentity') {
    return e.connections.some((c) => c.output.toLowerCase() === 'onfoundentity' && /^kill/i.test(c.input));
  }
  return false;
}

function label(e: MapEntity): string {
  const name = friendlyName(e.targetname);
  return name ? `${name} (${e.classname})` : e.classname;
}

const SPAWN_CLASSES = new Set(['info_player_counterterrorist', 'info_player_terrorist', 'info_player_start', 'info_deathmatch_spawn', 'info_armsrace_counterterrorist', 'info_armsrace_terrorist']);

/** Round-start strips sit on the spawns; they are never an item's trigger. */
function nearSpawn(graph: EntityGraph, e: MapEntity, radius = 384): boolean {
  const spawns = graph.entities.filter((s) => SPAWN_CLASSES.has(s.classname)).map(origin).filter((p): p is Vec3 => p !== null);
  if (spawns.length === 0) return false;
  const d = minDistanceTo(graph, e, spawns);
  return d !== null && d <= radius;
}

/**
 * Breadth-first walk over outputs; returns the first entity matching `pred` and the path to it.
 * Past the first hop only the outputs the arriving input causes are followed (Trigger → OnTrigger,
 * FireUser1 → OnUser1, Enable → nothing), so a trigger that merely arms a teleport is not
 * credited with what the teleport does when touched.
 */
function reach(
  graph: EntityGraph,
  start: MapEntity,
  pred: (e: MapEntity, input: string, param: string) => boolean,
  maxDepth: number,
): { entity: MapEntity; via: string } | null {
  const seen = new Set<number>([start.id]);
  const all = () => true;
  let frontier: { e: MapEntity; via: string; allow: (output: string) => boolean }[] = [{ e: start, via: label(start), allow: all }];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const { e, via, allow } of frontier) {
      for (const rel of graph.relationsOf(e)) {
        if (rel.kind !== 'output' || !rel.connection || !allow(rel.connection.output)) continue;
        const path = `${via} ${rel.connection.output} → ${label(rel.other)} ${rel.connection.input}${rel.connection.param ? ` "${rel.connection.param}"` : ''}`;
        if (pred(rel.other, rel.connection.input, rel.connection.param)) return { entity: rel.other, via: path };
        if (!seen.has(rel.other.id)) {
          seen.add(rel.other.id);
          next.push({ e: rel.other, via: path, allow: causedOutputs(rel.connection.input) ?? all });
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** The strip entity `e` reaches within `maxDepth` output hops (null when it strips nothing). */
export function stripsVia(graph: EntityGraph, e: MapEntity, maxDepth = 2): { entity: MapEntity; via: string } | null {
  return reach(graph, e, (t, input, param) => isStripInput(t, input, param), maxDepth);
}

/**
 * True when touching `trig` spawns `weapon`: it (or something it fires) ForceSpawns the weapon's
 * point_template or an env_entity_maker using that template. Such a trigger is the item's
 * selection trigger even when the weapon's local coordinates say otherwise.
 */
export function spawnsEntity(graph: EntityGraph, trig: MapEntity, weapon: MapEntity): { entity: MapEntity; via: string } | null {
  const tpl = templateOf(graph, weapon);
  if (!tpl) return null;
  const spawners = new Set<number>([tpl.id, ...spawnersOf(graph, tpl).map((m) => m.id)]);
  return reach(graph, trig, (t, input) => spawners.has(t.id) && input.toLowerCase() === 'forcespawn', 2);
}

export interface TriggerInfo {
  trigger: MapEntity;
  strips: { via: string } | null;
  /** Where a player touching it ends up (trigger_teleport target, or a point_teleport it fires). */
  teleportsTo: { positions: Vec3[]; via: string } | null;
}

export function classifyTrigger(graph: EntityGraph, trig: MapEntity): TriggerInfo {
  const strip = stripsVia(graph, trig, 2);
  let teleportsTo: TriggerInfo['teleportsTo'] = null;
  if (trig.classname === 'trigger_teleport') {
    const dest = graph.relationsOf(trig).find((r) => r.kind === 'keyref' && r.key === 'target')?.other;
    const positions = dest ? worldPositions(graph, dest).map((p) => p.position) : [];
    if (dest && positions.length > 0) teleportsTo = { positions, via: `target ${label(dest)}` };
  }
  if (!teleportsTo) {
    const pt = reach(graph, trig, (e) => e.classname === 'point_teleport', 2);
    const positions = pt ? worldPositions(graph, pt.entity).map((p) => p.position) : [];
    if (pt && positions.length > 0) teleportsTo = { positions, via: pt.via };
  }
  return { trigger: trig, strips: strip ? { via: strip.via } : null, teleportsTo };
}

export interface SelectionTrigger {
  trigger: MapEntity;
  reason: string;
}

/**
 * Triggers that hand out the item: ones that spawn its template, strip zones on the item, and
 * teleports that land on it (or on that strip zone). A landing belongs to the nearest weapon
 * only, so the teleport of the item next door is not picked up. Radii are generous because
 * brush entity origins are their centres, not their edges.
 */
export function findSelectionTriggers(graph: EntityGraph, weapon: MapEntity, opts: { stripRadius?: number; teleportRadius?: number } = {}): SelectionTrigger[] {
  const stripRadius = opts.stripRadius ?? 256;
  const teleportRadius = opts.teleportRadius ?? 384;
  const wpos = worldPositions(graph, weapon).map((p) => p.position);
  if (wpos.length === 0) return [];
  const out: SelectionTrigger[] = [];
  const hookable = graph.entities.filter((e) => HOOKABLE_TRIGGERS.has(e.classname));
  const otherWeapons = graph.entities.filter((e) => isWeaponEntity(e) && e.id !== weapon.id);
  // a landing is "on" this weapon only when no other weapon lies closer (with a little slack)
  const nearestIsUs = (landing: Vec3, d: number): boolean =>
    !otherWeapons.some((o) => {
      const od = minDistanceTo(graph, o, [landing]);
      return od !== null && od + 16 < d;
    });

  for (const trig of hookable) {
    const sp = spawnsEntity(graph, trig, weapon);
    if (sp) out.push({ trigger: trig, reason: `spawns the item's template (${sp.via})` });
  }

  const infos = hookable.map((t) => classifyTrigger(graph, t));
  const stripZones: MapEntity[] = [];
  for (const info of infos) {
    if (!info.strips) continue;
    if (nearSpawn(graph, info.trigger)) continue; // round-start strip on the spawns
    const d = minDistanceTo(graph, info.trigger, wpos);
    if (d !== null && d <= stripRadius) {
      stripZones.push(info.trigger);
      out.push({ trigger: info.trigger, reason: `strip zone ${Math.round(d)} units from the knife (${info.strips.via})` });
    }
  }
  for (const info of infos) {
    if (!info.teleportsTo) continue;
    let best: { d: number; landing: Vec3 } | null = null;
    for (const landing of info.teleportsTo.positions) {
      for (const w of wpos) {
        const d = distance(landing, w);
        if (d !== null && (!best || d < best.d)) best = { d, landing };
      }
    }
    if (!best) continue;
    if (best.d <= teleportRadius) {
      if (!nearestIsUs(best.landing, best.d)) {
        continue; // lands closer to another weapon
      }
      out.push({ trigger: info.trigger, reason: `teleports ${Math.round(best.d)} units from the knife (${info.teleportsTo.via})` });
      continue;
    }
    const zoneDistances = stripZones
      .map((z) => minDistanceTo(graph, z, info.teleportsTo!.positions))
      .filter((d): d is number => d !== null);
    if (zoneDistances.length > 0 && Math.min(...zoneDistances) <= stripRadius && nearestIsUs(best.landing, best.d)) {
      out.push({ trigger: info.trigger, reason: `teleports onto the strip zone (${info.teleportsTo.via})` });
    }
  }
  // dedupe, keep first reason
  const seen = new Set<number>();
  return out.filter((s) => (seen.has(s.trigger.id) ? false : (seen.add(s.trigger.id), true)));
}
