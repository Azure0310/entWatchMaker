import type { EntityGraph } from './graph';
import { friendlyName, isWeaponEntity, type MapEntity } from './entity';
import { HOOKABLE_TRIGGERS, causedOutputs } from './roles';
import { distance, minDistanceTo, spawnersOf, templateOf, worldPositions, type Vec3 } from './position';

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
 * RunScriptInput "StripKnife", or "CanPickUpItem": a script that decides whether the toucher gets
 * the item, ze_castlevania) or by finding the held knife with a point_entity_finder whose
 * OnFoundEntity kills it.
 */
export function isStripInput(e: MapEntity, input: string, param: string): boolean {
  const inp = input.toLowerCase();
  if (STRIP_CLASSES.has(e.classname)) return true;
  if (!isWeaponEntity(e) && STRIP_PLAYER_INPUTS.has(inp)) return true;
  if ((e.classname === 'point_script' || e.classname === 'logic_script') && inp === 'runscriptinput' && /strip|pick_?up/i.test(param)) return true;
  if (e.classname === 'point_entity_finder' && inp === 'findentity') {
    return e.connections.some((c) => c.output.toLowerCase() === 'onfoundentity' && /^kill/i.test(c.input));
  }
  return false;
}

function label(e: MapEntity): string {
  const name = friendlyName(e.targetname);
  return name ? `${name} (${e.classname})` : e.classname;
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

/**
 * What the item's own logic sets off: its handlers, and the weapon's outputs other than
 * OnPlayerPickup (a clean-up loop that runs while it is held, not the pickup, which also arms
 * stage logic), 3 hops through anything but Kill, into the templates they spawn and to what an
 * AddOutput wires up at run time. A teleport switched on from there is the ability's portal or
 * warp (a zombie that pulls humans in, the rescue teleport when its holder leaves), not the way to
 * get the item; listing it would make ebanned players immune to it.
 */
export function abilityReach(graph: EntityGraph, handlers: MapEntity[], weapon?: MapEntity, depth = 3): Set<number> {
  const starts = weapon ? [...handlers, weapon] : [...handlers];
  const seen = new Set(starts.map((h) => h.id));
  let frontier = starts;
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: MapEntity[] = [];
    const reached = (o: MapEntity) => {
      if (seen.has(o.id)) return;
      seen.add(o.id);
      next.push(o);
    };
    for (const x of frontier) {
      for (const rel of graph.relationsOf(x)) {
        const pickup = x === weapon && /^onplayerpickup$/i.test(rel.connection?.output ?? '');
        const follows =
          (rel.kind === 'output' && !!rel.connection && !/^kill/i.test(rel.connection.input) && !pickup) ||
          rel.kind === 'template' ||
          (rel.kind === 'keyref' && x.classname === 'env_entity_maker');
        if (follows) reached(rel.other);
      }
      // AddOutput "OnCase03>item_goto_maker>ForceSpawnAtEntityOrigin>…" wires the named entity in
      for (const c of x.connections) {
        if (c.input.toLowerCase() !== 'addoutput' || (x === weapon && /^onplayerpickup$/i.test(c.output))) continue;
        const parts = c.param.includes('>') ? c.param.split('>') : c.param.split(':');
        if (parts.length >= 3) for (const o of graph.resolveName(parts[1].trim(), x.source.scope, x.source.container)) reached(o);
      }
    }
    frontier = next;
  }
  return seen;
}

/** `trig` moves the stage on: opens / closes doors, switches teleports, removes walls, moves spawn points. */
function movesStage(graph: EntityGraph, trig: MapEntity): boolean {
  return trig.connections.some((c) => {
    const input = c.input.toLowerCase();
    if (input === 'setabsorigin' || input === 'startfire') return true;
    return graph.connectionTargets(trig, c).some(
      (t) =>
        (/^(open|close|toggle)$/.test(input) && /door|movelinear|rotating/.test(t.classname)) ||
        (/^(enable|disable)$/.test(input) && t.classname === 'trigger_teleport') ||
        (input === 'kill' && /^func_(brush|wall|breakable|door|movelinear|tracktrain|physbox)/.test(t.classname)),
    );
  });
}

/** `trig` is part of what `reach` sets off, or is switched on / fired from it. */
export function switchedOnBy(graph: EntityGraph, trig: MapEntity, reach: Set<number>): boolean {
  if (reach.has(trig.id)) return true;
  return graph.incomingConnections(trig).some(({ from, connection }) => reach.has(from.id) && /^(enable|toggle|fireuser\d)$/i.test(connection.input));
}

export interface SelectionTrigger {
  trigger: MapEntity;
  /** spawns the item, strips the player on it, or teleports onto it */
  kind: 'spawner' | 'strip' | 'landing';
  reason: string;
}

/**
 * How the map itself ties a trigger to the weapon, as opposed to merely placing it nearby: the
 * trigger is compiled into the weapon's template lump, parented to it, or fired at by its
 * OnPlayerPickup (usually a Kill once the item is taken). Null when nothing ties them.
 */
export function tiedToWeapon(graph: EntityGraph, trig: MapEntity, weapon: MapEntity): string | null {
  if (weapon.source.templated && trig.source.templated && trig.source.container === weapon.source.container && trig.source.file === weapon.source.file) {
    return `in the knife's template lump ${weapon.source.container}`;
  }
  if (graph.relationsOf(trig).some((r) => r.kind === 'parent' && r.other.id === weapon.id)) return 'parented to the knife';
  for (const c of weapon.connections) {
    if (!/^onplayerpickup$/i.test(c.output)) continue;
    if (graph.connectionTargets(weapon, c).some((t) => t.id === trig.id)) return `the knife's OnPlayerPickup → ${c.input}`;
  }
  return null;
}

/**
 * Triggers that hand out the item: ones that spawn its template (and no other item's), strip
 * zones the map ties to the item (see tiedToWeapon; a strip zone that is merely nearby belongs to
 * a round start or to the item next door), and teleports that land on it. A landing belongs to
 * the nearest weapon only, so the teleport of the item next door is not picked up. The GFL
 * configs list landings within a few dozen units of the knife and none further than 64.
 */
export function findSelectionTriggers(
  graph: EntityGraph,
  weapon: MapEntity,
  opts: { teleportRadius?: number; onTopRadius?: number } = {},
): SelectionTrigger[] {
  const teleportRadius = opts.teleportRadius ?? 64;
  const onTopRadius = opts.onTopRadius ?? 32;
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

  // a trigger that spawns this item and no other hands it out; one that spawns several items, or
  // also opens gates / switches teleports / moves spawn points, is a stage start, and listing it
  // would keep ebanned players from starting the stage. GFL lists 17 of the first kind and none
  // of the other.
  for (const trig of hookable) {
    const sp = spawnsEntity(graph, trig, weapon);
    if (!sp || otherWeapons.some((o) => spawnsEntity(graph, trig, o)) || movesStage(graph, trig)) continue;
    out.push({ trigger: trig, kind: 'spawner', reason: `spawns the item's template (${sp.via})` });
  }

  const infos = hookable.map((t) => classifyTrigger(graph, t));
  const stripZones: MapEntity[] = [];
  for (const info of infos) {
    if (!info.strips) continue;
    const tie = tiedToWeapon(graph, info.trigger, weapon);
    if (!tie) continue;
    stripZones.push(info.trigger);
    out.push({ trigger: info.trigger, kind: 'strip', reason: `strip zone ${tie} (${info.strips.via})` });
  }
  if (stripZones.length === 0) {
    // nothing tied: a strip zone sitting right on the knife, and nearer to it than to any other
    // weapon, is its own too (maps that place items and their strip zones by hand)
    for (const info of infos) {
      if (!info.strips) continue;
      const d = minDistanceTo(graph, info.trigger, wpos);
      if (d === null || d > onTopRadius) continue;
      const zone = worldPositions(graph, info.trigger).map((p) => p.position);
      const closerWeapon = otherWeapons.some((o) => {
        const od = minDistanceTo(graph, o, zone);
        return od !== null && od + 16 < d;
      });
      if (closerWeapon) continue;
      stripZones.push(info.trigger);
      out.push({ trigger: info.trigger, kind: 'strip', reason: `strip zone ${Math.round(d)} units above the knife (${info.strips.via})` });
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
      out.push({ trigger: info.trigger, kind: 'landing', reason: `teleports ${Math.round(best.d)} units from the knife (${info.teleportsTo.via})` });
    }
    // a teleport landing further off, somewhere on the strip zone, is not listed (GFL: 0 of 8)
  }
  // dedupe, keep first reason
  const seen = new Set<number>();
  return out.filter((s) => (seen.has(s.trigger.id) ? false : (seen.add(s.trigger.id), true)));
}
