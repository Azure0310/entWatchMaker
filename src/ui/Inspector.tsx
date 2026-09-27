import { useState } from 'react';
import type { EntityConnection, MapEntity } from '../model/entity';
import { friendlyName } from '../model/entity';
import { addHandler, addItemFromEntity, addTrigger, selectEntity, setItemWeapon, setTreeRoot } from './actions';
import { inferCooldown } from '../model/cooldown';
import { EntityChip } from './EntityChip';
import { useAppState } from './store';
import { useT } from './useT';

function TargetCell({ conn, from }: { conn: EntityConnection; from: MapEntity }) {
  const t = useT();
  const { graph } = useAppState();
  if (!graph) return <span>{conn.target}</span>;
  if (conn.target.startsWith('!')) {
    return (
      <span>
        {conn.target} <span className="muted small">{t('insp.special')}</span>
      </span>
    );
  }
  const targets = graph.relationsOf(from).filter((r) => r.kind === 'output' && r.connection === conn).map((r) => r.other);
  if (targets.length === 0) {
    return (
      <span>
        {conn.target} <span className="warn small">{t('insp.unresolved')}</span>
      </span>
    );
  }
  return (
    <span className="chips">
      {targets.slice(0, 6).map((e) => (
        <EntityChip key={e.id} entity={e} />
      ))}
      {targets.length > 6 && <span className="muted small">+{targets.length - 6}</span>}
    </span>
  );
}

export function Inspector() {
  const t = useT();
  const { graph, selectedEntityId, selectedItemUid, config } = useAppState();
  const [tab, setTab] = useState<'props' | 'out' | 'in'>('props');
  const e = graph && selectedEntityId !== null ? graph.byId.get(selectedEntityId) ?? null : null;
  if (!graph || !e) return <div className="panel inspector" />;

  const item = config.items.find((i) => i.uid === selectedItemUid) ?? null;
  const incoming = graph.incomingConnections(e);
  const cooldown = e.classname.startsWith('weapon_') || e.classname === 'math_counter' ? null : inferCooldown(graph, e);
  const name = friendlyName(e.targetname);
  const isTrigger = e.classname.startsWith('trigger_');
  const isWeapon = e.classname.startsWith('weapon_');

  const refsFor = (key: string, value: string): MapEntity[] => {
    return graph.relationsOf(e).filter((r) => (r.kind === 'keyref' || r.kind === 'parent' || r.kind === 'template') && r.key === key).map((r) => r.other).filter((o) => o.targetname && value.length > 0);
  };

  return (
    <div className="panel inspector" data-testid="inspector">
      <div className="panel-head">
        <div className="insp-title">
          <span className="ent-class big">{e.classname}</span>
          {name && <span className="ent-name big">{name}</span>}
          <span className="ent-id big" data-testid="inspector-hammerid">#{e.hammerId || '?'}</span>
        </div>
        <div className="muted small">
          {t('insp.source')}: {e.source.container}
          {e.source.templated && <span className="badge tpl" title={t('insp.templated')}> templated</span>}
        </div>
        {cooldown && (
          <div className="small" data-testid="inferred-cooldown">
            ⏱ {t('insp.cooldown', { s: cooldown.seconds })} <span className="muted">({cooldown.reason})</span>
          </div>
        )}
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setTreeRoot(e.id)}>
            {t('tree.setRoot')}
          </button>
          <button type="button" className={`btn${isWeapon ? ' primary' : ''}`} onClick={() => addItemFromEntity(e)} data-testid="add-item">
            {t('insp.addItem')}
          </button>
          {!isTrigger && (
            <button type="button" className="btn" disabled={!item || !e.hammerId} title={!item ? t('insp.noItem') : ''} onClick={() => item && addHandler(item.uid, e)} data-testid="add-handler">
              {t('insp.addHandler')}
            </button>
          )}
          <button type="button" className="btn" disabled={!item || !e.hammerId} title={!item ? t('insp.noItem') : ''} onClick={() => item && addTrigger(item.uid, e.hammerId)} data-testid="add-trigger">
            {t('insp.addTrigger')}
          </button>
          {item && (
            <button type="button" className="btn" onClick={() => setItemWeapon(item.uid, e)}>
              {t('insp.setWeapon')}
            </button>
          )}
        </div>
        <div className="tabs">
          <button type="button" className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}>
            {t('insp.props')} ({Object.keys(e.props).length})
          </button>
          <button type="button" className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')} data-testid="tab-outputs">
            {t('insp.outputs')} ({e.connections.length})
          </button>
          <button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')} data-testid="tab-inputs">
            {t('insp.inputs')} ({incoming.length})
          </button>
        </div>
      </div>
      <div className="panel-body">
        {tab === 'props' && (
          <table className="kv">
            <tbody>
              {Object.entries(e.props)
                .sort(([a], [b]) => (a === 'classname' ? -1 : b === 'classname' ? 1 : a === 'targetname' ? -1 : b === 'targetname' ? 1 : a.localeCompare(b)))
                .map(([k, v]) => {
                  const refs = refsFor(k, v);
                  return (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>
                        {v}
                        {refs.length > 0 && (
                          <span className="chips">
                            {refs.slice(0, 4).map((r) => (
                              <EntityChip key={r.id} entity={r} />
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
        {tab === 'out' && (
          <table className="io">
            <thead>
              <tr>
                <th>{t('insp.col.output')}</th>
                <th>{t('insp.col.target')}</th>
                <th>{t('insp.col.input')}</th>
                <th>{t('insp.col.param')}</th>
                <th>{t('insp.col.delay')}</th>
                <th>{t('insp.col.times')}</th>
              </tr>
            </thead>
            <tbody>
              {e.connections.map((c, i) => (
                <tr key={i}>
                  <td className="mono">{c.output}</td>
                  <td>
                    <TargetCell conn={c} from={e} />
                  </td>
                  <td className="mono">{c.input}</td>
                  <td className="mono">{c.param}</td>
                  <td>{c.delay}</td>
                  <td>{c.timesToFire}</td>
                </tr>
              ))}
              {e.connections.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {tab === 'in' && (
          <table className="io">
            <thead>
              <tr>
                <th>{t('insp.col.from')}</th>
                <th>{t('insp.col.output')}</th>
                <th>{t('insp.col.input')}</th>
                <th>{t('insp.col.param')}</th>
                <th>{t('insp.col.delay')}</th>
              </tr>
            </thead>
            <tbody>
              {incoming.map(({ from, connection }, i) => (
                <tr key={i}>
                  <td>
                    <EntityChip entity={from} onClick={() => selectEntity(from.id)} />
                  </td>
                  <td className="mono">{connection.output}</td>
                  <td className="mono">{connection.input}</td>
                  <td className="mono">{connection.param}</td>
                  <td>{connection.delay}</td>
                </tr>
              ))}
              {incoming.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
