/**
 * Stripper config state that has to be kept in step with the loaded map: persistence per map
 * name and the simulation of the config over the loaded entities. Kept apart from the editing
 * actions so loading a map can use it without importing them.
 */
import type { StripperConfig } from '../model/stripper';
import { activeTargets } from '../model/stripper';
import { simulateStripper } from '../model/stripperMatch';
import { store } from './store';

const STRIPPER_KEY = (mapName: string) => `entwatchmaker.stripper.${mapName}`;

export function persistStripper(): void {
  const { map, stripper } = store.get();
  if (!map) return;
  try {
    if (stripper.actions.length === 0) localStorage.removeItem(STRIPPER_KEY(map.mapName));
    else localStorage.setItem(STRIPPER_KEY(map.mapName), JSON.stringify({ version: 1, actions: stripper.actions }));
  } catch {
    // storage unavailable
  }
}

export function restoreStripper(mapName: string): StripperConfig | null {
  try {
    const text = localStorage.getItem(STRIPPER_KEY(mapName));
    if (!text) return null;
    const data = JSON.parse(text) as { actions?: StripperConfig['actions'] };
    return Array.isArray(data.actions) ? { actions: data.actions } : null;
  } catch {
    return null;
  }
}

/** Re-runs the config over the loaded map and keeps the output tab on a file that still exists. */
export function refreshStripperSim(): void {
  const { map, stripper, stripperFile, selectedActionUid } = store.get();
  const files = activeTargets(stripper);
  store.set({
    stripperSim: map ? simulateStripper(map.entities, stripper, map.mapName) : null,
    stripperFile: stripperFile && files.includes(stripperFile) ? stripperFile : (files[0] ?? null),
    selectedActionUid: selectedActionUid && stripper.actions.some((a) => a.uid === selectedActionUid) ? selectedActionUid : null,
  });
}

/** Applies an edit to the stripper config, then saves it and refreshes the simulation. */
export function setStripper(fn: (config: StripperConfig) => StripperConfig): void {
  store.set((s) => ({ stripper: fn(s.stripper) }));
  persistStripper();
  refreshStripperSim();
}
