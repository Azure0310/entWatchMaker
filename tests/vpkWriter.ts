/** Minimal VPK v2 writer for tests (single file, all data after the tree). */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function writeVpk(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  // group by ext -> dir -> name
  const tree = new Map<string, Map<string, { name: string; data: Uint8Array }[]>>();
  for (const f of files) {
    const slash = f.path.lastIndexOf('/');
    const dir = slash >= 0 ? f.path.slice(0, slash) : ' ';
    const file = slash >= 0 ? f.path.slice(slash + 1) : f.path;
    const dot = file.lastIndexOf('.');
    const ext = dot >= 0 ? file.slice(dot + 1) : ' ';
    const name = dot >= 0 ? file.slice(0, dot) : file;
    let dirs = tree.get(ext);
    if (!dirs) tree.set(ext, (dirs = new Map()));
    let list = dirs.get(dir);
    if (!list) dirs.set(dir, (list = []));
    list.push({ name, data: f.data });
  }

  const treeBytes: number[] = [];
  const dataChunks: Uint8Array[] = [];
  let dataOffset = 0;
  const pushStr = (s: string) => {
    treeBytes.push(...enc.encode(s), 0);
  };
  const pushU16 = (v: number) => treeBytes.push(v & 0xff, (v >>> 8) & 0xff);
  const pushU32 = (v: number) => treeBytes.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);

  for (const [ext, dirs] of tree) {
    pushStr(ext);
    for (const [dir, list] of dirs) {
      pushStr(dir);
      for (const f of list) {
        pushStr(f.name);
        pushU32(crc32(f.data));
        pushU16(0); // preload
        pushU16(0x7fff); // archive index: this file
        pushU32(dataOffset);
        pushU32(f.data.length);
        pushU16(0xffff);
        dataChunks.push(f.data);
        dataOffset += f.data.length;
      }
      treeBytes.push(0);
    }
    treeBytes.push(0);
  }
  treeBytes.push(0);

  const header = new Uint8Array(28);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, 0x55aa1234, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, treeBytes.length, true);
  dv.setUint32(12, dataOffset, true);
  dv.setUint32(16, 0, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);

  const out = new Uint8Array(28 + treeBytes.length + dataOffset);
  out.set(header, 0);
  out.set(treeBytes, 28);
  let p = 28 + treeBytes.length;
  for (const c of dataChunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
