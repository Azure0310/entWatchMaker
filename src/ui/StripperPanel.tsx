import { useMemo } from 'react';
import { GLOBAL_LUMP, GLOBAL_MAP, activeTargets, targetsOfEntities, type KV, type StripperAction } from '../model/stripper';
import { availableStrategies, type MatchStrategy } from '../model/stripperBuild';
import type { StripperIssue } from '../model/stripperValidate';
import type { StringKey } from './i18n';
import { EntityChip } from './EntityChip';
import { selectEntity } from './actions';
import { IoListEditor, IoRow, KvEditor } from './StripperEditors';
import {
  addBlankAction,
  applyMatchStrategy,
  clearStripper,
  describeAction,
  duplicateAction,
  moveAction,
  removeAction,
  selectAction,
  updateAction,
} from './stripperActions';
import { useAppState } from './store';
import { useT } from './useT';

const COMMON_KEYS = ['classname', 'targetname', 'hammeruniqueid', 'origin', 'angles', 'model', 'parentname', 'spawnflags', 'speed', 'wait', 'damage', 'renderamt', 'rendercolor', 'filtername', 'startdisabled'];

const STRATEGY_LABEL: Record<MatchStrategy, StringKey> = {
  id: 'st.by.id',
  name: 'st.by.name',
  origin: 'st.by.origin',
  class: 'st.by.class',
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="st-sec">
      <h5>
        {title}
        {hint && <span className="muted small"> — {hint}</span>}
      </h5>
      {children}
    </div>
  );
}

function CountChip({ a }: { a: StripperAction }) {
  const t = useT();
  const { stripperSim } = useAppState();
  const result = stripperSim?.perAction.get(a.uid);
  if (a.kind === 'add') return <span className="cnt ok">{a.target === GLOBAL_LUMP ? t('st.createsPerLump') : t('st.creates')}</span>;
  if (!result) return <span className="cnt muted" title={t('st.noMap')}>—</span>;
  if (result.matched === 0) return <span className="cnt none">{t('st.matchedNone')}</span>;
  return <span className={`cnt ${result.matched === 1 ? 'ok' : 'many'}`}>{t('st.matched', { n: result.matched })}</span>;
}

function MatchBar({ uid }: { uid: string }) {
  const t = useT();
  const { graph, selectedEntityId } = useAppState();
  const e = graph && selectedEntityId !== null ? graph.byId.get(selectedEntityId) : null;
  if (!e) return null;
  return (
    <div className="match-bar small">
      <span className="muted">{t('st.matchFrom')}:</span>
      <EntityChip entity={e} showId={false} />
      {availableStrategies(e).map((s) => (
        <button key={s} type="button" className="mini pick" title={t(`${STRATEGY_LABEL[s]}.hint` as StringKey)} onClick={() => applyMatchStrategy(uid, e, s)} data-testid={`match-${s}`}>
          {t(STRATEGY_LABEL[s])}
        </button>
      ))}
    </div>
  );
}

function ActionBody({ a, targets, keyHints }: { a: StripperAction; targets: string[]; keyHints: string[] }) {
  const t = useT();
  const { stripperSim } = useAppState();
  const result = stripperSim?.perAction.get(a.uid);
  const patch = (p: Partial<StripperAction>) => updateAction(a.uid, (x) => ({ ...x, ...p }) as StripperAction);
  const setKv = (field: 'match' | 'replace' | 'delete' | 'insert' | 'keyvalues') => (rows: KV[]) => patch({ [field]: rows } as Partial<StripperAction>);
  const options = [...new Set([...targets, a.target])];

  return (
    <div className="st-body" data-testid="action-body">
      <div className="grid">
        <label>
          {t('st.target')}
          <select className="input" value={a.target} onChange={(e) => patch({ target: e.target.value })} data-testid="action-target">
            {options.map((o) => (
              <option key={o} value={o}>
                {o === GLOBAL_MAP ? t('st.target.globalMap') : o === GLOBAL_LUMP ? t('st.target.globalLump') : o}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('st.note')}
          <input className="input" value={a.note ?? ''} onChange={(e) => patch({ note: e.target.value || undefined })} />
        </label>
      </div>

      {a.kind === 'add' && (
        <>
          <Section title={t('st.keyvalues')}>
            <KvEditor rows={a.keyvalues} onChange={setKv('keyvalues')} keyHints={keyHints} listId={`kh-${a.uid}`} />
          </Section>
          <Section title={t('st.addIoOut')}>
            <IoListEditor rows={a.io} onChange={(io) => patch({ io })} withType />
          </Section>
        </>
      )}

      {(a.kind === 'filter' || a.kind === 'modify') && (
        <>
          <Section title={t('st.match')} hint={t('st.matchHint')}>
            <MatchBar uid={a.uid} />
            <KvEditor rows={a.match} onChange={setKv('match')} keyHints={keyHints} listId={`kh-${a.uid}`} />
          </Section>
          <Section title={t('st.matchIo')} hint={t('st.matchIoHint')}>
            <IoListEditor rows={a.kind === 'filter' ? a.io : a.matchIo} onChange={(io) => patch(a.kind === 'filter' ? { io } : { matchIo: io })} withType={false} />
          </Section>
        </>
      )}

      {a.kind === 'modify' && (
        <>
          <Section title={t('st.replace')} hint={t('st.replaceHint')}>
            <KvEditor rows={a.replace} onChange={setKv('replace')} keyHints={keyHints} listId={`kh-r-${a.uid}`} />
          </Section>
          <Section title={t('st.replaceIo')} hint={t('st.replaceIoHint')}>
            {a.replaceIo ? (
              <IoRow io={a.replaceIo} withType placeholders={a.matchIo[0]} onChange={(io) => patch({ replaceIo: io })} onRemove={() => patch({ replaceIo: undefined })} />
            ) : (
              <button type="button" className="mini add" onClick={() => patch({ replaceIo: {} })} data-testid="replace-io-add">
                {t('st.addIo')}
              </button>
            )}
          </Section>
          <Section title={t('st.delete')} hint={t('st.deleteHint')}>
            <KvEditor rows={a.delete} onChange={setKv('delete')} keyHints={keyHints} listId={`kh-d-${a.uid}`} />
          </Section>
          <Section title={t('st.deleteIo')}>
            <IoListEditor rows={a.deleteIo} onChange={(io) => patch({ deleteIo: io })} withType={false} />
          </Section>
          <Section title={t('st.insert')}>
            <KvEditor rows={a.insert} onChange={setKv('insert')} keyHints={keyHints} listId={`kh-i-${a.uid}`} />
          </Section>
          <Section title={t('st.insertIo')}>
            <IoListEditor rows={a.insertIo} onChange={(io) => patch({ insertIo: io })} withType />
          </Section>
        </>
      )}

      {result && result.samples.length > 0 && (
        <Section title={t('st.matchedEntities')}>
          <div className="chips">
            {result.samples.map((e) => (
              <EntityChip key={e.id} entity={e} onClick={() => selectEntity(e.id, true)} />
            ))}
            {result.matched > result.samples.length && <span className="muted small">+{result.matched - result.samples.length}</span>}
            {result.hitAdded > 0 && <span className="muted small">{t('st.matchedAdded', { n: result.hitAdded })}</span>}
          </div>
        </Section>
      )}
    </div>
  );
}

function ActionCard({ a, selected, issues, targets, keyHints }: { a: StripperAction; selected: boolean; issues: StripperIssue[]; targets: string[]; keyHints: string[] }) {
  const t = useT();
  const worst = issues.some((i) => i.level === 'error') ? 'error' : issues.some((i) => i.level === 'warning') ? 'warning' : issues.length > 0 ? 'info' : null;
  const stop = (fn: () => void) => (ev: React.MouseEvent) => {
    ev.stopPropagation();
    fn();
  };
  return (
    <div className={`st-card${selected ? ' selected' : ''}`} data-testid="action-card" data-kind={a.kind}>
      <div className="st-card-head" onClick={() => selectAction(selected ? null : a.uid)}>
        <span className={`kind-badge k-${a.kind}`}>{t(`st.kind.${a.kind}` as StringKey)}</span>
        <span className="st-sum mono" title={describeAction(a)}>
          {describeAction(a) || '—'}
        </span>
        <CountChip a={a} />
        {worst && <span className={`dot ${worst}`} />}
        <span className="st-card-actions">
          <button type="button" className="mini" title={t('st.up')} onClick={stop(() => moveAction(a.uid, -1))}>
            ↑
          </button>
          <button type="button" className="mini" title={t('st.down')} onClick={stop(() => moveAction(a.uid, 1))}>
            ↓
          </button>
          <button type="button" className="mini" title={t('st.duplicate')} onClick={stop(() => duplicateAction(a.uid))}>
            ⧉
          </button>
          <button type="button" className="mini danger" title={t('st.delete.action')} onClick={stop(() => removeAction(a.uid))} data-testid="action-delete">
            ✕
          </button>
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="issues st-issues">
          {issues.map((i, idx) => (
            <li key={idx} className={`issue ${i.level}`}>
              {t(i.key as StringKey)}
              {i.detail ? `: ${i.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
      {selected && <ActionBody a={a} targets={targets} keyHints={keyHints} />}
    </div>
  );
}

export function StripperPanel({ issues }: { issues: StripperIssue[] }) {
  const t = useT();
  const { stripper, stripperSim, selectedActionUid, map, graph, selectedEntityId } = useAppState();
  const targets = useMemo(() => [...new Set([...(map ? targetsOfEntities(map.entities, map.mapName) : ['default_ents']), ...activeTargets(stripper), GLOBAL_MAP, GLOBAL_LUMP])], [map, stripper]);
  const selected = graph && selectedEntityId !== null ? graph.byId.get(selectedEntityId) : null;
  const keyHints = useMemo(() => [...new Set([...(selected ? Object.keys(selected.props) : []), ...COMMON_KEYS])], [selected]);

  return (
    <div className="panel config-panel" data-testid="stripper-panel">
      <div className="panel-head">
        <div className="row-line">
          <strong>{t('st.title')}</strong>
          {stripperSim && (
            <span className="muted small" data-testid="stripper-stats">
              {t('st.stats', { r: stripperSim.removed, m: stripperSim.modified, a: stripperSim.added })}
            </span>
          )}
          <span className="spacer" />
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => addBlankAction('filter')} data-testid="add-filter">
            {t('st.addFilter')}
          </button>
          <button type="button" className="btn" onClick={() => addBlankAction('modify')} data-testid="add-modify">
            {t('st.addModify')}
          </button>
          <button type="button" className="btn" onClick={() => addBlankAction('add')} data-testid="add-add">
            {t('st.addAdd')}
          </button>
          {stripper.actions.length > 0 && (
            <button
              type="button"
              className="btn danger-btn"
              onClick={() => {
                if (window.confirm(t('st.clearAllConfirm', { n: stripper.actions.length }))) clearStripper();
              }}
              data-testid="clear-stripper"
            >
              {t('st.clearAll')}
            </button>
          )}
        </div>
      </div>
      <div className="panel-body config-body">
        <div className="notes small muted">{t('st.order')}</div>
        {stripper.actions.length === 0 && <div className="muted pad">{t('st.empty')}</div>}
        {stripper.actions.map((a) => (
          <ActionCard key={a.uid} a={a} selected={a.uid === selectedActionUid} issues={issues.filter((i) => i.actionUid === a.uid)} targets={targets} keyHints={keyHints} />
        ))}
      </div>
    </div>
  );
}
