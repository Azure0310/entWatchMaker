import { useCallback, useRef, useState, type DragEvent } from 'react';
import { loadDemo, loadFiles, setFoundMaps } from './actions';
import { dropHasDirectory, scanDroppedItems } from './folderScan';
import { useAppState } from './store';
import { useT } from './useT';
import { FolderPicker } from './FolderPicker';

export function DropZone({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { loading, error } = useAppState();
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setOver(false);
    if (dropHasDirectory(ev.dataTransfer.items)) {
      // a folder was dropped: list the maps inside instead of parsing straight away
      void scanDroppedItems(ev.dataTransfer.items).then((found) => setFoundMaps(found));
      return;
    }
    const files = Array.from(ev.dataTransfer.files);
    void loadFiles(files);
  }, []);

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      data-testid="dropzone"
    >
      <div className="dropzone-title">{t('drop.title')}</div>
      {!compact && <div className="dropzone-hint">{t('drop.hint')}</div>}
      <div className="dropzone-actions">
        <button type="button" className="btn primary" onClick={() => inputRef.current?.click()}>
          {t('drop.button')}
        </button>
        <button type="button" className="btn" onClick={() => loadDemo()} data-testid="load-demo">
          {t('drop.demo')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".vpk,.vmap"
          style={{ display: 'none' }}
          data-testid="file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void loadFiles(files);
          }}
        />
      </div>
      {loading.active && (
        <div className="dropzone-status" data-testid="loading">
          <span className="spinner" /> {t('drop.loading')} {loading.message}
          {loading.total ? ` (${loading.done ?? 0}/${loading.total})` : ''}
        </div>
      )}
      {error && (
        <div className="dropzone-error" data-testid="load-error">
          {t('drop.error')}: {error}
        </div>
      )}
      {!compact && <FolderPicker />}
    </div>
  );
}
