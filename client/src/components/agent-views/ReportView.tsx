/**
 * Generic hosted agent result: a declarative list of sections (stat grid,
 * chart, table, callout, narrative). Charts, stats, callouts and prose reuse
 * the research-report blocks; the sortable table is the one block added here.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportSectionBlock } from "@/components/reports/ReportRenderer";
import { formatTableCell, type ReportViewDocument, type TableBlock, type TableCell } from "@shared/agentViews";
import { ViewLink, ViewLinks } from "./ViewChrome";

function compareCells(a: TableCell, b: TableCell): number {
  // Blanks always sort last, whichever direction is active.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en-CA", { numeric: true });
}

function DataTable({ block }: { block: TableBlock }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return block.rows;
    return [...block.rows].sort((x, y) => {
      const order = compareCells(x[sort.key] ?? null, y[sort.key] ?? null);
      const blank = (x[sort.key] ?? null) == null || (y[sort.key] ?? null) == null;
      return blank ? order : order * sort.direction;
    });
  }, [block.rows, sort]);

  const toggle = (key: string) =>
    setSort((current) => (current?.key !== key ? { key, direction: -1 } : current.direction === -1 ? { key, direction: 1 } : null));

  return (
    <section className="my-10" id={block.id} data-testid="view-table">
      <Card>
        {block.heading && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{block.heading}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/50">
                  {block.columns.map((column) => {
                    const active = sort?.key === column.key;
                    const Icon = !active ? ArrowUpDown : sort!.direction === -1 ? ArrowDown : ArrowUp;
                    return (
                      <th key={column.key} className={`p-3 font-medium whitespace-nowrap ${column.align === "right" ? "text-right" : "text-left"}`} aria-sort={active ? (sort!.direction === 1 ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => toggle(column.key)} className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground" data-testid={`sort-${column.key}`}>
                          {column.label}
                          <Icon className={`h-3 w-3 ${active ? "text-foreground" : "opacity-50"}`} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                    {block.columns.map((column, columnIndex) => {
                      const text = formatTableCell(row[column.key] ?? null, column.format);
                      const href = columnIndex === 0 && block.hrefKey ? row[block.hrefKey] : null;
                      return (
                        <td key={column.key} className={`p-3 ${column.align === "right" ? "text-right font-mono text-xs" : ""}`}>
                          {typeof href === "string" && href ? (
                            <ViewLink link={{ href }} className="font-medium text-primary hover:underline">{text}</ViewLink>
                          ) : text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <p className="px-4 py-3 text-xs text-muted-foreground leading-5 border-t">{block.caption}</p>}
        </CardContent>
      </Card>
    </section>
  );
}

export function ReportView({ document }: { document: ReportViewDocument }) {
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8" data-testid="report-view">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-view-title">{document.title}</h1>
      {document.subtitle && <p className="mt-2 text-sm text-muted-foreground">{document.subtitle}</p>}
      <div className="mt-5">
        <ViewLinks links={document.links} />
      </div>
      {document.sections.map((section, index) =>
        section.type === "table"
          ? <DataTable key={index} block={section} />
          : <ReportSectionBlock key={index} section={section} />,
      )}
    </main>
  );
}
