import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ENTWATCH_COLORS, HANDLER_MODES, type HandlerConfig, type HandlerType, type ItemConfig } from '../model/entwatch';
import { friendlyName } from '../model/entity';
import { outputChoices, suggestHandler } from '../model/suggest';
import { suggestEvents } from '../model/events';
import type { ValidationIssue } from '../model/validate';
import {
  addEmptyItem,
  addHandler,
  autoAddAllWeapons,
  clearConfig,
  duplicateItem,
  moveHandler,
  moveItem,
  removeHandler,
  removeItem,
  removeTrigger,
  selectEntity,
  selectItem,
  showToast,
  updateHandler,
  updateItem,
} from './actions';
import { useAppState } from './store';
import { useT } from './useT';
import type { StringKey } from './i18n';

function EntityRef({ hammerid }: { hammerid: string }) {
  const t = useT();
  const { graph } = useAppState();
  const ents = graph?.byHammerId.get(hammerid) ?? [];
  if (!hammerid) return <span className="muted small">—</span>;
  if (ents.length === 0) return <span className="warn small">{t('cfg.notInMap')}</span>;
  const e = ents[0];
  return (
    <button type="button" className="chip" onClick={() => selectEntity(e.id, true)} title={t('cfg.locate')}>
      <span className="chip-class">{e.classname}</span>
      {friendlyName(e.targetname) && <span className="chip-name">{friendlyName(e.targetname)}</span>}
      {ents.length > 1 && <span className="chip-id">×{ents.length}</span>}
    </button>
  );
}

function Issues({ issues }: { issues: ValidationIssue[] }) {
  const t = useT();
  if (issues.length === 0) return null;
  return (
    <ul className="issues">
      {issues.map((i, idx) => (
        <li key={idx} className={`issue ${i.level}`}>
          {t(i.key as StringKey)}
          {i.detail ? `: ${i.detail}` : ''}
        </li>
      ))}
    </ul>
  );
}

function HandlerEditor({ item, h, issues }: { item: ItemConfig; h: HandlerConfig; issues: ValidationIssue[] }) {
  const t = useT();
  const { graph } = useAppState();
  const ent = graph?.byHammerId.get(h.hammerid)?.[0];
  const choices = ent ? outputChoices(ent, graph ?? undefined) : [];
  const topGuess = ent && graph ? suggestEvents(graph, ent)[0] : undefined;
  const isCounter = h.type === 'counterup' || h.type === 'counterdown';
  const listId = `ev-${h.uid}`;
  const set = (patch: Partial<HandlerConfig>) => updateHandler(item.uid, h.uid, patch);
  return (
    <div className="handler" data-testid="handler">
      <div className="handler-head">
        <select value={h.type} onChange={(e) => set({ type: e.target.value as HandlerType, event: (e.target.value === 'counterup' || e.target.value === 'counterdown') ? undefined : h.event ?? choices[0] })} data-testid="handler-type">
          <option value="button">button</option>
          <option value="other">other (event)</option>
          <option value="counterup">counterup</option>
          <option value="counterdown">counterdown</option>
        </select>
        <input className="input hid" value={h.hammerid} onChange={(e) => set({ hammerid: e.target.value.trim() })} placeholder="hammerid" data-testid="handler-hammerid" />
        <EntityRef hammerid={h.hammerid} />
        <span className="spacer" />
        {ent && (
          <button
            type="button"
            className="mini"
            title={t('cfg.h.suggest')}
            onClick={() => {
              const s = suggestHandler(ent, graph ?? undefined);
              set({ type: s.type, event: s.type === 'counterup' || s.type === 'counterdown' ? undefined : s.event, mode: s.mode, cooldown: s.cooldown ?? h.cooldown });
            }}
          >
            ✨
          </button>
        )}
        <button type="button" className="mini" onClick={() => moveHandler(item.uid, h.uid, -1)} title={t('cfg.up')}>
          ↑
        </button>
        <button type="button" className="mini" onClick={() => moveHandler(item.uid, h.uid, 1)} title={t('cfg.down')}>
          ↓
        </button>
        <button type="button" className="mini danger" onClick={() => removeHandler(item.uid, h.uid)} title={t('cfg.delete')}>
          ✕
        </button>
      </div>
      <div className="grid">
        <label>
          {t('cfg.h.name')}
          <input className="input" value={h.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} />
        </label>
        {!isCounter && (
          <label>
            {t('cfg.h.event')}
            <input className="input" list={listId} value={h.event ?? ''} onChange={(e) => set({ event: e.target.value })} data-testid="handler-event" />
            <datalist id={listId}>
              {choices.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {topGuess && topGuess.event !== h.event && (
              <span className="muted small">
                {t('cfg.h.eventGuess', { event: topGuess.event })} ({topGuess.reason}){' '}
                <button type="button" className="mini" onClick={() => set({ event: topGuess.event })}>
                  ↵
                </button>
              </span>
            )}
          </label>
        )}
        <label>
          {t('cfg.h.mode')}
          <select value={h.mode} onChange={(e) => set({ mode: parseInt(e.target.value, 10) as HandlerConfig['mode'] })} data-testid="handler-mode">
            {HANDLER_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.value} = {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('cfg.h.cooldown')}
          <input className="input" type="number" min={0} step="0.5" value={h.cooldown ?? 0} onChange={(e) => set({ cooldown: parseFloat(e.target.value) || 0 })} data-testid="handler-cooldown" />
        </label>
        <label>
          {t('cfg.h.maxuses')}
          <input className="input" type="number" min={0} step={1} value={h.maxuses ?? 0} onChange={(e) => set({ maxuses: parseInt(e.target.value, 10) || 0 })} />
        </label>
        {isCounter && (
          <label>
            {t('cfg.h.offset')}
            <span className="pair">
              <input className="input" type="number" value={h.offset?.[0] ?? 0} onChange={(e) => set({ offset: [parseFloat(e.target.value) || 0, h.offset?.[1] ?? 0] })} />
              <input className="input" type="number" value={h.offset?.[1] ?? 0} onChange={(e) => set({ offset: [h.offset?.[0] ?? 0, parseFloat(e.target.value) || 0] })} />
            </span>
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={h.message} onChange={(e) => set({ message: e.target.checked })} /> {t('cfg.h.message')}
        </label>
        <label className="check">
          <input type="checkbox" checked={h.ui} onChange={(e) => set({ ui: e.target.checked })} /> {t('cfg.h.ui')}
        </label>
        <label>
          {t('cfg.templated')}
          <select value={h.templated === undefined ? 'auto' : h.templated ? 'yes' : 'no'} onChange={(e) => set({ templated: e.target.value === 'auto' ? undefined : e.target.value === 'yes' })}>
            <option value="auto">{t('cfg.templated.auto')}</option>
            <option value="yes">{t('cfg.templated.yes')}</option>
            <option value="no">{t('cfg.templated.no')}</option>
          </select>
        </label>
      </div>
      <Issues issues={issues} />
    </div>
  );
}

function ItemEditor({ item, issues }: { item: ItemConfig; issues: ValidationIssue[] }) {
  const t = useT();
  const set = (patch: Partial<ItemConfig>) => updateItem(item.uid, patch);
  const itemIssues = issues.filter((i) => !i.handlerUid);
  return (
    <div className="item-editor" data-testid="item-editor">
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => duplicateItem(item.uid)}>
          ⧉ {t('cfg.duplicate')}
        </button>
        <button
          type="button"
          className="btn danger-btn"
          data-testid="delete-item"
          onClick={() => {
            if (window.confirm(t('cfg.deleteConfirm', { name: item.name || item.hammerid }))) removeItem(item.uid);
          }}
        >
          ✕ {t('cfg.deleteItem')}
        </button>
      </div>
      <div className="grid">
        <label>
          {t('cfg.name')}
          <input className="input" value={item.name} onChange={(e) => set({ name: e.target.value })} data-testid="item-name" />
        </label>
        <label>
          {t('cfg.shortname')}
          <input className="input" value={item.shortname} onChange={(e) => set({ shortname: e.target.value })} data-testid="item-shortname" />
        </label>
        <label>
          {t('cfg.hammerid')}
          <span className="pair">
            <input className="input hid" value={item.hammerid} onChange={(e) => set({ hammerid: e.target.value.trim() })} data-testid="item-hammerid" />
            <EntityRef hammerid={item.hammerid} />
          </span>
        </label>
        <label>
          {t('cfg.color')}
          <span className="pair">
            <select value={ENTWATCH_COLORS.includes(item.color as (typeof ENTWATCH_COLORS)[number]) ? item.color : 'custom'} onChange={(e) => set({ color: e.target.value === 'custom' ? item.color : e.target.value })} data-testid="item-color">
              {ENTWATCH_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="custom">{t('cfg.h.custom')}</option>
            </select>
            <span className={`swatch sw-${item.color}`} />
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={item.message} onChange={(e) => set({ message: e.target.checked })} /> {t('cfg.message')}
        </label>
        <label className="check">
          <input type="checkbox" checked={item.ui} onChange={(e) => set({ ui: e.target.checked })} /> {t('cfg.ui')}
        </label>
        <label>
          {t('cfg.transfer')}
          <select value={item.transfer === undefined ? 'auto' : item.transfer ? 'yes' : 'no'} onChange={(e) => set({ transfer: e.target.value === 'auto' ? undefined : e.target.value === 'yes' })}>
            <option value="auto">{t('cfg.templated.auto')}</option>
            <option value="yes">{t('cfg.templated.yes')}</option>
            <option value="no">{t('cfg.templated.no')}</option>
          </select>
        </label>
        <label>
          {t('cfg.templated')}
          <select value={item.templated === undefined ? 'auto' : item.templated ? 'yes' : 'no'} onChange={(e) => set({ templated: e.target.value === 'auto' ? undefined : e.target.value === 'yes' })}>
            <option value="auto">{t('cfg.templated.auto')}</option>
            <option value="yes">{t('cfg.templated.yes')}</option>
            <option value="no">{t('cfg.templated.no')}</option>
          </select>
        </label>
      </div>
      <Issues issues={itemIssues} />

      <h4>
        {t('cfg.triggers')} ({item.triggers.length})
      </h4>
      {item.triggers.length === 0 && <div className="muted small">{t('cfg.noTriggers')}</div>}
      <div className="chips">
        {item.triggers.map((tr) => (
          <span key={tr} className="trigger-chip" data-testid="trigger-chip">
            <span className="mono">#{tr}</span> <EntityRef hammerid={tr} />
            <button type="button" className="mini danger" onClick={() => removeTrigger(item.uid, tr)} title={t('cfg.delete')}>
              ✕
            </button>
          </span>
        ))}
      </div>

      <h4>
        {t('cfg.handlers')} ({item.handlers.length})
        <button type="button" className="btn small-btn" onClick={() => addHandler(item.uid)}>
          + {t('cfg.addHandlerManual')}
        </button>
      </h4>
      {item.handlers.length === 0 && <div className="muted small">{t('cfg.noHandlers')}</div>}
      {item.handlers.map((h) => (
        <HandlerEditor key={h.uid} item={item} h={h} issues={issues.filter((i) => i.handlerUid === h.uid)} />
      ))}
    </div>
  );
}

function ItemRow({ item, index, issues, selected }: { item: ItemConfig; index: number; issues: ValidationIssue[]; selected: boolean }) {
  const t = useT();
  const worst = issues.some((i) => i.level === 'error') ? 'error' : issues.some((i) => i.level === 'warning') ? 'warning' : issues.length > 0 ? 'info' : '';
  const stop = (e: ReactMouseEvent<HTMLButtonElement>) => e.stopPropagation();
  return (
    <div className={`item-row${selected ? ' selected' : ''}`} onClick={() => selectItem(item.uid)} data-testid="item-row" aria-selected={selected}>
      <span className="item-index muted small">{index + 1}</span>
      <span className={`swatch sw-${item.color}`} />
      <span className="item-name" title={item.name}>
        {item.name || <span className="muted">(item {index + 1})</span>}
      </span>
      <span className="mono small">#{item.hammerid || '?'}</span>
      <span className="muted small item-meta" title={`${item.handlers.length} handlers / ${item.triggers.length} triggers`}>
        {item.handlers.length}h{item.triggers.length > 0 ? ` ${item.triggers.length}t` : ''}
      </span>
      {worst && <span className={`dot ${worst}`} />}
      <button type="button" className="mini aux" onClick={(e) => { stop(e); moveItem(item.uid, -1); }} title={t('cfg.up')}>
        ↑
      </button>
      <button type="button" className="mini aux" onClick={(e) => { stop(e); moveItem(item.uid, 1); }} title={t('cfg.down')}>
        ↓
      </button>
      <button type="button" className="mini aux" onClick={(e) => { stop(e); duplicateItem(item.uid); }} title={t('cfg.duplicate')}>
        ⧉
      </button>
      <button
        type="button"
        className="mini danger"
        onClick={(e) => {
          stop(e);
          if (window.confirm(t('cfg.deleteConfirm', { name: item.name || item.hammerid }))) removeItem(item.uid);
        }}
        title={t('cfg.delete')}
        data-testid="remove-item"
      >
        ✕
      </button>
    </div>
  );
}

/** The list of configured items (left column, under the map entities). */
export function ItemListPanel({ issues }: { issues: ValidationIssue[] }) {
  const t = useT();
  const { config, selectedItemUid, map } = useAppState();
  const listRef = useRef<HTMLDivElement>(null);
  const issuesByItem = useMemo(() => {
    const m = new Map<string, ValidationIssue[]>();
    for (const i of issues) {
      const list = m.get(i.itemUid);
      if (list) list.push(i);
      else m.set(i.itemUid, [i]);
    }
    return m;
  }, [issues]);

  // Keep the selected row in view when the selection comes from elsewhere (inspector, auto-add, delete).
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('.item-row.selected');
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }, [selectedItemUid]);

  return (
    <div className="panel items-panel" data-testid="items-panel">
      <div className="panel-head row">
        <strong>{t('cfg.itemsTitle')}</strong>
        {config.items.length > 0 && (
          <span className="muted small" data-testid="item-count">
            {t('cfg.itemCount', { n: config.items.length })}
          </span>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => addEmptyItem()} title={t('cfg.newItem')} data-testid="add-empty-item">
          + {t('cfg.newItemShort')}
        </button>
        {map && map.stats.weapons > 0 && (
          <button
            type="button"
            className="btn"
            title={t('cfg.autoAll')}
            data-testid="auto-add-all"
            onClick={() => {
              if (window.confirm(t('cfg.autoAllConfirm', { n: map.stats.weapons }))) {
                const n = autoAddAllWeapons();
                showToast(`+${n}`);
              }
            }}
          >
            ✨ {t('cfg.autoAllShort')}
          </button>
        )}
        {config.items.length > 0 && (
          <button
            type="button"
            className="btn danger-btn"
            title={t('cfg.clearAll')}
            data-testid="clear-all"
            onClick={() => {
              if (window.confirm(t('cfg.clearAllConfirm', { n: config.items.length }))) clearConfig();
            }}
          >
            ✕ {t('cfg.clearAllShort')}
          </button>
        )}
      </div>
      <div ref={listRef} className="panel-body item-list" data-testid="item-list">
        {config.items.length === 0 && <div className="muted small pad">{t('cfg.noItems')}</div>}
        {config.items.map((item, idx) => (
          <ItemRow key={item.uid} item={item} index={idx} issues={issuesByItem.get(item.uid) ?? []} selected={item.uid === selectedItemUid} />
        ))}
      </div>
    </div>
  );
}

/** Editor for the selected item (right column). */
export function ConfigPanel({ issues }: { issues: ValidationIssue[] }) {
  const t = useT();
  const { config, selectedItemUid, suggestionNotes } = useAppState();
  const [showNotes, setShowNotes] = useState(true);
  const detailRef = useRef<HTMLDivElement>(null);
  const selected = config.items.find((i) => i.uid === selectedItemUid) ?? null;
  const itemIssues = useMemo(() => (selected ? issues.filter((i) => i.itemUid === selected.uid) : []), [issues, selected]);

  // show a newly selected item from the top
  useLayoutEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selectedItemUid]);

  return (
    <div className="panel config-panel">
      <div className="panel-head row">
        <strong>{t('cfg.title')}</strong>
        {selected && (
          <span className="muted small ellipsis" title={selected.name}>
            {selected.name || `#${selected.hammerid}`}
          </span>
        )}
      </div>
      <div className="panel-body item-detail" ref={detailRef} data-testid="item-detail">
        {!selected && <div className="muted small pad">{config.items.length === 0 ? t('cfg.noItems') : t('cfg.noSelection')}</div>}
        {selected && suggestionNotes.length > 0 && (
          <details className="notes" open={showNotes} onToggle={(e) => setShowNotes((e.target as HTMLDetailsElement).open)}>
            <summary>{t('sugg.notes')}</summary>
            <ul>
              {suggestionNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
        {selected && <ItemEditor item={selected} issues={itemIssues} />}
      </div>
    </div>
  );
}
