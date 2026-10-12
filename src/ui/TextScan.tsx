import { useMemo, useState } from 'react';
import { exportTranslationTable, groupTexts, scanTexts, translationOf, type TextGroup, type TextHit, type TextLang } from '../model/stripperText';
import { EntityChip } from './EntityChip';
import { showToast } from './actions';
import { importTranslations, translateText } from './stripperActions';
import { useAppState } from './store';
import { useT } from './useT';

const MAX_ROWS = 300;

type LangFilter = TextLang | 'all';

function where(h: TextHit): string {
  return h.kind === 'key' ? h.key : `${h.connection.output} → ${h.connection.target}.${h.connection.input}`;
}

function saveText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Translation input that commits on blur or Enter, so typing does not rewrite the config on every key. */
function TranslationInput({ group, current }: { group: TextGroup; current: string }) {
  const t = useT();
  const [draft, setDraft] = useState(current);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    // the config changed elsewhere (import, undo by editing the action): show its value
    setSeen(current);
    setDraft(current);
  }
  const commit = () => {
    if (draft !== current) translateText(group, draft);
  };
  return (
    <textarea
      className="input mono tx-input"
      rows={Math.min(4, Math.max(2, group.text.split('\n').length))}
      value={draft}
      placeholder={t('tx.placeholder')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
      }}
      data-testid="tx-input"
    />
  );
}

export function TextScan() {
  const t = useT();
  const { map, stripper } = useAppState();
  const [lang, setLang] = useState<LangFilter>('zh');
  const [query, setQuery] = useState('');
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const groups = useMemo(() => (map ? groupTexts(scanTexts(map.entities)) : []), [map]);
  const counts = useMemo(() => {
    const c: Record<LangFilter, number> = { all: groups.length, zh: 0, ja: 0, ko: 0 };
    for (const g of groups) c[g.lang] += 1;
    return c;
  }, [groups]);
  const inLang = useMemo(() => groups.filter((g) => lang === 'all' || g.lang === lang), [groups, lang]);
  const mapName = map?.mapName ?? 'map';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { group: TextGroup; current: string }[] = [];
    for (const g of inLang) {
      const current = translationOf(stripper, g.hits[0], mapName) ?? '';
      if (untranslatedOnly && current !== '') continue;
      if (q && !`${g.text} ${current} ${g.hits.map(where).join(' ')}`.toLowerCase().includes(q)) continue;
      out.push({ group: g, current });
      if (out.length >= MAX_ROWS) break;
    }
    return out;
  }, [inLang, stripper, mapName, query, untranslatedOnly]);
  const translated = useMemo(() => inLang.filter((g) => translationOf(stripper, g.hits[0], mapName) !== undefined).length, [inLang, stripper, mapName]);

  if (!map) return null;

  const doImport = (text: string) => {
    try {
      const n = importTranslations(text, inLang);
      showToast(t('tx.imported', { n }));
      setImportOpen(false);
      setImportText('');
    } catch (err) {
      showToast(`${t('tx.importError')}: ${String(err)}`);
    }
  };

  return (
    <div className="io-search" data-testid="text-scan">
      <div className="io-controls">
        <select value={lang} onChange={(e) => setLang(e.target.value as LangFilter)} data-testid="tx-lang">
          {(['zh', 'ja', 'ko', 'all'] as const).map((l) => (
            <option key={l} value={l}>
              {t(`tx.lang.${l}`)} ({counts[l]})
            </option>
          ))}
        </select>
        <input className="input" placeholder={t('tx.search')} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="tx-query" />
        <label className="check small">
          <input type="checkbox" checked={untranslatedOnly} onChange={(e) => setUntranslatedOnly(e.target.checked)} /> {t('tx.untranslatedOnly')}
        </label>
        <span className="muted small" data-testid="tx-count">
          {t('tx.count', { n: inLang.length, done: translated })}
        </span>
      </div>
      <div className="io-controls">
        <button type="button" className="btn" disabled={inLang.length === 0} onClick={() => saveText(exportTranslationTable(inLang, stripper, mapName), `${mapName}.translation.json`)} data-testid="tx-export">
          {t('tx.export')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={inLang.length === 0}
          onClick={() => {
            void navigator.clipboard?.writeText(exportTranslationTable(inLang, stripper, mapName)).then(() => showToast(t('json.copied')));
          }}
        >
          {t('tx.copy')}
        </button>
        <label className="btn">
          {t('tx.import')}
          <input
            type="file"
            accept=".json,.txt,.tsv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void file.text().then(doImport);
            }}
            data-testid="tx-import-file"
          />
        </label>
        <button type="button" className="btn" onClick={() => setImportOpen(!importOpen)} data-testid="tx-import-paste">
          {t('tx.importPaste')}
        </button>
      </div>
      {importOpen && (
        <div className="io-controls">
          <textarea className="input mono" rows={5} value={importText} placeholder={t('tx.importPlaceholder')} onChange={(e) => setImportText(e.target.value)} data-testid="tx-import-text" />
          <button type="button" className="btn primary" disabled={importText.trim() === ''} onClick={() => doImport(importText)} data-testid="tx-import-apply">
            {t('tx.importApply')}
          </button>
        </div>
      )}
      <div className="muted small io-hint">{t('tx.hint')}</div>
      <div className="panel-body">
        <table className="io tx-table">
          <thead>
            <tr>
              <th>{t('tx.col.original')}</th>
              <th>{t('tx.col.translation')}</th>
              <th>{t('tx.col.where')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, current }) => (
              <tr key={group.text} data-testid="tx-row" className={current ? 'tx-done' : ''}>
                <td className="mono tx-original">
                  {group.text}
                  {group.lang !== 'zh' && <span className="muted small"> [{group.lang}]</span>}
                </td>
                <td>
                  <TranslationInput group={group} current={current} />
                </td>
                <td>
                  <div className="tx-where">
                    {group.hits.slice(0, 3).map((h, i) => (
                      <div key={i} className="small">
                        <EntityChip entity={h.entity} /> <span className="mono muted">{where(h)}</span>
                      </div>
                    ))}
                    {group.hits.length > 3 && <span className="muted small">{t('tx.more', { n: group.hits.length - 3 })}</span>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  {groups.length === 0 ? t('tx.none') : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
