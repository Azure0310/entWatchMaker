import { useMemo, useState } from 'react';
import type { EntityConnection, MapEntity } from '../model/entity';
import { friendlyName } from '../model/entity';
import { newHandler } from '../model/entwatch';
import { inferCooldown } from '../model/cooldown';
import { EntityChip } from './EntityChip';
import { store, useAppState } from './store';
import { addTrigger, updateItem } from './actions';
import { IncomingActions } from './StripperInspector';
import { useT } from './useT';

const MAX_ROWS = 400;

interface Row {
  from: MapEntity;
  connection: EntityConnection;
  targets: MapEntity[];
}

function matches(row: Row, q: string): boolean {
  if (!q) return true;
  const c = row.connection;
  const hay = [
    row.from.classname,
    friendlyName(row.from.targetname),
    row.from.hammerId,
    c.output,
    c.target,
    c.input,
    c.param,
    ...row.targets.map((t) => `${t.classname} ${friendlyName(t.targetname)} #${t.hammerId}`),
  ]
    .join(' ')
    .toLowerCase();
  // every space separated term must match; "key:value" terms restrict a field
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => {
      const m = /^(out|in|from|target|param|class):(.*)$/.exec(term);
      if (!m) return hay.includes(term);
      const v = m[2];
      switch (m[1]) {
        case 'out':
          return c.output.toLowerCase().includes(v);
        case 'in':
          return c.input.toLowerCase().includes(v);
        case 'from':
          return `${row.from.classname} ${friendlyName(row.from.targetname).toLowerCase()} ${row.from.hammerId}`.includes(v);
        case 'target':
          return c.target.toLowerCase().includes(v) || row.targets.some((t) => friendlyName(t.targetname).toLowerCase().includes(v) || t.hammerId === v);
        case 'param':
          return c.param.toLowerCase().includes(v);
        case 'class':
          return row.from.classname.includes(v) || row.targets.some((t) => t.classname.includes(v));
        default:
          return true;
      }
    });
}

export function IoSearch() {
  const t = useT();
  const { graph, selectedItemUid, config, mode } = useAppState();
  const [query, setQuery] = useState('');
  const [inputFilter, setInputFilter] = useState('');
  const [outputFilter, setOutputFilter] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);

  const all = useMemo(() => (graph ? graph.allConnections() : []), [graph]);
  const inputs = useMemo(() => [...new Set(all.map((r) => r.connection.input))].sort(), [all]);
  const outputs = useMemo(() => [...new Set(all.map((r) => r.connection.output))].sort(), [all]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const r of all) {
      if (inputFilter && r.connection.input !== inputFilter) continue;
      if (outputFilter && r.connection.output !== outputFilter) continue;
      if (delayedOnly && !(r.connection.delay > 0)) continue;
      if (!matches(r, query)) continue;
      out.push(r);
      if (out.length >= MAX_ROWS) break;
    }
    return out;
  }, [all, query, inputFilter, outputFilter, delayedOnly]);

  if (!graph) return null;
  const item = config.items.find((i) => i.uid === selectedItemUid) ?? null;

  const addAsHandler = (row: Row) => {
    if (!item) return;
    const e = row.from;
    if (e.classname.startsWith('trigger_')) {
      addTrigger(item.uid, e.hammerId);
      return;
    }
    const cd = inferCooldown(graph, e);
    const h = newHandler({
      type: e.classname === 'func_button' || e.classname === 'func_rot_button' || e.classname.startsWith('func_physbox') ? 'button' : 'other',
      hammerid: e.hammerId,
      event: row.connection.output,
      mode: 2,
      cooldown: cd?.seconds ?? 0,
    });
    updateItem(item.uid, { handlers: [...(store.get().config.items.find((i) => i.uid === item.uid)?.handlers ?? []), h] });
  };

  return (
    <div className="io-search" data-testid="io-search">
      <div className="io-controls">
        <input className="input" placeholder={t('io.search')} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="io-query" />
        <select value={outputFilter} onChange={(e) => setOutputFilter(e.target.value)} title={t('insp.col.output')}>
          <option value="">{t('io.anyOutput')}</option>
          {outputs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select value={inputFilter} onChange={(e) => setInputFilter(e.target.value)} title={t('insp.col.input')} data-testid="io-input-filter">
          <option value="">{t('io.anyInput')}</option>
          {inputs.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <label className="check small">
          <input type="checkbox" checked={delayedOnly} onChange={(e) => setDelayedOnly(e.target.checked)} /> {t('io.delayedOnly')}
        </label>
        <span className="muted small">{t('io.count', { n: rows.length, total: all.length })}</span>
      </div>
      <div className="muted small io-hint">{t('io.hint')}</div>
      <div className="panel-body">
        <table className="io">
          <thead>
            <tr>
              <th>{t('insp.col.from')}</th>
              <th>{t('insp.col.output')}</th>
              <th>{t('insp.col.target')}</th>
              <th>{t('insp.col.input')}</th>
              <th>{t('insp.col.param')}</th>
              <th>{t('insp.col.delay')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} data-testid="io-row">
                <td>
                  <EntityChip entity={r.from} />
                </td>
                <td className="mono">{r.connection.output}</td>
                <td>
                  {r.targets.length > 0 ? (
                    <span className="chips">
                      {r.targets.slice(0, 4).map((x) => (
                        <EntityChip key={x.id} entity={x} />
                      ))}
                      {r.targets.length > 4 && <span className="muted small">+{r.targets.length - 4}</span>}
                    </span>
                  ) : (
                    <span className="mono muted">{r.connection.target}</span>
                  )}
                </td>
                <td className="mono">{r.connection.input}</td>
                <td className="mono">{r.connection.param}</td>
                <td>{r.connection.delay}</td>
                <td>
                  {mode === 'stripper' && <IncomingActions from={r.from} c={r.connection} />}
                  {mode !== 'stripper' && item && r.from.hammerId && (
                    <button type="button" className="mini" title={t('io.addHandler', { event: r.connection.output })} onClick={() => addAsHandler(r)} data-testid="io-add-handler">
                      +
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
