import { describe, expect, it } from "vitest";
import { createCsvStreamParser } from "./streamingCsv";

/** Feed content in every possible chunking and assert identical output. */
function parseAllChunkings(content: string, expected: string[][]): void {
  for (const size of [1, 2, 3, 7, content.length]) {
    const p = createCsvStreamParser();
    const rows: string[][] = [];
    for (let i = 0; i < content.length; i += size) rows.push(...p.push(content.slice(i, i + size)));
    rows.push(...p.end());
    expect(rows, `chunk size ${size}`).toEqual(expected);
  }
}

describe("createCsvStreamParser", () => {
  it("parses plain rows", () => {
    parseAllChunkings("a,b,c\n1,2,3\n", [
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, newlines and escaped quotes across any chunk boundary", () => {
    parseAllChunkings('id,desc\n7,"line one\nline ""two"", still going"\n8,plain\n', [
      ["id", "desc"],
      ["7", 'line one\nline "two", still going'],
      ["8", "plain"],
    ]);
  });

  it("handles CRLF line endings split across chunks", () => {
    parseAllChunkings('a,b\r\n"x",y\r\n', [
      ["a", "b"],
      ["x", "y"],
    ]);
  });

  it("flushes a final row without a trailing newline", () => {
    parseAllChunkings("a,b\n1,2", [
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("emits nothing for empty input", () => {
    const p = createCsvStreamParser();
    expect(p.push("")).toEqual([]);
    expect(p.end()).toEqual([]);
  });
});
