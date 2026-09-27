import { useEffect, useState } from 'react';
import { loadFiles, setFoundMaps } from './actions';
import { ensurePermission, formatSize, loadSavedHandle, pickFolder, scanFolder, supportsDirectoryPicker } from './folderScan';
import { useAppState } from './store';
import { useT } from './useT';

type Handle = Awaited<ReturnType<typeof pickFolder>>;

export function FolderPicker() {
  const t = useT();
  const { foundMaps } = useAppState();
  const [supported] = useState(() => supportsDirectoryPicker());
  const [saved, setSaved] = useState<Handle | null>(null);
  const [handle, setHandle] = useState<Handle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const maps = foundMaps?.maps ?? null;

  useEffect(() => {
    if (!supported) return;
    void loadSavedHandle().then((h) => setSaved(h as Handle | null));
  }, [supported]);

  const scan = async (h: Handle) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await ensurePermission(h))) {
        setError(t('folder.denied'));
        return;
      }
      setHandle(h);
      setFoundMaps({ label: h.name, maps: await scanFolder(h) });
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    try {
      const h = await pickFolder();
      setSaved(h);
      await scan(h);
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const shown = (maps ?? []).filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="folder-picker" data-testid="folder-picker">
      <div className="dropzone-actions">
        {supported && (
          <button type="button" className="btn" onClick={() => void pick()} disabled={busy} data-testid="pick-folder">
            📁 {t('folder.pick')}
          </button>
        )}
        {saved && !handle && (
          <button type="button" className="btn" onClick={() => void scan(saved)} disabled={busy}>
            ↻ {t('folder.reopen', { name: saved.name })}
          </button>
        )}
        {handle && (
          <button type="button" className="btn" onClick={() => void scan(handle)} disabled={busy}>
            ↻ {t('folder.rescan')}
          </button>
        )}
      </div>
      <div className="muted small">{t('folder.hint')}</div>
      <div className="muted small">{t('folder.blockedHint')}</div>
      {busy && (
        <div className="dropzone-status">
          <span className="spinner" /> {t('folder.scanning')}
        </div>
      )}
      {error && <div className="dropzone-error">{error}</div>}
      {maps && (
        <div className="folder-results">
          <div className="row">
            <strong>
              {foundMaps?.label} — {t('folder.found', { n: maps.length })}
            </strong>
            <input className="input" placeholder={t('folder.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 240 }} />
          </div>
          {maps.length === 0 && <div className="muted small">{t('folder.none')}</div>}
          <div className="folder-list">
            {shown.slice(0, 200).map((m) => (
              <div key={`${m.folder}/${m.name}.${m.kind}`} className="folder-row" data-testid="folder-map">
                <span className={`badge ${m.kind}`}>{m.kind}</span>
                <span className="mono">{m.name}</span>
                <span className="muted small">{m.folder}</span>
                <span className="muted small">{formatSize(m.size)}</span>
                <span className="spacer" />
                <button type="button" className="btn primary" onClick={() => void loadFiles(m.files)}>
                  {t('folder.open')}
                </button>
              </div>
            ))}
            {shown.length > 200 && <div className="muted small">…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
