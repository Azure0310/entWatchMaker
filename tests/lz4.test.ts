import { describe, expect, it } from 'vitest';
import { lz4DecompressBlock } from '../src/formats/lz4';
import { murmur2Lower } from '../src/formats/murmur2';

describe('lz4 block', () => {
  it('decodes literals and overlapping matches', () => {
    // seq1: 4 literals "abcd", match len 4 at offset 4 -> "abcd"; seq2 (last): literal "e"
    const src = new Uint8Array([0x40, 0x61, 0x62, 0x63, 0x64, 0x04, 0x00, 0x10, 0x65]);
    const dst = new Uint8Array(9);
    const n = lz4DecompressBlock(src, dst);
    expect(n).toBe(9);
    expect(new TextDecoder().decode(dst)).toBe('abcdabcde');
  });

  it('handles offset 1 run-length matches', () => {
    // literal "x", match offset 1 length 8 -> "xxxxxxxxx"
    const src = new Uint8Array([0x14, 0x78, 0x01, 0x00]);
    const dst = new Uint8Array(9);
    expect(lz4DecompressBlock(src, dst)).toBe(9);
    expect(new TextDecoder().decode(dst)).toBe('xxxxxxxxx');
  });
});

describe('murmur2', () => {
  it('is case insensitive and stable', () => {
    expect(murmur2Lower('classname')).toBe(murmur2Lower('ClassName'));
    expect(murmur2Lower('classname')).not.toBe(murmur2Lower('targetname'));
  });
});
