import { useMemo, useState } from 'react';
import { GLOBAL_LUMP, GLOBAL_MAP, MAIN_LUMP, serializeStripperConfig, targetsOfEntities } from '../model/stripper';
import { makeZip } from '../model/zip';
import type { StripperIssue } from '../model/stripperValidate';
import { setJsonComments, showToast } from './actions';
import type { StringKey } from './i18n';
import { describeAction, importStripperText, setStripperFile } from './stripperActions';
import { useAppState } from './store';
import { useT } from './useT';

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StripperJsonPanel({ issues }: { issues: StripperIssue[] }) {
  const t = useT();
  const { stripper, map, jsonComments, stripperFile } = useAppState();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTarget, setImportTarget] = useState(MAIN_LUMP);
  const [importError, setImportError] = useState<string | null>(null);
  const mapName = map?.mapName ?? 'map';

  const files = useMemo(() => serializeStripperConfig(stripper, mapName, { comments: jsonComments }), [stripper, mapName, jsonComments]);
  const current = files.find((f) => f.target === stripperFile) ?? files[0];
  const importTargets = useMemo(() => [...new Set([...(map ? targetsOfEntities(map.entities, map.mapName) : [MAIN_LUMP]), GLOBAL_MAP, GLOBAL_LUMP])], [map]);

  const fileName = (path: string) => path.split('/').pop() ?? path;

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = current.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(t('json.copied'));
  };

  const downloadAll = () => {
    const enc = new TextEncoder();
    const zip = makeZip(files.map((f) => ({ path: `addons/StripperCS2/${f.path}`, data: enc.encode(f.text) })));
    saveBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `${mapName}.stripper.zip`);
  };

  const doImport = (mode: 'replace' | 'append') => {
    try {
      const r = importStripperText(importText, importTarget, mode);
      setImportError(null);
      setImportOpen(false);
      setImportText('');
      showToast(`${r.count} actions${r.warnings.length ? ` (${r.warnings.slice(0, 3).join('; ')})` : ''}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportText(await file.text());
    // a file named like a lump (default_ents.jsonc) says where it belongs
    const stem = file.name.replace(/\.jsonc?$/i, '');
    if (stem === 'global_map') setImportTarget(GLOBAL_MAP);
    else if (stem === 'global_lump' || stem === 'global') setImportTarget(GLOBAL_LUMP);
    else if (importTargets.includes(stem)) setImportTarget(stem);
    setImportOpen(true);
  };

  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.filter((i) => i.level === 'warning').length;
  const label = (target: string) => (target === GLOBAL_MAP ? 'global_map' : target === GLOBAL_LUMP ? 'global_lump' : target);

  return (
    <div className="panel json-panel" data-testid="stripper-json-panel">
      <div className="panel-head row">
        <strong>{t('stj.title')}</strong>
        <span className="spacer" />
        <label className="check small">
          <input type="checkbox" checked={jsonComments} onChange={(e) => setJsonComments(e.target.checked)} /> {t('json.comments')}
        </label>
        <button type="button" className="btn" onClick={() => void copy()} disabled={!current} data-testid="copy-stripper">
          {t('json.copy')}
        </button>
        <button type="button" className="btn primary" disabled={!current} onClick={() => current && saveBlob(new Blob([current.text], { type: 'application/json' }), fileName(current.path))} data-testid="download-stripper">
          {t('stj.download')}
        </button>
        {files.length > 1 && (
          <button type="button" className="btn" onClick={downloadAll} title={t('stj.zipHint')} data-testid="download-stripper-zip">
            {t('stj.downloadAll')}
          </button>
        )}
        <label className="btn">
          {t('json.import')}
          <input type="file" accept=".jsonc,.json,.txt" style={{ display: 'none' }} onChange={(e) => void onImportFile(e.target.files?.[0])} data-testid="import-stripper-file" />
        </label>
        <button type="button" className="btn" onClick={() => setImportOpen(!importOpen)} data-testid="import-stripper-paste">
          {t('json.importPaste')}
        </button>
      </div>
      {importOpen && (
        <div className="import-box">
          <label className="inline small">
            {t('stj.importTarget')}
            <select className="input" value={importTarget} onChange={(e) => setImportTarget(e.target.value)} data-testid="import-stripper-target">
              {importTargets.map((o) => (
                <option key={o} value={o}>
                  {label(o)}
                </option>
              ))}
            </select>
          </label>
          <textarea className="textarea" rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={t('json.importPlaceholder')} data-testid="import-stripper-text" />
          {importError && <div className="warn small">{importError}</div>}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => doImport('replace')} data-testid="import-stripper-replace">
              {t('json.importApply')}
            </button>
            <button type="button" className="btn" onClick={() => doImport('append')}>
              {t('json.importMerge')}
            </button>
          </div>
        </div>
      )}
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
            {issues.slice(0, 10).map((i, idx) => {
              const a = stripper.actions.find((x) => x.uid === i.actionUid);
              return (
                <li key={idx} className={`issue ${i.level}`}>
                  <span className="mono">{a ? describeAction(a).slice(0, 48) : '?'}</span>: {t(i.key as StringKey)}
                  {i.detail ? ` (${i.detail})` : ''}
                </li>
              );
            })}
            {issues.length > 10 && <li className="muted">…</li>}
          </ul>
        )}
      </div>
      {files.length > 0 && (
        <div className="tabs file-tabs">
          {files.map((f) => (
            <button key={f.target} type="button" className={f.target === current?.target ? 'on' : ''} onClick={() => setStripperFile(f.target)} data-testid="stripper-file-tab">
              {label(f.target)}
            </button>
          ))}
        </div>
      )}
      <div className="muted small pad-x">
        {current ? t('stj.path', { path: current.path }) : t('stj.noFiles')} · {t('stj.lumpHelp')}
      </div>
      <textarea className="textarea json" readOnly value={current?.text ?? ''} data-testid="stripper-json-output" spellCheck={false} />
    </div>
  );
}
