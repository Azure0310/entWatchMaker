import { clearRemapReport, pickRemapCandidate, remapNow, showToast } from './actions';
import { EntityChip } from './EntityChip';
import { useAppState } from './store';
import { useT } from './useT';
import type { ValidationIssue } from '../model/validate';

const STALE_KEYS = new Set(['v.itemNotInMap', 'v.handlerNotInMap', 'v.triggerNotInMap', 'v.idPointsElsewhere']);

export function RemapPanel({ issues }: { issues: ValidationIssue[] }) {
  const t = useT();
  const { remapReport, hints, graph } = useAppState();
  const staleCount = issues.filter((i) => STALE_KEYS.has(i.key)).length;
  if (!graph) return null;
  if (staleCount === 0 && !remapReport) return null;

  return (
    <div className="remap-panel" data-testid="remap-panel">
      {staleCount > 0 && (
        <div className="row">
          <span className="warn small">{t('remap.stale', { n: staleCount })}</span>
          <button
            type="button"
            className="btn"
            data-testid="remap-now"
            disabled={hints.size === 0}
            title={hints.size === 0 ? t('remap.noHints') : ''}
            onClick={() => {
              const r = remapNow();
              showToast(t('remap.done', { changed: r.changed, unresolved: r.unresolved }));
            }}
          >
            {t('remap.button')}
          </button>
        </div>
      )}
      {hints.size === 0 && staleCount > 0 && <div className="muted small">{t('remap.noHints')}</div>}
      {remapReport && (
        <div className="remap-report">
          {remapReport.changes.length > 0 && (
            <ul className="issues">
              {remapReport.changes.map((c, i) => (
                <li key={i} className="issue info">
                  <span className="mono">{c.from}</span> → <span className="mono">{c.to}</span> <EntityChip entity={c.entity} showId={false} />{' '}
                  <span className="muted">({c.reason})</span>
                </li>
              ))}
            </ul>
          )}
          {remapReport.unresolved.map((u) => (
            <div key={u.hammerid} className="remap-unresolved" data-testid="remap-unresolved">
              <span className="mono">{u.hammerid}</span>{' '}
              <span className="muted small">
                {u.hint ? `${u.hint.classname ?? ''} ${u.hint.targetname ?? ''}` : t('remap.noHint')}
              </span>
              {u.candidates.length > 0 ? (
                <span className="chips">
                  {u.candidates.map((c) => (
                    <EntityChip key={c.id} entity={c} onClick={() => pickRemapCandidate(u.hammerid, c)} />
                  ))}
                </span>
              ) : (
                <span className="warn small"> {t('remap.noCandidates')}</span>
              )}
            </div>
          ))}
          <button type="button" className="mini" onClick={() => clearRemapReport()}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
