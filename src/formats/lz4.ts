/**
 * LZ4 block format decoder (no frame header).
 *
 * Decodes `src` into `dst` starting at `dstStart`. Matches may reference bytes written
 * before `dstStart` (that is how LZ4 "chained" blocks work), so callers that decode a
 * sequence of dependent blocks simply keep decoding into the same output buffer.
 *
 * Returns the number of bytes written.
 */
export function lz4DecompressBlock(src: Uint8Array, dst: Uint8Array, dstStart = 0, dstEnd = dst.length): number {
  let ip = 0;
  let op = dstStart;
  const srcEnd = src.length;

  while (ip < srcEnd) {
    const token = src[ip++];

    // literals
    let literalLength = token >>> 4;
    if (literalLength === 15) {
      let b: number;
      do {
        if (ip >= srcEnd) throw new Error('LZ4: truncated literal length');
        b = src[ip++];
        literalLength += b;
      } while (b === 255);
    }
    if (ip + literalLength > srcEnd) throw new Error('LZ4: literal run past end of input');
    if (op + literalLength > dstEnd) throw new Error('LZ4: output overflow (literals)');
    dst.set(src.subarray(ip, ip + literalLength), op);
    ip += literalLength;
    op += literalLength;

    if (ip >= srcEnd) break; // last sequence has no match

    // match
    if (ip + 2 > srcEnd) throw new Error('LZ4: truncated match offset');
    const offset = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (offset === 0 || offset > op) throw new Error(`LZ4: invalid match offset ${offset} at output ${op}`);

    let matchLength = token & 0x0f;
    if (matchLength === 15) {
      let b: number;
      do {
        if (ip >= srcEnd) throw new Error('LZ4: truncated match length');
        b = src[ip++];
        matchLength += b;
      } while (b === 255);
    }
    matchLength += 4;
    if (op + matchLength > dstEnd) throw new Error('LZ4: output overflow (match)');

    let ref = op - offset;
    if (offset >= matchLength) {
      dst.copyWithin(op, ref, ref + matchLength);
      op += matchLength;
    } else {
      // overlapping copy must be byte by byte
      for (let i = 0; i < matchLength; i++) dst[op++] = dst[ref++];
    }
  }

  return op - dstStart;
}
