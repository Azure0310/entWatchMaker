import { useMemo, useState } from 'react';
import { serializeEntWatchConfig } from '../model/entwatch';
import { friendlyName } from '../model/entity';
import type { ValidationIssue } from '../model/validate';
import { importConfigText, setJsonComments, showToast } from './actions';
import { useAppState } from './store';
import { useT } from './useT';
import type { StringKey } from './i18n';
import { RemapPanel } from './RemapPanel';

export function JsonPanel({ issues }: { issues: ValidationIssue[] }) {
  const t = useT();
  const { config, graph, map, jsonComments } = useAppState();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const text = useMemo(
    () =>
      serializeEntWatchConfig(config, {
        comments: jsonComments,
        describeHammerId: (hid) => {
          if (!graph) return undefined;
          const ents = graph.byHammerId.get(hid);
          if (!ents || ents.length === 0) return 'NOT FOUND IN MAP';
          const e = ents[0];
          const name = friendlyName(e.targetname);
          return `${e.classname}${name ? ' ' + name : ''}${e.source.templated ? ' (templated)' : ''}`;
        },
      }),
    [config, graph, jsonComments],
  );

  const fileName = `${map?.mapName ?? 'map'}.jsonc`;

  const download = () => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('json.copied'));
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(t('json.copied'));
    }
  };

  const doImport = (mode: 'replace' | 'append') => {
    try {
      const r = importConfigText(importText, mode);
      setImportError(null);
      setImportOpen(false);
      setImportText('');
      showToast(`${r.count} items${r.warnings.length ? ` (${r.warnings.join('; ')})` : ''}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportText(await file.text());
    setImportOpen(true);
  };

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;

  return (
    <div className="panel json-panel">
      <div className="panel-head row">
        <strong>{t('json.title')}</strong>
        <span className="mono small muted">{fileName}</span>
        <span className="spacer" />
        <label className="check small">
          <input type="checkbox" checked={jsonComments} onChange={(e) => setJsonComments(e.target.checked)} /> {t('json.comments')}
        </label>
        <button type="button" className="btn" onClick={() => void copy()} data-testid="copy-json">
          {t('json.copy')}
        </button>
        <button type="button" className="btn primary" onClick={download} data-testid="download-json">
          {t('json.download')}
        </button>
        <label className="btn">
          {t('json.import')}
          <input type="file" accept=".jsonc,.json,.txt" style={{ display: 'none' }} onChange={(e) => void onImportFile(e.target.files?.[0])} data-testid="import-file" />
        </label>
        <button type="button" className="btn" onClick={() => setImportOpen(!importOpen)} data-testid="import-paste">
          {t('json.importPaste')}
        </button>
      </div>
      {importOpen && (
        <div className="import-box">
          <textarea className="textarea" rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={t('json.importPlaceholder')} data-testid="import-text" />
          {importError && <div className="warn small">{importError}</div>}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => doImport('replace')} data-testid="import-replace">
              {t('json.importApply')}
            </button>
            <button type="button" className="btn" onClick={() => doImport('append')}>
              {t('json.importMerge')}
            </button>
          </div>
        </div>
      )}
      <RemapPanel issues={issues} />
      <div className="issues-summary">
        <strong>{t('json.issues')}:</strong>{' '}
        {issues.length === 0 ? (
          <span className="ok-text">{t('json.noIssues')}</span>
        ) : (
          <span>
            <span className="err-text">{errors} error</span> / <span className="warn">{warnings} warning</span> / {issues.length - errors - warnings} info
          </span>
        )}
        {issues.length > 0 && (
          <ul className="issues compact">
            {issues.slice(0, 12).map((i, idx) => {
              const item = config.items.find((it) => it.uid === i.itemUid);
              return (
                <li key={idx} className={`issue ${i.level}`}>
                  <span className="mono">{item?.name || item?.hammerid || '?'}</span>: {t(i.key as StringKey)}
                  {i.detail ? ` (${i.detail})` : ''}
                </li>
              );
            })}
            {issues.length > 12 && <li className="muted">…</li>}
          </ul>
        )}
      </div>
      <div className="muted small pad-x">{t('json.path', { name: map?.mapName ?? 'mapname' })}</div>
      <textarea className="textarea json" readOnly value={text} data-testid="json-output" spellCheck={false} />
    </div>
  );
}
