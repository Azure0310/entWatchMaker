import { useSyncExternalStore } from 'react';
import type { ParsedMap } from '../model/entity';
import { EntityGraph } from '../model/graph';
import type { EntWatchConfig } from '../model/entwatch';
import { detectLang, type Lang } from './i18n';
import type { FoundMap } from './folderScan';
import type { HintMap, RemapChange, RemapUnresolved } from '../model/remap';

export interface LoadingState {
  active: boolean;
  message: string;
  done?: number;
  total?: number;
}

export interface AppState {
  lang: Lang;
  map: ParsedMap | null;
  graph: EntityGraph | null;
  loading: LoadingState;
  error: string | null;
  selectedEntityId: number | null;
  treeRootId: number | null;
  treeDepth: number;
  config: EntWatchConfig;
  selectedItemUid: string | null;
  query: string;
  weaponsOnly: boolean;
  suggestionNotes: string[];
  toast: string | null;
  jsonComments: boolean;
  /** Maps found by scanning a folder (picker or drag & drop). */
  foundMaps: { label: string; maps: FoundMap[] } | null;
  /** What each hammerid in the config pointed at (classname/targetname), for re-matching. */
  hints: HintMap;
  remapReport: { changes: RemapChange[]; unresolved: RemapUnresolved[] } | null;
}

const initialState: AppState = {
  lang: detectLang(),
  map: null,
  graph: null,
  loading: { active: false, message: '' },
  error: null,
  selectedEntityId: null,
  treeRootId: null,
  treeDepth: 3,
  config: { items: [] },
  selectedItemUid: null,
  query: '',
  weaponsOnly: true,
  suggestionNotes: [],
  toast: null,
  jsonComments: true,
  foundMaps: null,
  hints: new Map(),
  remapReport: null,
};

type Listener = () => void;

class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(state: AppState) {
    this.state = state;
  }

  get = (): AppState => this.state;

  set = (update: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void => {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  };

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const store = new Store(initialState);

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function buildGraph(map: ParsedMap): EntityGraph {
  return new EntityGraph(map.entities);
}
