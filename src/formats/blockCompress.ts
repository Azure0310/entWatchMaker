import type { BinaryReader } from './binaryReader';

/**
 * Valve's legacy "block compress" (LZSS-like) scheme used by the oldest binary KV3 encoding (binary_bc).
 */
export function blockDecompress(reader: BinaryReader): Uint8Array {
  const sizeField = reader.u32();
  // High bit set means the payload is stored uncompressed.
  if (sizeField > 0x7fffffff) {
    const size = sizeField & 0x7fffffff;
    return reader.take(size).slice();
  }

  const size = sizeField;
  const result = new Uint8Array(size);
  let position = 0;
  let blockMask = 0;
  let i = 0;

  while (position < size) {
    if (i === 0) {
      blockMask = reader.u16();
      i = 16;
    }

    if ((blockMask & 1) > 0) {
      const offsetSize = reader.u16();
      const offset = (offsetSize >>> 4) + 1;
      let len = (offsetSize & 0xf) + 3;
      let source = position - offset;
      while (len-- > 0) {
        result[position++] = result[source];
        if (offset !== 1) source++;
      }
    } else {
      result[position++] = reader.u8();
    }

    blockMask >>>= 1;
    i--;
  }

  return result;
}
