/**
 * Incremental RFC 4180 CSV parser for streaming large files.
 *
 * shared/usListingsCsv.ts#parseCsv needs the whole document in memory; city
 * permit exports (Vancouver/Calgary/Montréal) are 50-500MB with embedded
 * newlines inside quoted description fields, so line-based streaming breaks.
 * This parser is fed arbitrary chunks and emits only rows whose closing
 * boundary has definitely arrived.
 */

export interface CsvStreamParser {
  /** Feed a decoded chunk; returns the complete rows it finished. */
  push(chunk: string): string[][];
  /** Flush the trailing row (if any) at end of input. */
  end(): string[][];
}

export function createCsvStreamParser(): CsvStreamParser {
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  /** Set when the previous chunk ended on a quote inside a quoted field — the
   * next char decides whether it was an escaped quote ("") or a closer. */
  let pendingQuote = false;
  /** Swallow a leading \n when the previous chunk ended with \r (CRLF split). */
  let pendingCr = false;

  const parse = (chunk: string, atEnd: boolean): string[][] => {
    const rows: string[][] = [];
    let i = 0;

    const endField = (): void => {
      row.push(field);
      field = "";
    };
    const endRow = (): void => {
      endField();
      rows.push(row);
      row = [];
    };

    while (i < chunk.length) {
      const ch = chunk[i];

      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false; // the quote was a closer; reprocess ch unquoted
        continue;
      }
      if (pendingCr) {
        pendingCr = false;
        endRow();
        if (ch === "\n") i++;
        continue;
      }

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 >= chunk.length) {
            pendingQuote = true;
            i++;
            continue;
          }
          if (chunk[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        endField();
        i++;
        continue;
      }
      if (ch === "\n") {
        endRow();
        i++;
        continue;
      }
      if (ch === "\r") {
        if (i + 1 >= chunk.length) {
          pendingCr = true;
          i++;
          continue;
        }
        endRow();
        i += chunk[i + 1] === "\n" ? 2 : 1;
        continue;
      }
      field += ch;
      i++;
    }

    if (atEnd) {
      if (pendingQuote) {
        inQuotes = false;
        pendingQuote = false;
      }
      if (pendingCr) {
        pendingCr = false;
        endRow();
      } else if (field.length || row.length) {
        endRow();
      }
    }
    return rows;
  };

  return {
    push: (chunk) => parse(chunk, false),
    end: () => parse("", true),
  };
}
