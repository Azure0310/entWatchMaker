import { useMemo, useState } from 'react';
import { buildRelationTree, type RelationKind, type TreeNode } from '../model/graph';
import { friendlyName } from '../model/entity';
import { addHandler, addTrigger, selectEntity, setTreeDepth, setTreeRoot } from './actions';
import { useAppState } from './store';
import { useT } from './useT';
import { IoSearch } from './IoSearch';

const KIND_ICON: Record<RelationKind, string> = {
  output: '→',
  input: '←',
  parent: '↑',
  child: '↓',
  keyref: '⇢',
  'keyref-in': '⇠',
  template: '⧉',
  'template-in': '⧉',
};

function Node({ node, usedIds, selectedId, itemUid }: { node: TreeNode; usedIds: Set<string>; selectedId: number | null; itemUid: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const e = node.entity;
  const name = friendlyName(e.targetname);
  const canExpand = node.children.length > 0;
  const isTrigger = e.classname.startsWith('trigger_');
  return (
    <div className="tree-node">
      <div className={`tree-row${e.id === selectedId ? ' selected' : ''}${node.repeated ? ' repeated' : ''}`} data-testid="tree-row">
        <button type="button" className="tree-toggle" onClick={() => setOpen(!open)} disabled={!canExpand}>
          {canExpand ? (open ? '▾' : '▸') : '·'}
        </button>
        {node.via && (
          <span className={`rel rel-${node.via.kind}`} title={node.via.kind}>
            {KIND_ICON[node.via.kind]} {node.via.label}
          </span>
        )}
        <span className="tree-ent" onClick={() => selectEntity(e.id)}>
          <span className="ent-class">{e.classname}</span>
          {name && <span className="ent-name">{name}</span>}
          <span className="ent-id">#{e.hammerId}</span>
          {e.source.templated && <span className="badge tpl">T</span>}
          {usedIds.has(e.hammerId) && <span className="badge ok">✓</span>}
          {node.repeated && <span className="muted small"> {t('tree.repeated')}</span>}
        </span>
        <span className="tree-actions">
          {node.depth > 0 && (
            <button type="button" className="mini" title={t('tree.setRoot')} onClick={() => setTreeRoot(e.id)}>
              ⌂
            </button>
          )}
          {itemUid && e.hammerId && (
            <button
              type="button"
              className="mini"
              title={isTrigger ? t('insp.addTrigger') : t('insp.addHandler')}
              onClick={() => (isTrigger ? addTrigger(itemUid, e.hammerId) : addHandler(itemUid, e))}
            >
              +
            </button>
          )}
        </span>
      </div>
      {open && canExpand && (
        <div className="tree-children">
          {node.children.map((c, i) => (
            <Node key={`${c.entity.id}-${i}`} node={c} usedIds={usedIds} selectedId={selectedId} itemUid={itemUid} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RelationTree() {
  const t = useT();
  const { graph, treeRootId, treeDepth, selectedEntityId, config, selectedItemUid } = useAppState();
  const [tab, setTab] = useState<'tree' | 'io'>('tree');
  const root = graph && treeRootId !== null ? graph.byId.get(treeRootId) ?? null : null;
  const tree = useMemo(() => (graph && root ? buildRelationTree(graph, root, treeDepth) : null), [graph, root, treeDepth]);
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of config.items) {
      s.add(i.hammerid);
      for (const h of i.handlers) s.add(h.hammerid);
      for (const tr of i.triggers) s.add(tr);
    }
    return s;
  }, [config]);

  return (
    <div className="panel tree-panel">
      <div className="panel-head row">
        <div className="tabs">
          <button type="button" className={tab === 'tree' ? 'on' : ''} onClick={() => setTab('tree')} data-testid="tab-tree">
            {t('tree.title')}
          </button>
          <button type="button" className={tab === 'io' ? 'on' : ''} onClick={() => setTab('io')} data-testid="tab-io">
            {t('io.title')}
          </button>
        </div>
        {tab === 'tree' && (
          <label className="inline">
            {t('tree.depth')}
            <select value={treeDepth} onChange={(e) => setTreeDepth(parseInt(e.target.value, 10))} data-testid="tree-depth">
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab === 'tree' && <span className="muted small legend">{t('tree.legend')}</span>}
      </div>
      {tab === 'tree' ? (
        <div className="panel-body tree-body">
          {!tree && <div className="muted pad">{t('tree.empty')}</div>}
          {tree && <Node node={tree} usedIds={usedIds} selectedId={selectedEntityId} itemUid={selectedItemUid} />}
        </div>
      ) : (
        <IoSearch />
      )}
    </div>
  );
}
