import { BinaryReader } from './binaryReader';

/** Random access byte source (a File in the browser, a buffer in tests). */
export interface ByteSource {
  readonly size: number;
  readonly name: string;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export function bufferByteSource(bytes: Uint8Array, name = 'buffer'): ByteSource {
  return {
    size: bytes.length,
    name,
    async read(offset, length) {
      return bytes.subarray(offset, Math.min(bytes.length, offset + length));
    },
  };
}

export function blobByteSource(blob: Blob, name?: string): ByteSource {
  return {
    size: blob.size,
    name: name ?? ((blob as File).name ?? 'blob'),
    async read(offset, length) {
      const buf = await blob.slice(offset, offset + length).arrayBuffer();
      return new Uint8Array(buf);
    },
  };
}

export interface VpkEntry {
  /** Full path, e.g. maps/foo/entities/default_ents.vents_c */
  path: string;
  ext: string;
  dir: string;
  name: string;
  crc: number;
  archiveIndex: number;
  offset: number;
  length: number;
  preload: Uint8Array;
}

const VPK_MAGIC = 0x55aa1234;
const DIR_ARCHIVE_INDEX = 0x7fff;

/**
 * Reads a VPK directory (single-file VPKs as CS2 workshop maps use, or `_dir.vpk` plus
 * numbered archives).
 */
export class VpkArchive {
  readonly entries: VpkEntry[] = [];
  private readonly byPath = new Map<string, VpkEntry>();

  private constructor(
    readonly dir: ByteSource,
    readonly archives: Map<number, ByteSource>,
    readonly version: number,
    readonly headerSize: number,
    readonly treeSize: number,
  ) {}

  static async open(dir: ByteSource, archives: Map<number, ByteSource> = new Map()): Promise<VpkArchive> {
    const head = new BinaryReader(await dir.read(0, 28));
    const magic = head.u32();
    if (magic !== VPK_MAGIC) throw new Error('Not a VPK file');
    const version = head.u32();
    const treeSize = head.u32();
    let headerSize: number;
    if (version === 1) {
      headerSize = 12;
    } else if (version === 2) {
      headerSize = 28;
    } else {
      throw new Error(`Unsupported VPK version ${version}`);
    }

    const pak = new VpkArchive(dir, archives, version, headerSize, treeSize);
    const tree = new BinaryReader(await dir.read(headerSize, treeSize));
    pak.readTree(tree);
    return pak;
  }

  private readTree(r: BinaryReader): void {
    for (;;) {
      const ext = r.cstring();
      if (ext.length === 0) break;
      for (;;) {
        const dirName = r.cstring();
        if (dirName.length === 0) break;
        for (;;) {
          const fileName = r.cstring();
          if (fileName.length === 0) break;
          const crc = r.u32();
          const preloadSize = r.u16();
          const archiveIndex = r.u16();
          const offset = r.u32();
          const length = r.u32();
          const terminator = r.u16();
          if (terminator !== 0xffff) throw new Error('VPK: bad entry terminator');
          const preload = preloadSize > 0 ? r.take(preloadSize).slice() : new Uint8Array(0);
          const cleanDir = dirName === ' ' ? '' : dirName;
          const cleanExt = ext === ' ' ? '' : ext;
          const path = (cleanDir ? cleanDir + '/' : '') + fileName + (cleanExt ? '.' + cleanExt : '');
          const entry: VpkEntry = { path, ext: cleanExt, dir: cleanDir, name: fileName, crc, archiveIndex, offset, length, preload };
          this.entries.push(entry);
          this.byPath.set(path.toLowerCase(), entry);
        }
      }
    }
  }

  find(path: string): VpkEntry | undefined {
    return this.byPath.get(path.replace(/\\/g, '/').toLowerCase());
  }

  async readEntry(entry: VpkEntry): Promise<Uint8Array> {
    const total = entry.preload.length + entry.length;
    const out = new Uint8Array(total);
    out.set(entry.preload, 0);
    if (entry.length > 0) {
      let source: ByteSource;
      let base: number;
      if (entry.archiveIndex === DIR_ARCHIVE_INDEX) {
        source = this.dir;
        base = this.headerSize + this.treeSize;
      } else {
        const archive = this.archives.get(entry.archiveIndex);
        if (!archive) {
          throw new Error(
            `VPK: entry "${entry.path}" lives in archive _${String(entry.archiveIndex).padStart(3, '0')}.vpk, which was not provided`,
          );
        }
        source = archive;
        base = 0;
      }
      const data = await source.read(base + entry.offset, entry.length);
      if (data.length !== entry.length) throw new Error(`VPK: short read for "${entry.path}"`);
      out.set(data, entry.preload.length);
    }
    return out;
  }
}

/** Parses "name_dir.vpk" / "name_012.vpk" style file names. */
export function classifyVpkFileName(fileName: string): { base: string; kind: 'dir' | 'archive' | 'single'; index: number } {
  const lower = fileName.toLowerCase();
  const m = /^(.*)_(dir|\d{3})\.vpk$/.exec(lower);
  if (!m) return { base: lower.replace(/\.vpk$/, ''), kind: 'single', index: -1 };
  if (m[2] === 'dir') return { base: m[1], kind: 'dir', index: -1 };
  return { base: m[1], kind: 'archive', index: parseInt(m[2], 10) };
}
