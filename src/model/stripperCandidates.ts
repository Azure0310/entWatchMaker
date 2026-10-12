/**
 * Help for porting a stripper config to a CS2 version of the map: for a filter / modify that selects
 * nothing in the loaded map, find the entities it most likely meant and rewrite its match to select
 * them. Ported maps keep most names but renumber hammer ids, store origins in another text form
 * ("13664 2063.74 6375.21" becomes "13664.000000 2063.739990 6375.209961"), rename some classes and
 * move entities into point_template lumps, so each part of the old match is weighed on its own.
 */

import { friendlyName, type MapEntity } from './entity';
import type { EntityGraph } from './graph';
import { worldPositions, type Vec3 } from './position';
import { isRegexValue, targetForEntity, type FilterAction, type KV, type ModifyAction, type StripperAction } from './stripper';
import { buildMatch, type MatchStrategy } from './stripperBuild';
import { compileValue, entityMatches, toSimEntity } from './stripperMatch';

/** CS:GO classes whose CS2 port uses another class for the same job. */
export const CLASS_RENAMES: Record<string, string[]> = {
  func_physbox_multiplayer: ['func_physbox'],
  prop_physics_multiplayer: ['prop_physics', 'prop_physics_override'],
  env_message: ['env_hudhint', 'game_text'],
  ambient_generic: ['point_soundevent'],
  func_brush: ['func_wall_toggle'],
};

export type Signal =
  | { kind: 'name' }
  | { kind: 'id' }
  /** `known`: the same class or a known CS2 replacement for it. */
  | { kind: 'class'; same: boolean; known: boolean; from: string; to: string }
  | { kind: 'origin'; distance: number }
  | { kind: 'io'; ok: boolean }
  | { kind: 'key'; key: string; ok: boolean };

export interface Candidate {
  entity: MapEntity;
  score: number;
  signals: Signal[];
  /** How the rewritten match picks the entity. */
  strategy: MatchStrategy;
}

export interface CandidateResult {
  candidates: Candidate[];
  /** The best candidate when it is clearly the one meant: rewrite without asking. */
  sure: Candidate | null;
}

type Selecting = FilterAction | ModifyAction;

function ioOf(a: Selecting): FilterAction['io'] {
  return a.kind === 'filter' ? a.io : a.matchIo;
}

function vec(text: string): Vec3 | null {
  const p = text.trim().split(/\s+/).map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? [p[0], p[1], p[2]] : null;
}

/** The name the match asks for, compared without the CS2 decorations. */
function nameMatches(value: string, e: MapEntity): boolean {
  const m = compileValue(value);
  if (m.kind === 'regex') return m.re.test(e.targetname) || m.re.test(friendlyName(e.targetname));
  if (m.kind === 'exact') return m.text.toLowerCase() === friendlyName(e.targetname).toLowerCase();
  return false;
}

function classSignal(want: string, e: MapEntity): Signal | null {
  if (isRegexValue(want)) {
    const m = compileValue(want);
    return m.kind === 'regex' && m.re.test(e.classname) ? { kind: 'class', same: true, known: true, from: want, to: e.classname } : null;
  }
  const w = want.toLowerCase();
  const got = e.classname.toLowerCase();
  if (w === got) return { kind: 'class', same: true, known: true, from: want, to: e.classname };
  if ((CLASS_RENAMES[w] ?? []).includes(got)) return { kind: 'class', same: false, known: true, from: want, to: e.classname };
  return null;
}

const ORIGIN_NEAR = 256;

/** The way the rewritten match should pick `e`: by name when the name is unique for its class. */
function strategyFor(graph: EntityGraph, e: MapEntity): MatchStrategy {
  if (e.targetname) {
    const same = graph.entities.filter((o) => o.classname === e.classname && o.targetname === e.targetname).length;
    if (same === 1) return 'name';
  }
  return e.hammerId ? 'id' : e.props.origin ? 'origin' : 'class';
}

/**
 * Entities of the loaded map the action probably meant, best first. Only entities that share a
 * name, an id or a position (within 256 units) with the match are considered.
 */
export function findCandidates(action: StripperAction, graph: EntityGraph, limit = 5): CandidateResult {
  if (action.kind === 'add') return { candidates: [], sure: null };
  const match = new Map<string, string>(action.match.map((kv) => [kv.key.toLowerCase(), kv.value]));
  const io = ioOf(action);
  const wantName = match.get('targetname');
  const wantId = match.get('hammeruniqueid') ?? match.get('hammerid');
  const wantClass = match.get('classname');
  const wantOrigin = match.get('origin');
  const wantPos = wantOrigin && !isRegexValue(wantOrigin) ? vec(wantOrigin) : null;
  const others = action.match.filter((kv) => !['targetname', 'hammeruniqueid', 'hammerid', 'classname', 'origin'].includes(kv.key.toLowerCase()));

  const out: Candidate[] = [];
  for (const e of graph.entities) {
    const signals: Signal[] = [];
    let score = 0;
    let anchored = false;
    if (wantName !== undefined && e.targetname && nameMatches(wantName, e)) {
      signals.push({ kind: 'name' });
      score += 40;
      anchored = true;
    }
    if (wantId !== undefined && !isRegexValue(wantId) && e.hammerId === wantId) {
      signals.push({ kind: 'id' });
      score += 30;
      anchored = true;
    }
    if (wantPos) {
      let best: number | null = null;
      for (const p of worldPositions(graph, e)) {
        const d = Math.hypot(p.position[0] - wantPos[0], p.position[1] - wantPos[1], p.position[2] - wantPos[2]);
        if (best === null || d < best) best = d;
      }
      if (best !== null && best <= ORIGIN_NEAR) {
        signals.push({ kind: 'origin', distance: best });
        score += best < 1 ? 30 : best < 64 ? 20 : 8;
        anchored = true;
      }
    }
    if (!anchored) continue;
    if (wantClass !== undefined) {
      const c = classSignal(wantClass, e);
      if (c) {
        signals.push(c);
        score += c.kind === 'class' && c.same ? 15 : 8;
      } else {
        // something else that merely stands nearby
        if (!signals.some((s) => s.kind === 'name' || s.kind === 'id')) continue;
        signals.push({ kind: 'class', same: false, from: wantClass, to: e.classname, known: false });
        score -= 25;
      }
    }
    if (io.length > 0) {
      const ok = entityMatches(toSimEntity(e), [], io);
      signals.push({ kind: 'io', ok });
      score += ok ? 15 : -10;
    }
    for (const kv of others) {
      // brush model numbers ("*12") are renumbered by every compile
      if (kv.key.toLowerCase() === 'model' && /^\*\d+$/.test(kv.value)) continue;
      const ok = entityMatches(toSimEntity(e), [kv], []);
      signals.push({ kind: 'key', key: kv.key, ok });
      score += ok ? 5 : -5;
    }
    out.push({ entity: e, score, signals, strategy: strategyFor(graph, e) });
  }
  out.sort((a, b) => b.score - a.score || a.entity.id - b.entity.id);
  const candidates = out.slice(0, limit);
  return { candidates, sure: sureOf(out, wantPos !== null) };
}

function has(c: Candidate, kind: Signal['kind']): boolean {
  return c.signals.some((s) => s.kind === kind);
}

/**
 * The best candidate counts as sure when it is the only one with its name / id (or the only one at
 * the very position), nothing it was asked for contradicts it, and the runner-up is well behind.
 */
function sureOf(all: Candidate[], askedPosition: boolean): Candidate | null {
  const best = all[0];
  if (!best) return null;
  const second = all[1];
  if (second && second.score >= best.score - 10) return null;
  for (const s of best.signals) {
    if (s.kind === 'io' && !s.ok) return null;
    if (s.kind === 'key' && !s.ok) return null;
    if (s.kind === 'origin' && s.distance > 64) return null;
    if (s.kind === 'class' && !s.known) return null;
  }
  // asked for a place and found far away: probably moved, maybe something else
  if (askedPosition && !has(best, 'origin')) return null;
  const named = has(best, 'name') || has(best, 'id');
  const exactSpot = best.signals.some((s) => s.kind === 'origin' && s.distance < 1);
  if (!named && !exactSpot) return null;
  if (!named && !best.signals.some((s) => s.kind === 'class')) return null;
  return best;
}

/** The action rewritten to select `c.entity`: new match, the entity's lump, the old match kept in the note. */
export function applyCandidate(action: Selecting, c: Candidate, mapName: string): Selecting {
  const was = action.match.map((kv: KV) => `${kv.key}=${kv.value}`).join(' ');
  const renamed = c.signals.find((s): s is Extract<Signal, { kind: 'class' }> => s.kind === 'class' && !s.same);
  const parts = [`CS2: was ${was}`];
  if (renamed) parts.push(`class ${renamed.from} → ${renamed.to}`);
  const note = [action.note, parts.join('; ')].filter(Boolean).join(' | ');
  return { ...action, match: buildMatch(c.entity, c.strategy), target: targetForEntity(c.entity, mapName), note };
}
