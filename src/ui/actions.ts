import { store, type AppState } from './store';
import { buildGraph } from './store';
import type { MapEntity, ParsedMap } from '../model/entity';
import { friendlyName } from '../model/entity';
import { newHandler, newItem, parseEntWatchConfig, serializeEntWatchConfig, type EntWatchConfig, type HandlerConfig, type ItemConfig } from '../model/entwatch';
import { suggestHandler, suggestItemForWeapon } from '../model/suggest';
import { parseMapFiles } from '../worker/client';
import { buildDemoMap } from '../model/demo';
import { hintsFromGraph, hintsFromJsonc, remapConfig, replaceHammerId, staleHammerIds, type HintMap } from '../model/remap';
import type { Lang } from './i18n';
import { persistStripper, refreshStripperSim, restoreStripper } from './stripperState';

const CONFIG_KEY = (mapName: string) => `entwatchmaker.config.${mapName}`;
const HINTS_KEY = (mapName: string) => `entwatchmaker.hints.${mapName}`;

/** Merges what the current map says about the config's hammerids into the remembered hints. */
function refreshHints(): HintMap {
  const { graph, config, hints } = store.get();
  const merged: HintMap = new Map(hints);
  if (graph) for (const [k, v] of hintsFromGraph(config, graph)) merged.set(k, v);
  store.set({ hints: merged });
  return merged;
}

function persistConfig(): void {
  const { map, config } = store.get();
  if (!map) return;
  const hints = refreshHints();
  try {
    if (config.items.length === 0) {
      localStorage.removeItem(CONFIG_KEY(map.mapName));
      localStorage.removeItem(HINTS_KEY(map.mapName));
    } else {
      localStorage.setItem(CONFIG_KEY(map.mapName), serializeEntWatchConfig(config, { comments: false }));
      localStorage.setItem(HINTS_KEY(map.mapName), JSON.stringify([...hints.entries()]));
    }
  } catch {
    // storage unavailable
  }
}

function restoreConfig(mapName: string): { config: EntWatchConfig; hints: HintMap } | null {
  try {
    const text = localStorage.getItem(CONFIG_KEY(mapName));
    if (!text) return null;
    const hints: HintMap = new Map();
    const raw = localStorage.getItem(HINTS_KEY(mapName));
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, { classname?: string; targetname?: string }][]) hints.set(k, v);
    return { config: parseEntWatchConfig(text).config, hints };
  } catch {
    return null;
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(message: string): void {
  store.set({ toast: message });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => store.set({ toast: null }), 2200);
}

export function setLang(lang: Lang): void {
  store.set({ lang });
  try {
    localStorage.setItem('entwatchmaker.lang', lang);
  } catch {
    // ignore
  }
}

function applyMap(map: ParsedMap): void {
  const graph = buildGraph(map);
  const prev = store.get();
  // hints from the map we are leaving, so a config carried over to a new version can be re-matched
  const carried: HintMap = new Map(prev.hints);
  if (prev.graph) for (const [k, v] of hintsFromGraph(prev.config, prev.graph)) carried.set(k, v);
  const restored = restoreConfig(map.mapName);
  // keep the current config when nothing is saved for this map name (e.g. renamed map version)
  const config = restored?.config ?? (prev.config.items.length > 0 ? prev.config : { items: [] });
  const hints: HintMap = new Map(carried);
  if (restored) for (const [k, v] of restored.hints) hints.set(k, v);
  const firstWeapon = map.entities.find((e) => e.classname.startsWith('weapon_')) ?? map.entities[0] ?? null;
  // the stripper config follows the same rule: restore what is saved for this map name, else keep the current one
  const stripper = restoreStripper(map.mapName) ?? prev.stripper;
  store.set({
    stripper,
    selectedActionUid: null,
    map,
    graph,
    loading: { active: false, message: '' },
    error: null,
    config,
    hints,
    remapReport: null,
    selectedItemUid: config.items[0]?.uid ?? null,
    selectedEntityId: firstWeapon?.id ?? null,
    treeRootId: firstWeapon?.id ?? null,
    suggestionNotes: [],
    weaponsOnly: map.stats.weapons > 0 && prev.mode === 'entwatch',
    query: '',
  });
  refreshStripperSim();
  persistStripper();
  const lang = store.get().lang;
  if (restored) showToast(lang === 'ja' ? '前回の設定を復元しました' : 'Restored your previous config for this map');
  const stale = staleHammerIds(config, graph, hints);
  if (stale.length > 0) {
    showToast(
      lang === 'ja'
        ? `${stale.length} 件の hammerid がこのマップと一致しません。「名前で再照合」を試してください`
        : `${stale.length} hammerids do not match this map. Try "Re-match by name"`,
    );
  }
}

export async function loadFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  store.set({ loading: { active: true, message: files.map((f) => f.name).join(', ') }, error: null });
  try {
    const map = await parseMapFiles(files, (message, done, total) => store.set({ loading: { active: true, message, done, total } }));
    applyMap(map);
  } catch (err) {
    store.set({ loading: { active: false, message: '' }, error: err instanceof Error ? err.message : String(err) });
  }
}

export function loadDemo(): void {
  applyMap(buildDemoMap());
}

export function clearMap(): void {
  store.set({
    map: null,
    graph: null,
    selectedEntityId: null,
    treeRootId: null,
    config: { items: [] },
    selectedItemUid: null,
    error: null,
    suggestionNotes: [],
    stripper: { actions: [] },
    stripperSim: null,
    selectedActionUid: null,
    stripperFile: null,
  });
}

export function selectEntity(id: number | null, alsoRoot = false): void {
  store.set((s) => ({ selectedEntityId: id, treeRootId: alsoRoot || s.treeRootId === null ? id : s.treeRootId }));
}

export function setTreeRoot(id: number): void {
  store.set({ treeRootId: id, selectedEntityId: id });
}

export function setTreeDepth(depth: number): void {
  store.set({ treeDepth: Math.max(1, Math.min(6, depth)) });
}

export function setQuery(query: string): void {
  store.set({ query });
}

export function setWeaponsOnly(weaponsOnly: boolean): void {
  store.set({ weaponsOnly });
}

export function setJsonComments(jsonComments: boolean): void {
  store.set({ jsonComments });
}

export function setFoundMaps(foundMaps: AppState['foundMaps']): void {
  store.set({ foundMaps });
}

// ---------------------------------------------------------------------------------------------
// Config editing
// ---------------------------------------------------------------------------------------------

function updateConfig(fn: (config: EntWatchConfig) => EntWatchConfig): void {
  store.set((s) => ({ config: fn(s.config) }));
  persistConfig();
}

function patchItem(uid: string, fn: (item: ItemConfig) => ItemConfig): void {
  updateConfig((c) => ({ items: c.items.map((i) => (i.uid === uid ? fn(i) : i)) }));
}

export function selectItem(uid: string | null): void {
  store.set({ selectedItemUid: uid });
}

export function addEmptyItem(): void {
  const item = newItem();
  updateConfig((c) => ({ items: [...c.items, item] }));
  store.set({ selectedItemUid: item.uid, suggestionNotes: [] });
}

export function addItemFromEntity(entity: MapEntity): void {
  const { graph } = store.get();
  let item: ItemConfig;
  let notes: string[] = [];
  if (graph && entity.classname.startsWith('weapon_')) {
    const r = suggestItemForWeapon(entity, graph);
    item = r.item;
    notes = r.notes;
  } else {
    item = newItem({ name: friendlyName(entity.targetname) || entity.classname, shortname: '', hammerid: entity.hammerId });
  }
  updateConfig((c) => ({ items: [...c.items, item] }));
  store.set({ selectedItemUid: item.uid, suggestionNotes: notes });
}

export function autoAddAllWeapons(): number {
  const { map, graph, config } = store.get();
  if (!map || !graph) return 0;
  const existing = new Set(config.items.map((i) => i.hammerid));
  const added: ItemConfig[] = [];
  for (const e of map.entities) {
    if (!e.classname.startsWith('weapon_') || !e.hammerId || existing.has(e.hammerId)) continue;
    existing.add(e.hammerId);
    added.push(suggestItemForWeapon(e, graph).item);
  }
  if (added.length > 0) {
    updateConfig((c) => ({ items: [...c.items, ...added] }));
    store.set({ selectedItemUid: added[0].uid, suggestionNotes: [] });
  }
  return added.length;
}

export function updateItem(uid: string, patch: Partial<ItemConfig>): void {
  patchItem(uid, (i) => ({ ...i, ...patch }));
}

export function removeItem(uid: string): void {
  updateConfig((c) => ({ items: c.items.filter((i) => i.uid !== uid) }));
  store.set((s) => ({ selectedItemUid: s.selectedItemUid === uid ? (s.config.items[0]?.uid ?? null) : s.selectedItemUid }));
}

export function duplicateItem(uid: string): void {
  const src = store.get().config.items.find((i) => i.uid === uid);
  if (!src) return;
  const copy = newItem({ ...src, handlers: src.handlers.map((h) => newHandler({ ...h })) });
  updateConfig((c) => {
    const idx = c.items.findIndex((i) => i.uid === uid);
    const items = [...c.items];
    items.splice(idx + 1, 0, copy);
    return { items };
  });
  store.set({ selectedItemUid: copy.uid });
}

export function moveItem(uid: string, dir: -1 | 1): void {
  updateConfig((c) => {
    const idx = c.items.findIndex((i) => i.uid === uid);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= c.items.length) return c;
    const items = [...c.items];
    [items[idx], items[j]] = [items[j], items[idx]];
    return { items };
  });
}

export function setItemWeapon(uid: string, entity: MapEntity): void {
  patchItem(uid, (i) => ({ ...i, hammerid: entity.hammerId, templated: entity.source.templated ? true : i.templated }));
}

export function addHandler(itemUid: string, entity?: MapEntity): void {
  let h: HandlerConfig;
  if (entity) {
    const s = suggestHandler(entity, store.get().graph ?? undefined);
    h = newHandler({
      type: s.type,
      hammerid: entity.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
      cooldown: s.cooldown ?? 0,
    });
  } else {
    h = newHandler();
  }
  patchItem(itemUid, (i) => ({ ...i, handlers: [...i.handlers, h] }));
}

export function updateHandler(itemUid: string, handlerUid: string, patch: Partial<HandlerConfig>): void {
  patchItem(itemUid, (i) => ({ ...i, handlers: i.handlers.map((h) => (h.uid === handlerUid ? { ...h, ...patch } : h)) }));
}

export function removeHandler(itemUid: string, handlerUid: string): void {
  patchItem(itemUid, (i) => ({ ...i, handlers: i.handlers.filter((h) => h.uid !== handlerUid) }));
}

export function moveHandler(itemUid: string, handlerUid: string, dir: -1 | 1): void {
  patchItem(itemUid, (i) => {
    const idx = i.handlers.findIndex((h) => h.uid === handlerUid);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= i.handlers.length) return i;
    const handlers = [...i.handlers];
    [handlers[idx], handlers[j]] = [handlers[j], handlers[idx]];
    return { ...i, handlers };
  });
}

export function addTrigger(itemUid: string, hammerid: string): void {
  patchItem(itemUid, (i) => (i.triggers.includes(hammerid) ? i : { ...i, triggers: [...i.triggers, hammerid] }));
}

export function removeTrigger(itemUid: string, hammerid: string): void {
  patchItem(itemUid, (i) => ({ ...i, triggers: i.triggers.filter((t) => t !== hammerid) }));
}

export function importConfigText(text: string, mode: 'replace' | 'append'): { count: number; warnings: string[] } {
  const { config, warnings } = parseEntWatchConfig(text);
  // comments written by this tool ("hammerid": "123", // classname name) double as re-match hints
  const hints: HintMap = new Map(store.get().hints);
  for (const [k, v] of hintsFromJsonc(text)) if (!hints.has(k)) hints.set(k, v);
  store.set({ hints, remapReport: null });
  updateConfig((c) => ({ items: mode === 'replace' ? config.items : [...c.items, ...config.items] }));
  store.set({ selectedItemUid: config.items[0]?.uid ?? store.get().selectedItemUid, suggestionNotes: [] });
  return { count: config.items.length, warnings };
}

export function clearConfig(): void {
  updateConfig(() => ({ items: [] }));
  store.set({ selectedItemUid: null, suggestionNotes: [], remapReport: null });
}

/** Re-resolves hammerids that are missing or point at a different entity, using the hints. */
export function remapNow(): { changed: number; unresolved: number } {
  const { graph, config, hints } = store.get();
  if (!graph) return { changed: 0, unresolved: 0 };
  const r = remapConfig(config, graph, hints);
  const newHints: HintMap = new Map(hints);
  for (const c of r.changes) newHints.set(c.to, hints.get(c.from) ?? { classname: c.entity.classname, targetname: c.entity.targetname || undefined });
  store.set({ hints: newHints, remapReport: { changes: r.changes, unresolved: r.unresolved } });
  updateConfig(() => r.config);
  return { changed: r.changes.length, unresolved: r.unresolved.length };
}

/** Applies one candidate chosen by the user for an unresolved hammerid. */
export function pickRemapCandidate(from: string, entity: MapEntity): void {
  const { hints, remapReport } = store.get();
  const newHints: HintMap = new Map(hints);
  newHints.set(entity.hammerId, hints.get(from) ?? { classname: entity.classname, targetname: entity.targetname || undefined });
  store.set({
    hints: newHints,
    remapReport: remapReport
      ? {
          changes: [...remapReport.changes, { from, to: entity.hammerId, entity, reason: 'chosen manually' }],
          unresolved: remapReport.unresolved.filter((u) => u.hammerid !== from),
        }
      : null,
  });
  updateConfig((c) => replaceHammerId(c, from, entity.hammerId));
}

export function clearRemapReport(): void {
  store.set({ remapReport: null });
}

/** Downloads every entity (props + connections) as JSON, for sharing a map's wiring without the map. */
export function exportEntityDump(): void {
  const { map } = store.get();
  if (!map) return;
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
  const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${map.mapName}.entities.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
