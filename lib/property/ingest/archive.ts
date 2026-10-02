import { inflateRawSync } from "node:zlib";
import type { Row } from "../model";

export function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const value of bytes) { crc ^= value; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Read only named, bounded entries. No extraction paths or executable content. */
export function zipEntries(bytes: Buffer): Map<string, () => Buffer> {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new Error("Unsupported archive");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16), totalSize = 0;
  const entries = new Map<string, () => Buffer>();
  if (count > 100) throw new Error("Archive entry bound exceeded");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid archive directory");
    const method = bytes.readUInt16LE(offset + 10), flags = bytes.readUInt16LE(offset + 8);
    const packed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const checksum = bytes.readUInt32LE(offset + 16);
    totalSize += size;
    if (offset + 46 + nameLength + extra + comment > end || totalSize > 200_000_000) throw new Error("Archive bounds exceeded");
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (entries.has(name) || flags & 1 || size > 150_000_000 || packed > 20_000_000 || ![0, 8].includes(method)) throw new Error("Unsupported archive entry");
    entries.set(name, () => {
      if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 8) !== method) throw new Error("Invalid archive entry");
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      if (start + packed > bytes.length) throw new Error("Truncated archive");
      const raw = bytes.subarray(start, start + packed);
      const content = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: 150_000_000 });
      if (content.length !== size || crc32(content) !== checksum) throw new Error("Incomplete or corrupt archive entry");
      return content;
    });
    offset += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** DBF deletion marks, empty values and field names are preserved explicitly. */
export function dbfRows(bytes: Buffer, selected: string[]): Row[] {
  if (bytes.length < 33) throw new Error("Invalid DBF");
  const count = bytes.readUInt32LE(4), header = bytes.readUInt16LE(8), width = bytes.readUInt16LE(10);
  if (count > 50_000 || header < 33 || width < 2 || bytes.length < header + count * width) throw new Error("Incomplete DBF");
  const fields: { name: string; length: number; type: string }[] = [];
  for (let offset = 32; offset + 32 <= header; offset += 32) {
    if (bytes[offset] === 13) break;
    const raw = bytes.subarray(offset, offset + 32);
    fields.push({ name: raw.subarray(0, 11).toString("ascii").split("\0")[0], length: raw[16], type: String.fromCharCode(raw[11]) });
  }
  if (fields.reduce((n, f) => n + f.length, 1) !== width || !selected.every(name => fields.some(f => f.name === name))) throw new Error("DBF schema changed");
  const output: Row[] = [];
  for (let i = 0; i < count; i++) {
    const row = bytes.subarray(header + i * width, header + (i + 1) * width);
    if (row[0] === 42) continue;
    if (row[0] !== 32) throw new Error("Invalid DBF record");
    let offset = 1;
    const record: Row = {};
    for (const field of fields) {
      if (selected.includes(field.name)) {
        const value = row.subarray(offset, offset + field.length).toString("utf8").trim();
        record[field.name] = value || null;
      }
      offset += field.length;
    }
    output.push(record);
  }
  return output;
}
