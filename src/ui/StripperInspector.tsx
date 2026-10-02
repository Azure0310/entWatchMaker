import { useMemo, useState } from 'react';
import type { EntityConnection, MapEntity } from '../model/entity';
import { findEntityModify, isOutputDeleted } from '../model/stripperBuild';
import { entityMatches, toSimEntity, type SimEntity } from '../model/stripperMatch';
import type { StripperAction } from '../model/stripper';
import {
  cloneEntity,
  deleteEntityKey,
  deleteEntityOutput,
  describeAction,
  editEntityKey,
  removeClass,
  removeEntity,
  revertEntityKey,
  revertEntityOutputDelete,
  selectAction,
  startOutputInsert,
  startOutputRewrite,
} from './stripperActions';
import { useAppState } from './store';
import { useT } from './useT';

/** Buttons that turn the selected entity into stripper actions. */
export function StripperButtons({ e }: { e: MapEntity }) {
  const t = useT();
  const { graph } = useAppState();
  const sameClass = graph ? graph.entities.filter((o) => o.classname === e.classname).length : 0;
  return (
    <>
      <button type="button" className="btn danger-btn" onClick={() => removeEntity(e)} data-testid="strip-remove">
        {t('st.insp.remove')}
      </button>
      <button type="button" className="btn danger-btn" onClick={() => removeClass(e)} title={`${sameClass}`} data-testid="strip-remove-class">
        {t('st.insp.removeClass')} ({sameClass})
      </button>
      <button type="button" className="btn" onClick={() => cloneEntity(e)} data-testid="strip-clone">
        {t('st.insp.clone')}
      </button>
    </>
  );
}

/** Actions (other than adds) whose match selects this entity as loaded. */
function actionsHitting(actions: StripperAction[], e: MapEntity): StripperAction[] {
  const sim = toSimEntity(e);
  return actions.filter((a) => (a.kind === 'filter' ? entityMatches(sim, a.match, a.io) : a.kind === 'modify' ? entityMatches(sim, a.match, a.matchIo) : false));
}

export function HitList({ e }: { e: MapEntity }) {
  const t = useT();
  const { stripper } = useAppState();
  const hits = useMemo(() => actionsHitting(stripper.actions, e), [stripper, e]);
  if (hits.length === 0) return null;
  return (
    <div className="small hit-list">
      <span className="muted">{t('st.insp.hit')}:</span>{' '}
      {hits.map((a) => (
        <button key={a.uid} type="button" className={`chip hit-${a.kind}`} onClick={() => selectAction(a.uid)}>
          <span className="chip-class">{t(`st.kind.${a.kind}`)}</span>
          <span className="chip-name">{describeAction(a).slice(0, 70)}</span>
        </button>
      ))}
    </div>
  );
}

function PropRow({ e, k, v }: { e: MapEntity; k: string; v: string }) {
  const t = useT();
  const { stripper, map } = useAppState();
  const modify = map ? findEntityModify(stripper, e, map.mapName) : undefined;
  const replaced = modify?.replace.find((kv) => kv.key.toLowerCase() === k);
  const deleted = modify?.delete.find((kv) => kv.key.toLowerCase() === k);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v);

  const commit = () => {
    setEditing(false);
    if (draft !== (replaced?.value ?? v)) editEntityKey(e, k, draft);
  };

  return (
    <>
      {editing ? (
        <input
          className="input mono"
          autoFocus
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') commit();
            if (ev.key === 'Escape') setEditing(false);
          }}
          data-testid="prop-edit-input"
        />
      ) : (
        <span className="prop-value">
          {replaced || deleted ? <s className="muted">{v}</s> : v}
          {replaced && <span className="diff-new"> → {replaced.value}</span>}
          {deleted && <span className="diff-del"> {t('st.insp.keyDeleted')}</span>}
        </span>
      )}
      <span className="row-actions">
        {!editing && (
          <button
            type="button"
            className="mini"
            title={t('st.insp.edit')}
            onClick={() => {
              setDraft(replaced?.value ?? v);
              setEditing(true);
            }}
            data-testid="prop-edit"
          >
            ✎
          </button>
        )}
        {!deleted && (
          <button type="button" className="mini danger" title={t('st.insp.deleteKey')} onClick={() => deleteEntityKey(e, k)} data-testid="prop-delete">
            🗑
          </button>
        )}
        {(replaced || deleted) && (
          <button type="button" className="mini" title={t('st.insp.revert')} onClick={() => revertEntityKey(e, k)}>
            ↺
          </button>
        )}
      </span>
    </>
  );
}

/** Property table whose values can be edited in place; edits become the entity's modify. */
export function EditableProps({ e, sorted }: { e: MapEntity; sorted: [string, string][] }) {
  const t = useT();
  const { stripper, map } = useAppState();
  const modify = map ? findEntityModify(stripper, e, map.mapName) : undefined;
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const add = () => {
    if (!key.trim()) return;
    editEntityKey(e, key.trim(), value);
    setKey('');
    setValue('');
  };
  return (
    <table className="kv editable">
      <tbody>
        {sorted.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>
              <div className="prop-cell">
                <PropRow e={e} k={k} v={v} />
              </div>
            </td>
          </tr>
        ))}
        {(modify?.insert ?? []).map((kv) => (
          <tr key={`ins-${kv.key}`}>
            <th className="diff-new">{kv.key}</th>
            <td>
              <div className="prop-cell">
                <span className="prop-value diff-new">+ {kv.value}</span>
                <span className="row-actions">
                  <button type="button" className="mini" title={t('st.insp.revert')} onClick={() => revertEntityKey(e, kv.key)}>
                    ↺
                  </button>
                </span>
              </div>
            </td>
          </tr>
        ))}
        <tr className="add-prop">
          <th>
            <input className="input mono" placeholder={t('st.insp.newKey')} value={key} onChange={(ev) => setKey(ev.target.value)} data-testid="prop-new-key" />
          </th>
          <td>
            <div className="prop-cell">
              <input
                className="input mono"
                placeholder={t('st.insp.newValue')}
                value={value}
                onChange={(ev) => setValue(ev.target.value)}
                onKeyDown={(ev) => ev.key === 'Enter' && add()}
                data-testid="prop-new-value"
              />
              <button type="button" className="btn" onClick={add} disabled={!key.trim()} data-testid="prop-new-add">
                {t('st.insp.addKey')}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Extra cells for an output row: rewrite / delete / undo. */
export function OutputActions({ e, c }: { e: MapEntity; c: EntityConnection }) {
  const t = useT();
  const { stripper, map } = useAppState();
  const modify = map ? findEntityModify(stripper, e, map.mapName) : undefined;
  const deleted = isOutputDeleted(modify, e, c);
  return (
    <span className="row-actions">
      <button type="button" className="mini" title={t('st.insp.rewriteOutput')} onClick={() => startOutputRewrite(e, c)} data-testid="output-rewrite">
        ✎
      </button>
      {deleted ? (
        <button type="button" className="mini" title={t('st.insp.revert')} onClick={() => revertEntityOutputDelete(e, c)}>
          ↺
        </button>
      ) : (
        <button type="button" className="mini danger" title={t('st.insp.deleteOutput')} onClick={() => deleteEntityOutput(e, c)} data-testid="output-delete">
          🗑
        </button>
      )}
    </span>
  );
}

export function IncomingActions({ from, c }: { from: MapEntity; c: EntityConnection }) {
  const t = useT();
  const { stripper, map } = useAppState();
  const modify = map ? findEntityModify(stripper, from, map.mapName) : undefined;
  const deleted = isOutputDeleted(modify, from, c);
  return deleted ? (
    <button type="button" className="mini" title={t('st.insp.revert')} onClick={() => revertEntityOutputDelete(from, c)}>
      ↺
    </button>
  ) : (
    <button type="button" className="mini danger" title={t('st.insp.deleteIncoming')} onClick={() => deleteEntityOutput(from, c)} data-testid="incoming-delete">
      🗑
    </button>
  );
}

export function AddOutputButton({ e }: { e: MapEntity }) {
  const t = useT();
  return (
    <button type="button" className="btn" onClick={() => startOutputInsert(e)} data-testid="output-add">
      {t('st.insp.addOutput')}
    </button>
  );
}

function connectionText(c: EntityConnection): string {
  return `${c.output} → ${c.target}.${c.input}${c.param ? ` "${c.param}"` : ''}${c.delay ? ` +${c.delay}s` : ''}${c.timesToFire !== -1 ? ` ×${c.timesToFire}` : ''}`;
}

/** The entity as it will be once the config has been applied, with what changed. */
export function AfterView({ e }: { e: MapEntity }) {
  const t = useT();
  const { stripperSim } = useAppState();
  if (!stripperSim) return null;
  const after: SimEntity | undefined = stripperSim.after.get(e.id);
  if (!after) return <div className="pad diff-del">{t('st.insp.afterRemoved')}</div>;

  const before = toSimEntity(e);
  const keys = [...new Set([...Object.keys(before.props), ...Object.keys(after.props)])].sort();
  const propRows = keys
    .map((k) => ({ k, a: before.props[k], b: after.props[k] }))
    .filter((r) => r.a !== r.b);

  const sig = (c: EntityConnection) => connectionText(c);
  const remaining = new Map<string, number>();
  for (const c of after.connections) remaining.set(sig(c), (remaining.get(sig(c)) ?? 0) + 1);
  const gone: EntityConnection[] = [];
  for (const c of before.connections) {
    const n = remaining.get(sig(c)) ?? 0;
    if (n > 0) remaining.set(sig(c), n - 1);
    else gone.push(c);
  }
  const unchanged = new Map<string, number>();
  for (const c of before.connections) unchanged.set(sig(c), (unchanged.get(sig(c)) ?? 0) + 1);
  const added: EntityConnection[] = [];
  for (const c of after.connections) {
    const n = unchanged.get(sig(c)) ?? 0;
    if (n > 0) unchanged.set(sig(c), n - 1);
    else added.push(c);
  }

  if (propRows.length === 0 && gone.length === 0 && added.length === 0) return <div className="pad muted">{t('st.insp.afterSame')}</div>;
  return (
    <div className="after-view" data-testid="after-view">
      {propRows.length > 0 && (
        <table className="kv">
          <tbody>
            {propRows.map((r) => (
              <tr key={r.k}>
                <th>{r.k}</th>
                <td>
                  {r.a !== undefined && <s className="muted">{r.a}</s>}
                  {r.b !== undefined ? <span className="diff-new"> {r.a !== undefined ? '→ ' : '+ '}{r.b}</span> : <span className="diff-del"> {t('st.insp.keyDeleted')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(gone.length > 0 || added.length > 0) && (
        <ul className="io-diff mono">
          {gone.map((c, i) => (
            <li key={`g${i}`} className="diff-del">
              − {connectionText(c)}
            </li>
          ))}
          {added.map((c, i) => (
            <li key={`a${i}`} className="diff-new">
              + {connectionText(c)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
