import { BinaryReader, guidToString } from './binaryReader';

/**
 * Valve Datamodel (DMX) binary decoder. Hammer saves CS2 .vmap files as
 * "<!-- dmx encoding binary 9 format vmap N -->".
 *
 * Layout follows Datamodel.NET's Binary codec.
 */

export enum DmxAttrType {
  Element = 'element',
  Int = 'int',
  Float = 'float',
  Bool = 'bool',
  String = 'string',
  Binary = 'binary',
  Time = 'time',
  ObjectId = 'objectid',
  Color = 'color',
  Vector2 = 'vector2',
  Vector3 = 'vector3',
  Vector4 = 'vector4',
  QAngle = 'qangle',
  Quaternion = 'quaternion',
  Matrix = 'matrix',
  UInt64 = 'uint64',
  Byte = 'byte',
}

const TYPES_V1_2: DmxAttrType[] = [
  DmxAttrType.Element, DmxAttrType.Int, DmxAttrType.Float, DmxAttrType.Bool, DmxAttrType.String, DmxAttrType.Binary,
  DmxAttrType.ObjectId, DmxAttrType.Color, DmxAttrType.Vector2, DmxAttrType.Vector3, DmxAttrType.Vector4, DmxAttrType.QAngle,
  DmxAttrType.Quaternion, DmxAttrType.Matrix,
];
const TYPES_V3_5: DmxAttrType[] = [
  DmxAttrType.Element, DmxAttrType.Int, DmxAttrType.Float, DmxAttrType.Bool, DmxAttrType.String, DmxAttrType.Binary,
  DmxAttrType.Time, DmxAttrType.Color, DmxAttrType.Vector2, DmxAttrType.Vector3, DmxAttrType.Vector4, DmxAttrType.QAngle,
  DmxAttrType.Quaternion, DmxAttrType.Matrix,
];
const TYPES_V9: DmxAttrType[] = [
  ...TYPES_V3_5, DmxAttrType.UInt64, DmxAttrType.Byte,
];

/** Numeric array payloads stay flat and typed; `stride` is the component count per item. */
export interface DmxTypedArray {
  kind: 'typed';
  type: DmxAttrType;
  data: Float32Array | Int32Array | Uint8Array | BigUint64Array;
  stride: number;
}

export type DmxScalar = null | boolean | number | bigint | string | Uint8Array | DmxElement | Float32Array;
export type DmxValue = DmxScalar | DmxValue[] | DmxTypedArray;

export interface DmxElement {
  index: number;
  type: string;
  name: string;
  id: string;
  attrs: Map<string, DmxValue>;
}

export interface DmxDocument {
  encoding: string;
  encodingVersion: number;
  format: string;
  formatVersion: number;
  prefix: Map<string, DmxValue>;
  elements: DmxElement[];
  root: DmxElement | null;
}

export function isDmxTypedArray(v: DmxValue | undefined): v is DmxTypedArray {
  return typeof v === 'object' && v !== null && (v as DmxTypedArray).kind === 'typed';
}

export function isDmxElement(v: DmxValue | undefined): v is DmxElement {
  return typeof v === 'object' && v !== null && 'attrs' in (v as object) && (v as DmxElement).attrs instanceof Map;
}

export function dmxElementArray(v: DmxValue | undefined): DmxElement[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isDmxElement);
}

export function dmxString(v: DmxValue | undefined, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function dmxNumber(v: DmxValue | undefined, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

export function dmxValueToString(v: DmxValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Float32Array) return Array.from(v, (x) => String(Number(x.toFixed(6)))).join(' ');
  if (v instanceof Uint8Array) return `<binary ${v.length} bytes>`;
  if (isDmxTypedArray(v)) return `<${v.type}[${v.data.length / v.stride}]>`;
  if (isDmxElement(v)) return `<${v.type} ${v.name}>`;
  if (Array.isArray(v)) return v.map(dmxValueToString).join(', ');
  return '';
}

class Decoder {
  readonly r: BinaryReader;
  readonly version: number;
  readonly typeList: DmxAttrType[];
  strings: string[] = [];
  elements: DmxElement[] = [];

  constructor(bytes: Uint8Array, pos: number, version: number) {
    this.r = new BinaryReader(bytes, pos);
    this.version = version;
    this.typeList = version >= 9 ? TYPES_V9 : version >= 3 ? TYPES_V3_5 : TYPES_V1_2;
  }

  idToType(id: number): { type: DmxAttrType; isArray: boolean } {
    const len = this.typeList.length;
    let i = id - 1;
    let isArray = false;
    if (this.version >= 9 && i >= len * 2) {
      isArray = true;
      i -= len * 2;
    } else if (i >= len) {
      i -= len;
      isArray = true;
    }
    if (i < 0 || i >= len) throw new Error(`DMX: unknown attribute type id ${id}`);
    return { type: this.typeList[i], isArray };
  }

  readDictString(): string {
    if (this.version === 1) return this.r.cstring();
    const idx = this.version < 5 ? this.r.i16() : this.r.i32();
    if (idx < 0 || idx >= this.strings.length) throw new Error(`DMX: string index ${idx} out of range`);
    return this.strings[idx];
  }

  readElementRef(): DmxElement | null {
    const index = this.r.i32();
    if (index === -1) return null;
    if (index === -2) {
      // stub element referenced by GUID string; we do not resolve stubs
      this.r.cstring();
      return null;
    }
    if (index < 0 || index >= this.elements.length) throw new Error(`DMX: element index ${index} out of range`);
    return this.elements[index];
  }

  readScalar(type: DmxAttrType, rawString: boolean): DmxScalar {
    const r = this.r;
    switch (type) {
      case DmxAttrType.Element:
        return this.readElementRef();
      case DmxAttrType.Int:
        return r.i32();
      case DmxAttrType.Float:
        return r.f32();
      case DmxAttrType.Bool:
        return r.u8() !== 0;
      case DmxAttrType.String:
        return rawString ? r.cstring() : this.readDictString();
      case DmxAttrType.Binary: {
        const n = r.i32();
        return r.take(n).slice();
      }
      case DmxAttrType.Time:
        return r.i32() / 10000;
      case DmxAttrType.ObjectId:
        return guidToString(r.take(16));
      case DmxAttrType.Color:
        return r.take(4).slice();
      case DmxAttrType.Vector2:
        return new Float32Array([r.f32(), r.f32()]);
      case DmxAttrType.Vector3:
      case DmxAttrType.QAngle:
        return new Float32Array([r.f32(), r.f32(), r.f32()]);
      case DmxAttrType.Vector4:
      case DmxAttrType.Quaternion:
        return new Float32Array([r.f32(), r.f32(), r.f32(), r.f32()]);
      case DmxAttrType.Matrix: {
        const m = new Float32Array(16);
        for (let i = 0; i < 16; i++) m[i] = r.f32();
        return m;
      }
      case DmxAttrType.UInt64:
        return r.u64();
      case DmxAttrType.Byte:
        return r.u8();
      default:
        throw new Error(`DMX: cannot read type ${type}`);
    }
  }

  readArray(type: DmxAttrType, count: number): DmxValue {
    const r = this.r;
    const floatStride: Partial<Record<DmxAttrType, number>> = {
      [DmxAttrType.Float]: 1,
      [DmxAttrType.Vector2]: 2,
      [DmxAttrType.Vector3]: 3,
      [DmxAttrType.QAngle]: 3,
      [DmxAttrType.Vector4]: 4,
      [DmxAttrType.Quaternion]: 4,
      [DmxAttrType.Matrix]: 16,
    };
    const fs = floatStride[type];
    if (fs !== undefined) {
      const n = count * fs;
      const copy = r.take(n * 4).slice(); // copy to guarantee alignment
      const data = new Float32Array(copy.buffer, copy.byteOffset, n);
      return { kind: 'typed', type, data, stride: fs };
    }
    switch (type) {
      case DmxAttrType.Int:
      case DmxAttrType.Time: {
        const copy = r.take(count * 4).slice();
        const data = new Int32Array(copy.buffer, copy.byteOffset, count);
        return { kind: 'typed', type, data, stride: 1 };
      }
      case DmxAttrType.Bool:
      case DmxAttrType.Byte:
        return { kind: 'typed', type, data: r.take(count).slice(), stride: 1 };
      case DmxAttrType.Color:
        return { kind: 'typed', type, data: r.take(count * 4).slice(), stride: 4 };
      case DmxAttrType.UInt64: {
        const copy = r.take(count * 8).slice();
        const data = new BigUint64Array(copy.buffer, copy.byteOffset, count);
        return { kind: 'typed', type, data, stride: 1 };
      }
      default: {
        const items: DmxValue[] = new Array(count);
        for (let i = 0; i < count; i++) items[i] = this.readScalar(type, true);
        return items;
      }
    }
  }

  readAttribute(prefix: boolean): DmxValue {
    const { type, isArray } = this.idToType(this.r.u8());
    if (isArray) {
      const count = this.r.i32();
      return this.readArray(type, count);
    }
    return this.readScalar(type, this.version < 4 || prefix);
  }
}

const HEADER_RE = /<!--\s*dmx\s+encoding\s+(\w+)\s+(\d+)\s+format\s+(\w+)\s+(\d+)\s*-->/;

export function parseDmxHeader(bytes: Uint8Array): { encoding: string; encodingVersion: number; format: string; formatVersion: number; headerEnd: number } {
  let end = 0;
  const limit = Math.min(bytes.length, 256);
  while (end < limit && bytes[end] !== 0) end++;
  const text = new TextDecoder().decode(bytes.subarray(0, end));
  const m = HEADER_RE.exec(text);
  if (!m) throw new Error('Not a DMX file (missing "<!-- dmx encoding ... -->" header)');
  return { encoding: m[1], encodingVersion: parseInt(m[2], 10), format: m[3], formatVersion: parseInt(m[4], 10), headerEnd: end + 1 };
}

export function parseDmx(bytes: Uint8Array): DmxDocument {
  const h = parseDmxHeader(bytes);
  if (h.encoding !== 'binary') {
    throw new Error(`DMX encoding "${h.encoding}" is not supported (only binary). Re-save the map in Hammer.`);
  }
  if (![1, 2, 3, 4, 5, 9].includes(h.encodingVersion)) {
    throw new Error(`DMX binary encoding version ${h.encodingVersion} is not supported`);
  }

  const d = new Decoder(bytes, h.headerEnd, h.encodingVersion);
  const r = d.r;
  const prefix = new Map<string, DmxValue>();

  if (h.encodingVersion >= 9) {
    const prefixElements = r.i32();
    for (let p = 0; p < prefixElements; p++) {
      const attrCount = r.i32();
      for (let a = 0; a < attrCount; a++) {
        const name = r.cstring();
        const value = d.readAttribute(true);
        if (p === 0) prefix.set(name, value);
      }
    }
  }

  // string dictionary
  if (h.encodingVersion >= 2) {
    const count = h.encodingVersion < 4 ? r.i16() : r.i32();
    d.strings = new Array(count);
    for (let i = 0; i < count; i++) d.strings[i] = r.cstring();
  }

  const elementCount = r.i32();
  d.elements = new Array(elementCount);
  for (let i = 0; i < elementCount; i++) {
    const type = d.readDictString();
    const name = h.encodingVersion >= 4 ? d.readDictString() : r.cstring();
    const id = guidToString(r.take(16));
    d.elements[i] = { index: i, type, name, id, attrs: new Map() };
  }

  for (let i = 0; i < elementCount; i++) {
    const el = d.elements[i];
    const attrCount = r.i32();
    for (let a = 0; a < attrCount; a++) {
      const name = d.readDictString();
      el.attrs.set(name, d.readAttribute(false));
    }
  }

  return {
    encoding: h.encoding,
    encodingVersion: h.encodingVersion,
    format: h.format,
    formatVersion: h.formatVersion,
    prefix,
    elements: d.elements,
    root: d.elements[0] ?? null,
  };
}
