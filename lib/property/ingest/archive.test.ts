import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { crc32, dbfRows, zipEntries } from "./archive";
function archive(content: Buffer) {
  const name = Buffer.from('data.dbf'), packed = deflateRawSync(content);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc32(content), 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 10); end.writeUInt32LE(30 + name.length + packed.length, 16);
  return Buffer.concat([local, name, packed, central, name, end]);
}
function dbf() {
  const b = Buffer.alloc(65 + 2 * 5, 32); b[0] = 3; b.writeUInt32LE(2, 4); b.writeUInt16LE(65, 8); b.writeUInt16LE(5, 10);
  b.fill(0, 32, 64); b.write('ID', 32); b[43] = 67; b[48] = 4; b[64] = 13; b.write('1   ', 66); b[70] = 42; b.write('2   ', 71); return b;
}
describe('bounded heritage archive ingestion', () => {
  it('validates compressed bytes and deleted DBF rows', () => { const b = dbf(); expect(dbfRows(zipEntries(archive(b)).get('data.dbf')!(), ['ID'])).toEqual([{ ID: '1' }]); });
  it('rejects corrupt CRCs, truncated archives and changed DBF fields', () => {
    const z = archive(dbf()); const offset = z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); z.writeUInt32LE(1, offset + 16);
    expect(() => zipEntries(z).get('data.dbf')!()).toThrow(); expect(() => zipEntries(z.subarray(0, 10))).toThrow();
    expect(() => dbfRows(dbf(), ['MISSING'])).toThrow(); expect(() => dbfRows(dbf().subarray(0, 68), ['ID'])).toThrow();
  });
});
