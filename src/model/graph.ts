import { friendlyName, type EntityConnection, type MapEntity } from './entity';

/**
 * Relationship index over a parsed map: outputs, incoming connections, parenting and any
 * key value that references another entity by name.
 */

export type RelationKind = 'output' | 'input' | 'parent' | 'child' | 'keyref' | 'keyref-in' | 'template' | 'template-in';

export interface Relation {
  kind: RelationKind;
  /** Entity on the other end. */
  other: MapEntity;
  /** Human readable edge label, e.g. "OnPressed -> Trigger" or "parentname". */
  label: string;
  connection?: EntityConnection;
  key?: string;
}

/** Keys whose values are entity names (in addition to whatever matches a targetname). */
const NAME_REF_KEYS = new Set([
  'parentname', 'target', 'target1', 'target2', 'target3', 'target4', 'target5', 'target6', 'target7', 'target8',
  'filtername', 'filter01', 'filter02', 'filter03', 'filter04', 'filter05', 'filter06', 'filter07', 'filter08', 'filter09', 'filter10',
  'attach1', 'attach2', 'measuretarget', 'measurereference', 'targetreference', 'targetentity', 'entitytemplate',
  'landmark', 'master', 'branch01', 'branch02', 'branch03', 'branch04', 'branch05', 'branch06', 'branch07', 'branch08',
  'branch09', 'branch10', 'branch11', 'branch12', 'branch13', 'branch14', 'branch15', 'branch16',
  'template01', 'template02', 'template03', 'template04', 'template05', 'template06', 'template07', 'template08',
  'template09', 'template10', 'template11', 'template12', 'template13', 'template14', 'template15', 'template16',
  'template17', 'template18', 'template19', 'template20', 'template21', 'template22', 'template23', 'template24',
  'template25', 'template26', 'template27', 'template28', 'template29', 'template30', 'template31', 'template32',
  'template33', 'template34', 'template35', 'template36', 'template37', 'template38', 'template39', 'template40',
  'template41', 'template42', 'template43', 'template44', 'template45', 'template46', 'template47', 'template48',
  'template49', 'template50', 'template51', 'template52', 'template53', 'template54', 'template55', 'template56',
  'template57', 'template58', 'template59', 'template60', 'template61', 'template62', 'template63', 'template64',
  'spawntarget', 'pointtarget', 'hinttarget', 'lookattarget', 'startentity', 'endentity', 'attachedentity',
  'trainentity', 'sourceentityname', 'destinationentityname', 'parententity', 'pushpointentity', 'entity',
  'targetpoint', 'linktarget', 'attachtarget', 'referenceentity', 'movetarget', 'triggerentity',
]);

/** Keys that never hold entity names even if a targetname happens to collide with the value. */
const NEVER_REF_KEYS = new Set([
  'classname', 'targetname', 'hammeruniqueid', 'origin', 'angles', 'scales', 'model', 'skin', 'spawnflags',
  'rendercolor', 'renderamt', 'rendermode', 'renderfx', 'sounds', 'message', 'noise', 'health', 'speed', 'wait',
  'globalname', 'entitylumpname', 'compile_source_id', 'entity_name', 'weaponname', 'itemname',
]);

export class EntityGraph {
  readonly entities: MapEntity[];
  readonly byId = new Map<number, MapEntity>();
  readonly byHammerId = new Map<string, MapEntity[]>();
  /** scope -> lowercase targetname -> entities */
  private readonly byName = new Map<string, Map<string, MapEntity[]>>();
  private readonly globalByName = new Map<string, MapEntity[]>();
  private readonly relations = new Map<number, Relation[]>();
  private readonly nameList: { name: string; lower: string }[] = [];

  constructor(entities: MapEntity[]) {
    this.entities = entities;
    for (const e of entities) {
      this.byId.set(e.id, e);
      if (e.hammerId) {
        const list = this.byHammerId.get(e.hammerId);
        if (list) list.push(e);
        else this.byHammerId.set(e.hammerId, [e]);
      }
      if (e.targetname) {
        const lower = e.targetname.toLowerCase();
        this.addName(this.scopeMap(e.source.scope), lower, e);
        this.addName(this.globalByName, lower, e);
        const friendly = friendlyName(lower);
        if (friendly !== lower) {
          this.addName(this.scopeMap(e.source.scope), friendly, e);
          this.addName(this.globalByName, friendly, e);
        }
      }
    }
    for (const [lower] of this.globalByName) this.nameList.push({ name: lower, lower });
    this.buildRelations();
  }

  private scopeMap(scope: string): Map<string, MapEntity[]> {
    let m = this.byName.get(scope);
    if (!m) {
      m = new Map();
      this.byName.set(scope, m);
    }
    return m;
  }

  private addName(map: Map<string, MapEntity[]>, name: string, e: MapEntity): void {
    const list = map.get(name);
    if (list) {
      if (!list.includes(e)) list.push(e);
    } else map.set(name, [e]);
  }

  /**
   * Resolves an entity name reference the way the game does: exact name (case insensitive),
   * trailing `*` wildcard, and the `[PR#]` prefix stripped or added. Entities in the same scope
   * win; other scopes are used as a fallback so prefab instances still resolve.
   */
  resolveName(ref: string, scope?: string): MapEntity[] {
    const raw = ref.trim();
    if (!raw || raw.startsWith('!')) return [];
    const lower = friendlyName(raw.toLowerCase());
    const lookup = (map: Map<string, MapEntity[]>): MapEntity[] => {
      if (lower.endsWith('*')) {
        const prefix = lower.slice(0, -1);
        const out: MapEntity[] = [];
        for (const [name, list] of map) {
          if (name.startsWith(prefix)) for (const e of list) if (!out.includes(e)) out.push(e);
        }
        return out;
      }
      return map.get(lower) ?? [];
    };
    if (scope !== undefined) {
      const local = this.byName.get(scope);
      if (local) {
        const hit = lookup(local);
        if (hit.length > 0) return hit;
      }
    }
    return lookup(this.globalByName);
  }

  relationsOf(e: MapEntity): Relation[] {
    return this.relations.get(e.id) ?? [];
  }

  /** Connections from other entities that target `e`. */
  incomingConnections(e: MapEntity): { from: MapEntity; connection: EntityConnection }[] {
    return this.relationsOf(e)
      .filter((r) => r.kind === 'input' && r.connection)
      .map((r) => ({ from: r.other, connection: r.connection! }));
  }

  private addRelation(from: MapEntity, rel: Relation): void {
    const list = this.relations.get(from.id);
    if (list) list.push(rel);
    else this.relations.set(from.id, [rel]);
  }

  private buildRelations(): void {
    for (const e of this.entities) {
      // Entity I/O
      for (const c of e.connections) {
        const targets = this.resolveTargets(c, e);
        for (const t of targets) {
          if (t === e) continue;
          this.addRelation(e, { kind: 'output', other: t, label: `${c.output} → ${c.input}`, connection: c });
          this.addRelation(t, { kind: 'input', other: e, label: `${c.output} → ${c.input}`, connection: c });
        }
      }
      // Key values referencing names
      for (const [key, value] of Object.entries(e.props)) {
        if (!value || NEVER_REF_KEYS.has(key)) continue;
        const explicit = NAME_REF_KEYS.has(key);
        if (!explicit && !this.looksLikeName(value)) continue;
        const targets = this.resolveName(value, e.source.scope);
        for (const t of targets) {
          if (t === e) continue;
          const isParent = key === 'parentname';
          const isTemplate = /^template\d\d$/.test(key);
          const kind: RelationKind = isParent ? 'parent' : isTemplate ? 'template' : 'keyref';
          const back: RelationKind = isParent ? 'child' : isTemplate ? 'template-in' : 'keyref-in';
          this.addRelation(e, { kind, other: t, label: key, key });
          this.addRelation(t, { kind: back, other: e, label: key, key });
        }
      }
    }
  }

  private looksLikeName(value: string): boolean {
    // cheap pre-check: does any known targetname equal this value (ignoring [PR#])?
    const lower = friendlyName(value.toLowerCase());
    if (lower.length < 2) return false;
    if (this.globalByName.has(lower)) return true;
    if (lower.endsWith('*')) return true;
    return false;
  }

  private resolveTargets(c: EntityConnection, from: MapEntity): MapEntity[] {
    const target = c.target;
    if (!target) return [];
    switch (c.targetType) {
      case 0: // classname
      case 1: {
        const lower = target.toLowerCase();
        return this.entities.filter((e) => e.classname === lower);
      }
      case 4: // !activator
      case 5: // !caller
      case 6: // ehandle
        return [];
      case 2:
      case 7:
      default: {
        const byName = this.resolveName(target, from.source.scope);
        if (byName.length > 0) return byName;
        if (c.targetType === 7) {
          const lower = target.toLowerCase();
          return this.entities.filter((e) => e.classname === lower);
        }
        return [];
      }
    }
  }
}

export interface TreeNode {
  entity: MapEntity;
  via: Relation | null;
  /** Entity id of the parent node (null for the root). */
  parentId: number | null;
  depth: number;
  children: TreeNode[];
  /** True when this entity already appeared higher up (cycle / duplicate), children are not expanded. */
  repeated: boolean;
}

/**
 * Builds a relationship tree rooted at `root` by walking relations breadth first up to `maxDepth`.
 * Each entity is expanded once; later appearances are marked `repeated`.
 */
export function buildRelationTree(graph: EntityGraph, root: MapEntity, maxDepth = 3, maxNodes = 400): TreeNode {
  const rootNode: TreeNode = { entity: root, via: null, parentId: null, depth: 0, children: [], repeated: false };
  const expanded = new Set<number>([root.id]);
  const queue: TreeNode[] = [rootNode];
  let count = 1;
  while (queue.length > 0 && count < maxNodes) {
    const node = queue.shift()!;
    if (node.depth >= maxDepth) continue;
    for (const rel of graph.relationsOf(node.entity)) {
      if (rel.other.id === node.entity.id) continue;
      // don't bounce straight back to the parent through the same edge we arrived by
      if (node.via && node.parentId !== null && rel.other.id === node.parentId && rel.kind === inverseKind(node.via.kind)) {
        const same = rel.connection ? rel.connection === node.via.connection : rel.key === node.via.key;
        if (same) continue;
      }
      const repeated = expanded.has(rel.other.id);
      const child: TreeNode = { entity: rel.other, via: rel, parentId: node.entity.id, depth: node.depth + 1, children: [], repeated };
      node.children.push(child);
      count++;
      if (!repeated) {
        expanded.add(rel.other.id);
        queue.push(child);
      }
      if (count >= maxNodes) break;
    }
  }
  return rootNode;
}

export function inverseKind(kind: RelationKind): RelationKind {
  switch (kind) {
    case 'output':
      return 'input';
    case 'input':
      return 'output';
    case 'parent':
      return 'child';
    case 'child':
      return 'parent';
    case 'keyref':
      return 'keyref-in';
    case 'keyref-in':
      return 'keyref';
    case 'template':
      return 'template-in';
    case 'template-in':
      return 'template';
  }
}
