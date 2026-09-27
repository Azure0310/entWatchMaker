import { BinaryReader, bigintToNumberIfSafe, decodeUtf8, guidToString } from './binaryReader';
import { lz4DecompressBlock } from './lz4';
import { blockDecompress } from './blockCompress';
import { decompress as zstdDecompress } from 'fzstd';

/**
 * Binary KeyValues3 reader for Source 2 resource DATA blocks (versions 0 through 5),
 * written against the layout documented by ValveResourceFormat's BinaryKV3.cs.
 */

export type KVValue = null | boolean | number | bigint | string | Uint8Array | KVValue[] | KVObject;
export type KVObject = Map<string, KVValue>;

export interface KV3Document {
  version: number;
  format: string;
  root: KVValue;
}

const MAGIC0 = 0x03564b56; // VKV\x03 (legacy)
const MAGIC_BASE = 0x4b563300; // KV3\x0N

const ENC_BINARY_BC = '95791a46-95bc-4f6c-a70b-05bca1b7dfd2';
const ENC_BINARY_LZ4 = '6847348a-63a1-4f5c-a197-53806fd9b119';
const ENC_BINARY = '1b860500-f7d8-40c1-ad82-75a48267e714';

const TRAILER = 0xffeedd00;
const COMPRESSION_FRAME_SIZE = 16384;

const enum NodeType {
  NULL = 1,
  BOOLEAN = 2,
  INT64 = 3,
  UINT64 = 4,
  DOUBLE = 5,
  STRING = 6,
  BINARY_BLOB = 7,
  ARRAY = 8,
  OBJECT = 9,
  ARRAY_TYPED = 10,
  INT32 = 11,
  UINT32 = 12,
  BOOLEAN_TRUE = 13,
  BOOLEAN_FALSE = 14,
  INT64_ZERO = 15,
  INT64_ONE = 16,
  DOUBLE_ZERO = 17,
  DOUBLE_ONE = 18,
  FLOAT = 19,
  INT16 = 20,
  UINT16 = 21,
  UNKNOWN_22 = 22,
  INT32_AS_BYTE = 23,
  ARRAY_TYPE_BYTE_LENGTH = 24,
  ARRAY_TYPE_AUXILIARY_BUFFER = 25,
}

export function isBinaryKV3Magic(magic: number): boolean {
  return magic === MAGIC0 || (magic & 0xffffff00) === MAGIC_BASE;
}

/** A cursor over a byte range; number reads are unaligned little-endian. */
class Cursor {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array, public pos: number, public end: number) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  static empty(): Cursor {
    return new Cursor(new Uint8Array(0), 0, 0);
  }
  get remaining(): number {
    return this.end - this.pos;
  }
  private need(n: number, what: string): void {
    if (this.pos + n > this.end) throw new Error(`KV3: ran out of ${what} data`);
  }
  u8(): number {
    this.need(1, 'byte');
    return this.bytes[this.pos++];
  }
  i16(): number {
    this.need(2, 'int16');
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2, 'uint16');
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4, 'int32');
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  u32(): number {
    this.need(4, 'uint32');
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f32(): number {
    this.need(4, 'float');
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8, 'double');
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  i64(): bigint {
    this.need(8, 'int64');
    const v = this.view.getBigInt64(this.pos, true);
    this.pos += 8;
    return v;
  }
  u64(): bigint {
    this.need(8, 'uint64');
    const v = this.view.getBigUint64(this.pos, true);
    this.pos += 8;
    return v;
  }
  take(n: number): Uint8Array {
    this.need(n, 'blob');
    const v = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }
  cstring(): string {
    let e = this.pos;
    while (e < this.end && this.bytes[e] !== 0) e++;
    if (e >= this.end) throw new Error('KV3: unterminated string');
    const s = decodeUtf8(this.bytes.subarray(this.pos, e));
    this.pos = e + 1;
    return s;
  }
}

interface Buffers {
  bytes1: Cursor;
  bytes2: Cursor;
  bytes4: Cursor;
  bytes8: Cursor;
}

interface Context {
  version: number;
  strings: string[];
  types: Cursor;
  objectLengths: Cursor;
  binaryBlobs: Cursor;
  binaryBlobLengths: Cursor;
  buffer: Buffers;
  auxiliaryBuffer: Buffers;
}

function alignUp(v: number, a: number): number {
  return (v + a - 1) & ~(a - 1);
}

function emptyBuffers(): Buffers {
  return { bytes1: Cursor.empty(), bytes2: Cursor.empty(), bytes4: Cursor.empty(), bytes8: Cursor.empty() };
}

/**
 * Parses a binary KV3 block located at bytes[offset .. offset+size).
 */
export function parseBinaryKV3(bytes: Uint8Array, offset = 0, size = bytes.length - offset): KV3Document {
  const block = bytes.subarray(offset, offset + size);
  const reader = new BinaryReader(block);
  const magic = reader.u32();

  if (magic === MAGIC0) {
    return readVersion0(reader);
  }

  if ((magic & 0xffffff00) !== MAGIC_BASE) {
    throw new Error(`KV3: unsupported signature 0x${magic.toString(16)}`);
  }
  const version = magic & 0xff;
  if (version < 1 || version > 5) {
    throw new Error(`KV3: unsupported version ${version}`);
  }
  return readVersioned(version, reader);
}

// ---------------------------------------------------------------------------------------------
// Legacy version 0 (VKV\x03)
// ---------------------------------------------------------------------------------------------

function readVersion0(reader: BinaryReader): KV3Document {
  const encoding = guidToString(reader.take(16));
  const format = guidToString(reader.take(16));

  let payload: Uint8Array;
  if (encoding === ENC_BINARY_BC) {
    payload = blockDecompress(reader);
  } else if (encoding === ENC_BINARY_LZ4) {
    const uncompressedSize = reader.i32();
    payload = new Uint8Array(uncompressedSize);
    const written = lz4DecompressBlock(reader.take(reader.remaining), payload);
    if (written !== uncompressedSize) throw new Error('KV3: LZ4 size mismatch');
  } else if (encoding === ENC_BINARY) {
    payload = reader.take(reader.remaining);
  } else {
    throw new Error(`KV3: unrecognised legacy encoding ${encoding}`);
  }

  const c = new Cursor(payload, 0, payload.length);
  const stringCount = c.u32();
  const strings: string[] = new Array(stringCount);
  for (let i = 0; i < stringCount; i++) strings[i] = c.cstring();

  const [rootType] = legacyReadType(c);
  const root = legacyReadValue(strings, rootType, c);
  const trailer = c.u32();
  if (trailer !== 0xffffffff) throw new Error('KV3: invalid legacy trailer');
  return { version: 0, format, root };
}

function legacyReadType(c: Cursor): [NodeType, number] {
  let databyte = c.u8();
  let flag = 0;
  if ((databyte & 0x80) > 0) {
    databyte &= 0x7f;
    flag = c.u8();
  }
  return [databyte as NodeType, flag];
}

function legacyReadValue(strings: string[], type: NodeType, c: Cursor): KVValue {
  switch (type) {
    case NodeType.NULL:
      return null;
    case NodeType.BOOLEAN:
      return c.u8() === 1;
    case NodeType.BOOLEAN_TRUE:
      return true;
    case NodeType.BOOLEAN_FALSE:
      return false;
    case NodeType.INT64_ZERO:
      return 0;
    case NodeType.INT64_ONE:
      return 1;
    case NodeType.INT64:
      return bigintToNumberIfSafe(c.i64());
    case NodeType.UINT64:
      return bigintToNumberIfSafe(c.u64());
    case NodeType.INT32:
      return c.i32();
    case NodeType.UINT32:
      return c.u32();
    case NodeType.DOUBLE:
      return c.f64();
    case NodeType.DOUBLE_ZERO:
      return 0;
    case NodeType.DOUBLE_ONE:
      return 1;
    case NodeType.STRING: {
      const id = c.i32();
      return id === -1 ? '' : strings[id];
    }
    case NodeType.BINARY_BLOB: {
      const len = c.i32();
      return c.take(len).slice();
    }
    case NodeType.ARRAY: {
      const len = c.i32();
      const arr: KVValue[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const [t] = legacyReadType(c);
        arr[i] = legacyReadValue(strings, t, c);
      }
      return arr;
    }
    case NodeType.ARRAY_TYPED: {
      const len = c.i32();
      const [sub] = legacyReadType(c);
      const arr: KVValue[] = new Array(len);
      for (let i = 0; i < len; i++) arr[i] = legacyReadValue(strings, sub, c);
      return arr;
    }
    case NodeType.OBJECT: {
      const len = c.i32();
      const obj: KVObject = new Map();
      for (let i = 0; i < len; i++) {
        const id = c.i32();
        const name = id === -1 ? '' : strings[id];
        const [t] = legacyReadType(c);
        obj.set(name, legacyReadValue(strings, t, c));
      }
      return obj;
    }
    default:
      throw new Error(`KV3: unknown legacy node type ${type}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Versions 1 - 5
// ---------------------------------------------------------------------------------------------

function decompressInto(method: number, reader: BinaryReader, compressedSize: number, out: Uint8Array): void {
  if (method === 0) {
    out.set(reader.take(out.length));
  } else if (method === 1) {
    const written = lz4DecompressBlock(reader.take(compressedSize), out);
    if (written !== out.length) throw new Error(`KV3: LZ4 produced ${written} bytes, expected ${out.length}`);
  } else if (method === 2) {
    // fzstd cannot write several concatenated frames into one caller supplied buffer, so let it
    // allocate and copy the result over (Valve emits an extra empty frame when there are no blobs).
    const result = zstdDecompress(reader.take(compressedSize));
    if (result.length !== out.length) throw new Error(`KV3: ZSTD produced ${result.length} bytes, expected ${out.length}`);
    out.set(result);
  } else {
    throw new Error(`KV3: unknown compression method ${method}`);
  }
}

function readVersioned(version: number, reader: BinaryReader): KV3Document {
  const format = guidToString(reader.take(16));
  const compressionMethod = reader.u32();
  if (compressionMethod > 2) throw new Error(`KV3: unknown compression method ${compressionMethod}`);

  let compressionDictionaryId = 0;
  let compressionFrameSize = 0;
  let countBytes1 = 0;
  let countBytes4 = 0;
  let countBytes8 = 0;
  let countTypes = 0;
  let sizeUncompressedTotal = 0;
  let sizeCompressedTotal = 0;
  let countBlocks = 0;
  let sizeBinaryBlobsBytes = 0;

  if (version === 1) {
    countBytes1 = reader.i32();
    countBytes4 = reader.i32();
    countBytes8 = reader.i32();
    sizeUncompressedTotal = reader.i32();
    sizeCompressedTotal = reader.remaining;
  } else {
    compressionDictionaryId = reader.u16();
    compressionFrameSize = reader.u16();
    countBytes1 = reader.i32();
    countBytes4 = reader.i32();
    countBytes8 = reader.i32();
    countTypes = reader.i32();
    reader.u16(); // countObjects
    reader.u16(); // countArrays
    sizeUncompressedTotal = reader.i32();
    sizeCompressedTotal = reader.i32();
    countBlocks = reader.i32();
    sizeBinaryBlobsBytes = reader.i32();
  }

  let countBytes2 = 0;
  let sizeBlockCompressedSizesBytes = 0;
  if (version >= 4) {
    countBytes2 = reader.i32();
    sizeBlockCompressedSizesBytes = reader.i32();
  }

  let sizeUncompressedBuffer1: number;
  let sizeCompressedBuffer1: number;
  let sizeUncompressedBuffer2 = 0;
  let sizeCompressedBuffer2 = 0;
  let countBytes1_buffer2 = 0;
  let countBytes2_buffer2 = 0;
  let countBytes4_buffer2 = 0;
  let countBytes8_buffer2 = 0;
  let countObjects_buffer2 = 0;

  if (version >= 5) {
    sizeUncompressedBuffer1 = reader.i32();
    sizeCompressedBuffer1 = reader.i32();
    sizeUncompressedBuffer2 = reader.i32();
    sizeCompressedBuffer2 = reader.i32();
    countBytes1_buffer2 = reader.i32();
    countBytes2_buffer2 = reader.i32();
    countBytes4_buffer2 = reader.i32();
    countBytes8_buffer2 = reader.i32();
    reader.i32(); // unk13
    countObjects_buffer2 = reader.i32();
    reader.i32(); // countArrays_buffer2
    reader.i32(); // unk16
  } else {
    sizeCompressedBuffer1 = sizeCompressedTotal;
    sizeUncompressedBuffer1 = sizeUncompressedTotal;
  }

  if (compressionDictionaryId !== 0) throw new Error('KV3: compression dictionaries are not supported');
  if (compressionMethod === 1 && version >= 2 && compressionFrameSize !== COMPRESSION_FRAME_SIZE) {
    throw new Error(`KV3: unexpected LZ4 frame size ${compressionFrameSize}`);
  }

  const ctx: Context = {
    version,
    strings: [],
    types: Cursor.empty(),
    objectLengths: Cursor.empty(),
    binaryBlobs: Cursor.empty(),
    binaryBlobLengths: Cursor.empty(),
    buffer: emptyBuffers(),
    auxiliaryBuffer: emptyBuffers(),
  };

  let bufferWithBinaryBlobSizes: Cursor | null = null;

  // ---- Buffer 1 -------------------------------------------------------------------------
  const buffer1Length =
    version < 5 && compressionMethod === 2 ? sizeUncompressedBuffer1 + sizeBinaryBlobsBytes : sizeUncompressedBuffer1;
  const buffer1Raw = new Uint8Array(buffer1Length);

  if (compressionMethod === 0) {
    buffer1Raw.set(reader.take(sizeUncompressedBuffer1), 0);
  } else {
    decompressInto(compressionMethod, reader, sizeCompressedBuffer1, buffer1Raw);
  }

  {
    const b = emptyBuffers();
    let off = 0;
    if (countBytes1 > 0) {
      b.bytes1 = new Cursor(buffer1Raw, off, off + countBytes1);
      off += countBytes1;
    }
    if (countBytes2 > 0) {
      off = alignUp(off, 2);
      b.bytes2 = new Cursor(buffer1Raw, off, off + countBytes2 * 2);
      off += countBytes2 * 2;
    }
    if (countBytes4 > 0) {
      off = alignUp(off, 4);
      b.bytes4 = new Cursor(buffer1Raw, off, off + countBytes4 * 4);
      off += countBytes4 * 4;
    }
    if (countBytes8 > 0) {
      off = alignUp(off, 8);
      b.bytes8 = new Cursor(buffer1Raw, off, off + countBytes8 * 8);
      off += countBytes8 * 8;
    } else if (version < 5) {
      off = alignUp(off, 8);
    }

    if (countBytes4 <= 0) throw new Error('KV3: missing string count');
    const countStrings = b.bytes4.i32();
    ctx.strings = new Array(countStrings);

    if (version >= 5) {
      ctx.auxiliaryBuffer = b;
      for (let i = 0; i < countStrings; i++) ctx.strings[i] = b.bytes1.cstring();
    } else {
      ctx.buffer = b;
      const stringsStartOffset = off;
      const sc = new Cursor(buffer1Raw, off, sizeUncompressedBuffer1);
      for (let i = 0; i < countStrings; i++) ctx.strings[i] = sc.cstring();
      off = sc.pos;

      let typesLength: number;
      if (version === 1) {
        typesLength = sizeUncompressedTotal - off - 4;
      } else {
        typesLength = countTypes - off + stringsStartOffset;
      }
      ctx.types = new Cursor(buffer1Raw, off, off + typesLength);
      off += typesLength;

      if (countBlocks === 0) {
        const t = new Cursor(buffer1Raw, off, sizeUncompressedBuffer1);
        const trailer = t.u32();
        if (trailer !== TRAILER) throw new Error(`KV3: bad trailer 0x${trailer.toString(16)} (buffer 1)`);
      } else {
        bufferWithBinaryBlobSizes = new Cursor(buffer1Raw, off, sizeUncompressedBuffer1);
      }
    }
  }

  // ---- Buffer 2 (v5) ----------------------------------------------------------------------
  if (version >= 5) {
    const buffer2Raw = new Uint8Array(sizeUncompressedBuffer2);
    if (compressionMethod === 0) {
      buffer2Raw.set(reader.take(sizeUncompressedBuffer2));
    } else {
      decompressInto(compressionMethod, reader, sizeCompressedBuffer2, buffer2Raw);
    }

    const b = emptyBuffers();
    ctx.buffer = b;
    let off = countObjects_buffer2 * 4;
    ctx.objectLengths = new Cursor(buffer2Raw, 0, off);

    if (countBytes1_buffer2 > 0) {
      b.bytes1 = new Cursor(buffer2Raw, off, off + countBytes1_buffer2);
      off += countBytes1_buffer2;
    }
    if (countBytes2_buffer2 > 0) {
      off = alignUp(off, 2);
      b.bytes2 = new Cursor(buffer2Raw, off, off + countBytes2_buffer2 * 2);
      off += countBytes2_buffer2 * 2;
    }
    if (countBytes4_buffer2 > 0) {
      off = alignUp(off, 4);
      b.bytes4 = new Cursor(buffer2Raw, off, off + countBytes4_buffer2 * 4);
      off += countBytes4_buffer2 * 4;
    }
    if (countBytes8_buffer2 > 0) {
      off = alignUp(off, 8);
      b.bytes8 = new Cursor(buffer2Raw, off, off + countBytes8_buffer2 * 8);
      off += countBytes8_buffer2 * 8;
    }

    ctx.types = new Cursor(buffer2Raw, off, off + countTypes);
    off += countTypes;

    if (countBlocks === 0) {
      const t = new Cursor(buffer2Raw, off, buffer2Raw.length);
      const trailer = t.u32();
      if (trailer !== TRAILER) throw new Error(`KV3: bad trailer 0x${trailer.toString(16)} (buffer 2)`);
    } else {
      bufferWithBinaryBlobSizes = new Cursor(buffer2Raw, off, buffer2Raw.length);
    }
  }

  // ---- Binary blobs -----------------------------------------------------------------------
  if (countBlocks > 0) {
    if (!bufferWithBinaryBlobSizes) throw new Error('KV3: missing blob size table');
    const sizes = bufferWithBinaryBlobSizes;
    ctx.binaryBlobLengths = new Cursor(sizes.bytes, sizes.pos, sizes.pos + countBlocks * 4);
    sizes.pos += countBlocks * 4;
    const trailer = sizes.u32();
    if (trailer !== TRAILER) throw new Error(`KV3: bad trailer 0x${trailer.toString(16)} (blob sizes)`);

    if (compressionMethod === 0) {
      const blobs = reader.take(sizeBinaryBlobsBytes);
      ctx.binaryBlobs = new Cursor(blobs, 0, blobs.length);
    } else if (compressionMethod === 1) {
      const blobs = new Uint8Array(sizeBinaryBlobsBytes);
      let decompressedOffset = 0;
      while (sizes.remaining >= 2 && decompressedOffset < sizeBinaryBlobsBytes) {
        const compressedBlockLength = sizes.u16();
        const frame = Math.min(compressionFrameSize, sizeBinaryBlobsBytes - decompressedOffset);
        const input = reader.take(compressedBlockLength);
        const written = lz4DecompressBlock(input, blobs, decompressedOffset, decompressedOffset + frame);
        if (written < 1) throw new Error('KV3: LZ4 chained block produced no data');
        decompressedOffset += written;
      }
      ctx.binaryBlobs = new Cursor(blobs, 0, blobs.length);
    } else {
      if (version >= 5) {
        if (sizeBlockCompressedSizesBytes !== 0) throw new Error('KV3: unexpected block compressed sizes with zstd');
        const sizeCompressedBinaryBlobs = sizeCompressedTotal - sizeCompressedBuffer1 - sizeCompressedBuffer2;
        const blobs = new Uint8Array(sizeBinaryBlobsBytes);
        decompressInto(2, reader, sizeCompressedBinaryBlobs, blobs);
        ctx.binaryBlobs = new Cursor(blobs, 0, blobs.length);
      } else {
        // Before v5 the blobs were compressed together with buffer 1 and follow it directly.
        ctx.binaryBlobs = new Cursor(buffer1Raw, sizeUncompressedBuffer1, sizeUncompressedBuffer1 + sizeBinaryBlobsBytes);
      }
    }

    const streamTrailer = reader.u32();
    if (streamTrailer !== TRAILER) throw new Error(`KV3: bad trailer 0x${streamTrailer.toString(16)} (stream)`);
  }

  const [rootType] = readType(ctx);
  const root = readValue(ctx, rootType);
  return { version, format, root };
}

function readType(ctx: Context): [NodeType, number] {
  let databyte = ctx.types.u8();
  let flag = 0;
  if (ctx.version >= 3) {
    if ((databyte & 0x80) > 0) {
      databyte &= 0x3f;
      flag = ctx.types.u8();
    }
  } else if ((databyte & 0x80) > 0) {
    databyte &= 0x7f;
    flag = ctx.types.u8();
  }
  return [databyte as NodeType, flag];
}

function readMember(ctx: Context, parent: KVObject): void {
  const [type] = readType(ctx);
  const stringId = ctx.buffer.bytes4.i32();
  const name = stringId === -1 ? '' : ctx.strings[stringId];
  parent.set(name, readValue(ctx, type));
}

function readValue(ctx: Context, type: NodeType): KVValue {
  const buffer = ctx.buffer;
  switch (type) {
    case NodeType.NULL:
      return null;
    case NodeType.BOOLEAN_TRUE:
      return true;
    case NodeType.BOOLEAN_FALSE:
      return false;
    case NodeType.INT64_ZERO:
      return 0;
    case NodeType.INT64_ONE:
      return 1;
    case NodeType.DOUBLE_ZERO:
      return 0;
    case NodeType.DOUBLE_ONE:
      return 1;
    case NodeType.BOOLEAN:
      return buffer.bytes1.u8() === 1;
    case NodeType.INT32_AS_BYTE:
      return buffer.bytes1.u8();
    case NodeType.INT16:
      return buffer.bytes2.i16();
    case NodeType.UINT16:
      return buffer.bytes2.u16();
    case NodeType.INT32:
      return buffer.bytes4.i32();
    case NodeType.UINT32:
      return buffer.bytes4.u32();
    case NodeType.FLOAT:
      return buffer.bytes4.f32();
    case NodeType.INT64:
      return bigintToNumberIfSafe(buffer.bytes8.i64());
    case NodeType.UINT64:
      return bigintToNumberIfSafe(buffer.bytes8.u64());
    case NodeType.DOUBLE:
      return buffer.bytes8.f64();
    case NodeType.STRING: {
      const id = buffer.bytes4.i32();
      return id === -1 ? '' : ctx.strings[id];
    }
    case NodeType.BINARY_BLOB: {
      if (ctx.version < 2) {
        const len = buffer.bytes4.i32();
        return len > 0 ? buffer.bytes1.take(len).slice() : new Uint8Array(0);
      }
      const len = ctx.binaryBlobLengths.i32();
      return len > 0 ? ctx.binaryBlobs.take(len).slice() : new Uint8Array(0);
    }
    case NodeType.ARRAY: {
      const len = buffer.bytes4.i32();
      const arr: KVValue[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const [t] = readType(ctx);
        arr[i] = readValue(ctx, t);
      }
      return arr;
    }
    case NodeType.ARRAY_TYPED:
    case NodeType.ARRAY_TYPE_BYTE_LENGTH: {
      const len = type === NodeType.ARRAY_TYPE_BYTE_LENGTH ? buffer.bytes1.u8() : buffer.bytes4.i32();
      const [sub] = readType(ctx);
      const arr: KVValue[] = new Array(len);
      for (let i = 0; i < len; i++) arr[i] = readValue(ctx, sub);
      return arr;
    }
    case NodeType.ARRAY_TYPE_AUXILIARY_BUFFER: {
      const len = buffer.bytes1.u8();
      const [sub] = readType(ctx);
      const arr: KVValue[] = new Array(len);
      const saved = ctx.buffer;
      ctx.buffer = ctx.auxiliaryBuffer;
      ctx.auxiliaryBuffer = saved;
      for (let i = 0; i < len; i++) arr[i] = readValue(ctx, sub);
      ctx.auxiliaryBuffer = ctx.buffer;
      ctx.buffer = saved;
      return arr;
    }
    case NodeType.OBJECT: {
      const len = ctx.version >= 5 ? ctx.objectLengths.i32() : buffer.bytes4.i32();
      const obj: KVObject = new Map();
      for (let i = 0; i < len; i++) readMember(ctx, obj);
      return obj;
    }
    default:
      throw new Error(`KV3: unknown node type ${type}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------------------------

export function kvObject(v: KVValue | undefined): KVObject | undefined {
  return v instanceof Map ? v : undefined;
}

export function kvArray(v: KVValue | undefined): KVValue[] {
  return Array.isArray(v) ? v : [];
}

export function kvString(v: KVValue | undefined, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function kvNumber(v: KVValue | undefined, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

/** Formats any KV3 value the way it would appear as an entity key value string. */
export function kvToDisplayString(v: KVValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Uint8Array) return `<binary ${v.length} bytes>`;
  if (Array.isArray(v)) return v.map(kvToDisplayString).join(' ');
  return '{...}';
}
