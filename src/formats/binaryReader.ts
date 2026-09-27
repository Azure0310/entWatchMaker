const utf8Decoder = new TextDecoder('utf-8');

export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

/** Little-endian sequential reader over a byte array. */
export class BinaryReader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }

  get length(): number {
    return this.bytes.length;
  }

  get remaining(): number {
    return this.bytes.length - this.pos;
  }

  private need(n: number): void {
    if (this.pos + n > this.bytes.length) {
      throw new RangeError(`Read past end of buffer (pos=${this.pos}, need=${n}, len=${this.bytes.length})`);
    }
  }

  u8(): number {
    this.need(1);
    return this.bytes[this.pos++];
  }

  i8(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  u64(): bigint {
    this.need(8);
    const v = this.view.getBigUint64(this.pos, true);
    this.pos += 8;
    return v;
  }

  i64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, true);
    this.pos += 8;
    return v;
  }

  /** Returns a view (not a copy) of the next n bytes. */
  take(n: number): Uint8Array {
    this.need(n);
    const v = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }

  /** Reads a null-terminated UTF-8 string. */
  cstring(): string {
    const start = this.pos;
    let end = start;
    const bytes = this.bytes;
    while (end < bytes.length && bytes[end] !== 0) end++;
    if (end >= bytes.length) {
      throw new RangeError(`Unterminated string at ${start}`);
    }
    this.pos = end + 1;
    return decodeUtf8(bytes.subarray(start, end));
  }

  skip(n: number): void {
    this.need(n);
    this.pos += n;
  }

  seek(pos: number): void {
    if (pos < 0 || pos > this.bytes.length) {
      throw new RangeError(`Seek out of range: ${pos}`);
    }
    this.pos = pos;
  }
}

/** Converts a bigint to a number when it fits, otherwise keeps the bigint. */
export function bigintToNumberIfSafe(v: bigint): number | bigint {
  if (v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(v);
  }
  return v;
}

export function guidToString(bytes: Uint8Array): string {
  // Matches System.Guid byte layout: first three groups little-endian.
  const hex = (b: number) => b.toString(16).padStart(2, '0');
  const g = bytes;
  return (
    hex(g[3]) + hex(g[2]) + hex(g[1]) + hex(g[0]) + '-' +
    hex(g[5]) + hex(g[4]) + '-' +
    hex(g[7]) + hex(g[6]) + '-' +
    hex(g[8]) + hex(g[9]) + '-' +
    hex(g[10]) + hex(g[11]) + hex(g[12]) + hex(g[13]) + hex(g[14]) + hex(g[15])
  );
}
