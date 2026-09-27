import { BinaryReader } from './binaryReader';
import { kvArray, kvNumber, kvObject, kvString, kvToDisplayString, type KVObject, type KVValue } from './kv3';
import { readResourceKV3Data } from './resource';
import { ENTITY_KEY_SEED, murmur2Lower } from './murmur2';
import { KNOWN_ENTITY_KEYS } from './knownKeys';

export interface RawConnection {
  output: string;
  targetType: number;
  target: string;
  input: string;
  param: string;
  delay: number;
  timesToFire: number;
}

export interface RawEntity {
  /** Lowercased key -> display string value. */
  props: Map<string, string>;
  connections: RawConnection[];
}

export interface ParsedEntityLump {
  name: string;
  hammerUniqueId: string;
  childLumps: string[];
  entities: RawEntity[];
}

// fieldtype_t values that appear inside m_keyValuesData
const enum FieldType {
  Float = 0x1,
  Vector = 0x3,
  Integer = 0x5,
  Boolean = 0x6,
  Color32 = 0x9,
  Integer64 = 0x1a,
  CString = 0x1e,
  UInt64 = 0x21,
  Float64 = 0x22,
  UInt = 0x25,
  QAngle = 0x27,
}

let knownKeyTable: Map<number, string> | null = null;

function knownKeys(): Map<number, string> {
  if (!knownKeyTable) {
    knownKeyTable = new Map();
    for (const key of KNOWN_ENTITY_KEYS.split('\n')) {
      if (key.length === 0) continue;
      knownKeyTable.set(murmur2Lower(key, ENTITY_KEY_SEED), key);
    }
  }
  return knownKeyTable;
}

export function resolveEntityKeyHash(hash: number): string {
  return knownKeys().get(hash) ?? `unknown_key_${hash}`;
}

function fmtFloat(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
}

/** Decodes the packed (hashed key) entity key value blob used by older compiled maps. */
export function parseKeyValuesData(bytes: Uint8Array): Map<string, string> {
  const r = new BinaryReader(bytes);
  const props = new Map<string, string>();
  const version = r.u32();
  if (version !== 1) throw new Error(`Unsupported entity key values version ${version}`);
  const hashedCount = r.u32();
  const stringCount = r.u32();

  const readTyped = (): string => {
    const type = r.u32();
    switch (type) {
      case FieldType.Boolean:
        return r.u8() ? '1' : '0';
      case FieldType.Float:
        return fmtFloat(r.f32());
      case FieldType.Float64:
        return fmtFloat(r.f64());
      case FieldType.Color32: {
        const c = r.take(4);
        return `${c[0]} ${c[1]} ${c[2]} ${c[3]}`;
      }
      case FieldType.Integer:
        return String(r.i32());
      case FieldType.UInt:
        return String(r.u32());
      case FieldType.Integer64:
        return r.i64().toString();
      case FieldType.UInt64:
        return r.u64().toString();
      case FieldType.Vector:
      case FieldType.QAngle:
        return `${fmtFloat(r.f32())} ${fmtFloat(r.f32())} ${fmtFloat(r.f32())}`;
      case FieldType.CString:
        return r.cstring();
      default:
        throw new Error(`Unknown entity field type 0x${type.toString(16)}`);
    }
  };

  for (let i = 0; i < hashedCount; i++) {
    const hash = r.u32();
    const value = readTyped();
    props.set(resolveEntityKeyHash(hash), value);
  }
  for (let i = 0; i < stringCount; i++) {
    r.u32(); // hash of the following name
    const name = r.cstring().toLowerCase();
    const value = readTyped();
    props.set(name, value);
  }
  return props;
}

function readKV3Values(props: Map<string, string>, values: KVValue | undefined): void {
  const obj = kvObject(values);
  if (!obj) return;
  for (const [key, value] of obj) {
    props.set(key.toLowerCase(), kvToDisplayString(value));
  }
}

function parseConnection(c: KVObject): RawConnection {
  return {
    output: kvString(c.get('m_outputName')),
    targetType: kvNumber(c.get('m_targetType')),
    target: kvString(c.get('m_targetName')),
    input: kvString(c.get('m_inputName')),
    param: kvString(c.get('m_overrideParam')),
    delay: kvNumber(c.get('m_flDelay')),
    timesToFire: kvNumber(c.get('m_nTimesToFire'), -1),
  };
}

export function parseEntityLumpKV(root: KVObject): ParsedEntityLump {
  const entities: RawEntity[] = [];
  for (const item of kvArray(root.get('m_entityKeyValues'))) {
    const ekv = kvObject(item);
    if (!ekv) continue;
    const props = new Map<string, string>();
    const kv3data = kvObject(ekv.get('keyValues3Data'));
    const packed = ekv.get('m_keyValuesData');
    if (kv3data) {
      readKV3Values(props, kv3data.get('values'));
      readKV3Values(props, kv3data.get('attributes'));
    } else if (packed instanceof Uint8Array && packed.length > 0) {
      for (const [k, v] of parseKeyValuesData(packed)) props.set(k, v);
    }
    if (!props.has('classname')) continue;
    const connections: RawConnection[] = [];
    for (const c of kvArray(ekv.get('m_connections'))) {
      const co = kvObject(c);
      if (co) connections.push(parseConnection(co));
    }
    entities.push({ props, connections });
  }

  return {
    name: kvString(root.get('m_name')),
    hammerUniqueId: kvString(root.get('m_hammerUniqueId')),
    childLumps: kvArray(root.get('m_childLumps')).map((v) => kvString(v)).filter((s) => s.length > 0),
    entities,
  };
}

/** Parses a compiled entity lump (*.vents_c). */
export function parseEntityLump(bytes: Uint8Array): ParsedEntityLump {
  const doc = readResourceKV3Data(bytes);
  const root = kvObject(doc.root);
  if (!root) throw new Error('Entity lump root is not an object');
  return parseEntityLumpKV(root);
}
