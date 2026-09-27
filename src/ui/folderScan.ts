/**
 * Lets the user pick a local folder (e.g. Steam's workshop content folder) with the
 * File System Access API and lists the maps inside it. Chrome / Edge only; nothing is uploaded.
 */

export interface FoundMap {
  /** Display name (map name without extension). */
  name: string;
  /** Folder path relative to the picked root. */
  folder: string;
  kind: 'vpk' | 'vmap';
  /** Files to feed to the parser (dir vpk + parts, or vmap + prefabs). */
  files: File[];
  size: number;
}

interface DirHandleLike {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<DirHandleLike | FileHandleLike>;
  queryPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

type PickerWindow = Window & { showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<DirHandleLike> };

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

const DB_NAME = 'entwatchmaker';
const STORE = 'folders';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: DirHandleLike): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, 'last');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore: storing handles is a convenience only
  }
}

export async function loadSavedHandle(): Promise<DirHandleLike | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('last');
      req.onsuccess = () => resolve((req.result as DirHandleLike) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function pickFolder(): Promise<DirHandleLike> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('This browser does not support picking folders (use Chrome or Edge)');
  const handle = await picker({ id: 'entwatchmaker-maps', mode: 'read' });
  await saveHandle(handle);
  return handle;
}

export async function ensurePermission(handle: DirHandleLike): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true;
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}

interface RawFile {
  folder: string;
  file: File;
}

async function collect(dir: DirHandleLike, folder: string, depth: number, out: RawFile[], budget: { left: number }): Promise<void> {
  if (depth > 5 || budget.left <= 0) return;
  for await (const entry of dir.values()) {
    if (budget.left-- <= 0) return;
    if (entry.kind === 'file') {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.vpk') || lower.endsWith('.vmap')) {
        out.push({ folder, file: await entry.getFile() });
      }
    } else if (entry.kind === 'directory') {
      const lower = entry.name.toLowerCase();
      if (lower === 'node_modules' || lower.startsWith('.')) continue;
      await collect(entry, folder ? `${folder}/${entry.name}` : entry.name, depth + 1, out, budget);
    }
  }
}

/** Scans a folder for maps: split vpks are grouped, vmaps get the prefabs next to them. */
export async function scanFolder(handle: DirHandleLike): Promise<FoundMap[]> {
  const raw: RawFile[] = [];
  await collect(handle, '', 0, raw, { left: 20000 });

  const maps: FoundMap[] = [];
  // vpks: group by folder + base name
  const groups = new Map<string, RawFile[]>();
  for (const r of raw) {
    if (!r.file.name.toLowerCase().endsWith('.vpk')) continue;
    const base = r.file.name.replace(/_(dir|\d{3})\.vpk$/i, '').replace(/\.vpk$/i, '');
    const key = `${r.folder}/${base.toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  for (const [, list] of groups) {
    const dirFile = list.find((r) => /_dir\.vpk$/i.test(r.file.name)) ?? list.find((r) => !/_\d{3}\.vpk$/i.test(r.file.name));
    if (!dirFile) continue; // only numbered parts, unusable
    // skip pak01_dir style game packs
    if (/^pak\d+/i.test(dirFile.file.name)) continue;
    maps.push({
      name: dirFile.file.name.replace(/_dir\.vpk$/i, '').replace(/\.vpk$/i, ''),
      folder: dirFile.folder,
      kind: 'vpk',
      files: list.map((r) => r.file),
      size: list.reduce((n, r) => n + r.file.size, 0),
    });
  }
  // vmaps: every vmap outside a prefabs folder, bundled with prefab vmaps found anywhere in the scan
  const prefabs = raw.filter((r) => r.file.name.toLowerCase().endsWith('.vmap') && /(^|\/)prefabs(\/|$)/i.test(r.folder));
  for (const r of raw) {
    if (!r.file.name.toLowerCase().endsWith('.vmap')) continue;
    if (/(^|\/)prefabs(\/|$)/i.test(r.folder)) continue;
    maps.push({
      name: r.file.name.replace(/\.vmap$/i, ''),
      folder: r.folder,
      kind: 'vmap',
      files: [r.file, ...prefabs.map((p) => p.file)],
      size: r.file.size,
    });
  }
  maps.sort((a, b) => a.name.localeCompare(b.name));
  return maps;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
