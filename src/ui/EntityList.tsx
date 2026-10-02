import { memo, useMemo, useState } from 'react';
import type { MapEntity } from '../model/entity';
import { friendlyName } from '../model/entity';
import { selectEntity, setQuery, setWeaponsOnly } from './actions';
import { useAppState } from './store';
import { useT } from './useT';

const PAGE = 300;

const Row = memo(function Row({ entity, selected, inConfig, touched, onClick }: { entity: MapEntity; selected: boolean; inConfig: boolean; touched?: 'filter' | 'modify'; onClick: () => void }) {
  const name = friendlyName(entity.targetname);
  return (
    <div className={`ent-row${selected ? ' selected' : ''}`} onClick={onClick} data-testid="entity-row" data-hammerid={entity.hammerId}>
      <div className="ent-row-main">
        <span className="ent-class">{entity.classname}</span>
        {name ? <span className="ent-name">{name}</span> : <span className="ent-name muted">—</span>}
      </div>
      <div className="ent-row-meta">
        <span className="ent-id">#{entity.hammerId || '?'}</span>
        {entity.source.templated && <span className="badge tpl">T</span>}
        {inConfig && <span className="badge ok">✓</span>}
        {touched && (
          <span className={`badge touched-${touched}`} data-testid={`touched-${touched}`}>
            {touched === 'filter' ? '✂' : '✎'}
          </span>
        )}
      </div>
    </div>
  );
});

export function EntityList() {
  const t = useT();
  const { map, query, weaponsOnly, selectedEntityId, config, mode, stripperSim } = useAppState();
  const [limit, setLimit] = useState(PAGE);

  const used = useMemo(() => {
    const s = new Set<string>();
    if (mode === 'stripper') return s;
    for (const i of config.items) {
      s.add(i.hammerid);
      for (const h of i.handlers) s.add(h.hammerid);
      for (const tr of i.triggers) s.add(tr);
    }
    return s;
  }, [config, mode]);

  const filtered = useMemo(() => {
    if (!map) return [];
    const q = query.trim().toLowerCase();
    return map.entities.filter((e) => {
      if (weaponsOnly && !e.classname.startsWith('weapon_')) return false;
      if (!q) return true;
      return e.classname.includes(q) || e.targetname.toLowerCase().includes(q) || e.hammerId === q || e.hammerId.startsWith(q);
    });
  }, [map, query, weaponsOnly]);

  if (!map) return null;
  const shown = filtered.slice(0, limit);

  return (
    <div className="panel entity-list">
      <div className="panel-head">
        <input
          className="input"
          placeholder={t('list.search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          data-testid="entity-search"
        />
        <div className="seg">
          <button type="button" className={weaponsOnly ? 'on' : ''} onClick={() => setWeaponsOnly(true)} data-testid="filter-weapons">
            {t('list.weaponsOnly')}
          </button>
          <button type="button" className={!weaponsOnly ? 'on' : ''} onClick={() => setWeaponsOnly(false)} data-testid="filter-all">
            {t('list.all')}
          </button>
        </div>
        <div className="muted small">{t('list.count', { n: filtered.length })}</div>
      </div>
      <div className="panel-body list-body">
        {shown.length === 0 && <div className="muted pad">{t('list.empty')}</div>}
        {shown.map((e) => (
          <Row key={e.id} entity={e} selected={e.id === selectedEntityId} inConfig={used.has(e.hammerId)} touched={mode === 'stripper' ? stripperSim?.touched.get(e.id) : undefined} onClick={() => selectEntity(e.id, true)} />
        ))}
        {filtered.length > limit && (
          <button type="button" className="btn wide" onClick={() => setLimit(limit + PAGE)}>
            +{Math.min(PAGE, filtered.length - limit)}
          </button>
        )}
      </div>
    </div>
  );
}
