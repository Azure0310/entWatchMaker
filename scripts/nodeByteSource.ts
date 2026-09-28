import { open } from 'node:fs/promises';
import path from 'node:path';
import type { ByteSource } from '../src/formats/vpk';

/** Random access over a file on disk without loading it into memory. */
export async function fileByteSource(filePath: string): Promise<ByteSource> {
  const fh = await open(filePath, 'r');
  const { size } = await fh.stat();
  return {
    size,
    name: path.basename(filePath),
    async read(offset, length) {
      const buf = new Uint8Array(Math.max(0, Math.min(length, size - offset)));
      if (buf.length === 0) return buf;
      const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
      return buf.subarray(0, bytesRead);
    },
  };
}
