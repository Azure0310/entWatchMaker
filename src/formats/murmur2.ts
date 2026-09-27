const M = 0x5bd1e995;
const R = 24;

/** Seed Valve uses for entity key tokens. */
export const ENTITY_KEY_SEED = 0x31415926;

function mul32(a: number, b: number): number {
  return Math.imul(a, b) >>> 0;
}

/**
 * MurmurHash2 over the UTF-16 code units of `text` (matching Valve's char-based hashing),
 * lowercasing ASCII letters first. Entity keys are ASCII so this equals the byte hash.
 */
export function murmur2Lower(text: string, seed = ENTITY_KEY_SEED): number {
  const length = text.length;
  if (length === 0) return 0;

  const c = (i: number): number => {
    const ch = text.charCodeAt(i);
    return ch >= 65 && ch <= 90 ? ch | 0x20 : ch;
  };

  let h = (seed ^ length) >>> 0;
  let idx = 0;
  let remaining = length;

  while (remaining >= 4) {
    let k = (c(idx) | (c(idx + 1) << 8) | (c(idx + 2) << 16) | (c(idx + 3) << 24)) >>> 0;
    idx += 4;
    k = mul32(k, M);
    k = (k ^ (k >>> R)) >>> 0;
    k = mul32(k, M);

    h = mul32(h, M);
    h = (h ^ k) >>> 0;
    remaining -= 4;
  }

  switch (remaining) {
    case 3:
      h = (h ^ ((c(idx) | (c(idx + 1) << 8)) & 0xffff)) >>> 0;
      h = (h ^ ((c(idx + 2) << 16) >>> 0)) >>> 0;
      h = mul32(h, M);
      break;
    case 2:
      h = (h ^ ((c(idx) | (c(idx + 1) << 8)) & 0xffff)) >>> 0;
      h = mul32(h, M);
      break;
    case 1:
      h = (h ^ c(idx)) >>> 0;
      h = mul32(h, M);
      break;
    default:
      break;
  }

  h = (h ^ (h >>> 13)) >>> 0;
  h = mul32(h, M);
  h = (h ^ (h >>> 15)) >>> 0;
  return h;
}
