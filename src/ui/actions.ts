import { store, type AppState } from './store';
import { buildGraph } from './store';
import type { MapEntity, ParsedMap } from '../model/entity';
import { friendlyName } from '../model/entity';
import { newHandler, newItem, parseEntWatchConfig, serializeEntWatchConfig, type EntWatchConfig, type HandlerConfig, type ItemConfig } from '../model/entwatch';
import { suggestHandler, suggestItemForWeapon } from '../model/suggest';
import { parseMapFiles } from '../worker/client';
import { buildDemoMap } from '../model/demo';
import type { Lang } from './i18n';

const CONFIG_KEY = (mapName: string) => `entwatchmaker.config.${mapName}`;

function persistConfig(): void {
  const { map, config } = store.get();
  if (!map) return;
  try {
    if (config.items.length === 0) localStorage.removeItem(CONFIG_KEY(map.mapName));
    else localStorage.setItem(CONFIG_KEY(map.mapName), serializeEntWatchConfig(config, { comments: false }));
  } catch {
    // storage unavailable
  }
}

function restoreConfig(mapName: string): EntWatchConfig | null {
  try {
    const text = localStorage.getItem(CONFIG_KEY(mapName));
    if (!text) return null;
    return parseEntWatchConfig(text).config;
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
  const restored = restoreConfig(map.mapName);
  const firstWeapon = map.entities.find((e) => e.classname.startsWith('weapon_')) ?? map.entities[0] ?? null;
  store.set({
    map,
    graph,
    loading: { active: false, message: '' },
    error: null,
    config: restored ?? { items: [] },
    selectedItemUid: restored?.items[0]?.uid ?? null,
    selectedEntityId: firstWeapon?.id ?? null,
    treeRootId: firstWeapon?.id ?? null,
    suggestionNotes: [],
    weaponsOnly: map.stats.weapons > 0,
    query: '',
  });
  if (restored) showToast(store.get().lang === 'ja' ? '前回の設定を復元しました' : 'Restored your previous config for this map');
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
  store.set({ map: null, graph: null, selectedEntityId: null, treeRootId: null, config: { items: [] }, selectedItemUid: null, error: null, suggestionNotes: [] });
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
    const s = suggestHandler(entity);
    h = newHandler({
      type: s.type,
      hammerid: entity.hammerId,
      event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event,
      mode: s.mode,
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
  updateConfig((c) => ({ items: mode === 'replace' ? config.items : [...c.items, ...config.items] }));
  store.set({ selectedItemUid: config.items[0]?.uid ?? store.get().selectedItemUid, suggestionNotes: [] });
  return { count: config.items.length, warnings };
}

export function clearConfig(): void {
  updateConfig(() => ({ items: [] }));
  store.set({ selectedItemUid: null, suggestionNotes: [] });
}
