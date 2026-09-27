import { BinaryReader } from './binaryReader';
import { isBinaryKV3Magic, parseBinaryKV3, type KV3Document } from './kv3';

/** Source 2 compiled resource file (*_c) container. */
export interface ResourceBlock {
  type: string;
  offset: number;
  size: number;
}

export interface ResourceFile {
  fileSize: number;
  headerVersion: number;
  version: number;
  blocks: ResourceBlock[];
}

const KNOWN_HEADER_VERSION = 12;
const VPK_MAGIC = 0x55aa1234;

export function parseResourceHeader(bytes: Uint8Array): ResourceFile {
  const r = new BinaryReader(bytes);
  const fileSize = r.u32();
  if (fileSize === VPK_MAGIC) {
    throw new Error('This is a VPK package, not a resource file');
  }
  const headerVersion = r.u16();
  if (headerVersion !== KNOWN_HEADER_VERSION) {
    throw new Error(`Not a Source 2 resource file (header version ${headerVersion})`);
  }
  const version = r.u16();
  const blockOffset = r.u32();
  const blockCount = r.u32();
  r.pos += blockOffset - 8;

  const blocks: ResourceBlock[] = [];
  for (let i = 0; i < blockCount; i++) {
    const type = String.fromCharCode(r.u8(), r.u8(), r.u8(), r.u8());
    const position = r.pos;
    const offset = position + r.u32();
    const size = r.u32();
    if (size === 0) continue;
    blocks.push({ type, offset, size });
  }
  return { fileSize, headerVersion, version, blocks };
}

/**
 * Parses the DATA block of a resource as binary KV3. Throws for NTRO (legacy) data blocks.
 */
export function readResourceKV3Data(bytes: Uint8Array): KV3Document {
  const res = parseResourceHeader(bytes);
  const data = res.blocks.find((b) => b.type === 'DATA');
  if (!data) throw new Error('Resource has no DATA block');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(data.offset, true);
  if (!isBinaryKV3Magic(magic)) {
    const hasNtro = res.blocks.some((b) => b.type === 'NTRO');
    throw new Error(
      hasNtro
        ? 'Resource uses the legacy NTRO data layout, which is not supported (this map predates CS2)'
        : `DATA block is not binary KV3 (magic 0x${magic.toString(16)})`,
    );
  }
  return parseBinaryKV3(bytes, data.offset, data.size);
}

/** Reads the external resource reference list (RERL block) if present. */
export function readResourceReferences(bytes: Uint8Array): string[] {
  const res = parseResourceHeader(bytes);
  const rerl = res.blocks.find((b) => b.type === 'RERL');
  if (!rerl) return [];
  const r = new BinaryReader(bytes, rerl.offset);
  const offset = r.i32();
  const count = r.i32();
  r.seek(rerl.offset + offset);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    r.u64(); // id
    const entryPos = r.pos;
    const nameOffset = r.i32();
    r.i32(); // padding
    const save = r.pos;
    r.seek(entryPos + nameOffset);
    names.push(r.cstring());
    r.seek(save);
  }
  return names;
}
