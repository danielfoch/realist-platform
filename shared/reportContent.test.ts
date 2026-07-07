import { describe, expect, it } from "vitest";
import {
  assertValidReportContent,
  chartToTableRows,
  CONFIG_REPORT_ROUTE_PREFIX,
  DANIEL_FOCH_PERSON_ID,
  DEFAULT_AUTHOR,
  formatAxisTick,
  formatValue,
  reportContentToRegistryEntry,
  reportContentsToRegistryEntries,
  reportRoute,
  seriesColor,
  validateReportContent,
  type ChartBlock,
  type ReportContent,
} from "./reportContent";
import { configReports, configReportRegistryEntries, getConfigReport } from "./reports";
import { reportsRegistry } from "./reportsRegistry";

function baseReport(overrides: Partial<ReportContent> = {}): ReportContent {
  return {
    slug: "test-report",
    title: "Test Report",
    dek: "A test dek.",
    author: DEFAULT_AUTHOR,
    publishDate: "2026-01-15",
    kind: "macro",
    tags: ["test"],
    sections: [{ type: "narrative", body: "Hello world." }],
    sources: [{ label: "Source", url: "https://example.com" }],
    cta: { toolUrl: "/tools/analyzer", headline: "Go", body: "Do it." },
    ...overrides,
  };
}

describe("validateReportContent — happy path", () => {
  it("accepts a minimal valid report", () => {
    const result = validateReportContent(baseReport());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts every section type together", () => {
    const report = baseReport({
      sections: [
        { type: "narrative", heading: "H", body: "Body" },
        {
          type: "chart",
          chartType: "line",
          title: "Chart",
          xKey: "x",
          series: [{ key: "y", label: "Y" }],
          data: [{ x: "Jan", y: 1 }, { x: "Feb", y: 2 }],
        },
        { type: "statGrid", stats: [{ label: "L", value: "1" }] },
        { type: "callout", body: "Note" },
      ],
    });
    expect(validateReportContent(report).valid).toBe(true);
  });
});

describe("validateReportContent — rejects bad reports", () => {
  it("rejects a non-kebab slug", () => {
    const result = validateReportContent(baseReport({ slug: "Not_Kebab" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("slug:"))).toBe(true);
  });

  it("rejects a bad ISO date", () => {
    const result = validateReportContent(baseReport({ publishDate: "2026-13-40" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("publishDate"))).toBe(true);
  });

  it("rejects an unknown kind", () => {
    // deliberately bad kind
    const result = validateReportContent(baseReport({ kind: "weird" as ReportContent["kind"] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("kind:"))).toBe(true);
  });

  it("rejects empty sections", () => {
    const result = validateReportContent(baseReport({ sections: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("sections:"))).toBe(true);
  });

  it("rejects a chart with no series", () => {
    const result = validateReportContent(
      baseReport({
        sections: [{ type: "chart", chartType: "bar", title: "C", xKey: "x", series: [], data: [{ x: "a" }] }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one series"))).toBe(true);
  });

  it("rejects a chart row missing a series value", () => {
    const result = validateReportContent(
      baseReport({
        sections: [
          {
            type: "chart",
            chartType: "bar",
            title: "C",
            xKey: "x",
            series: [{ key: "y", label: "Y" }],
            data: [{ x: "a", y: 1 }, { x: "b" } as unknown as Record<string, number | string>],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing series value "y"'))).toBe(true);
  });

  it("rejects a non-numeric chart value", () => {
    const result = validateReportContent(
      baseReport({
        sections: [
          {
            type: "chart",
            chartType: "bar",
            title: "C",
            xKey: "x",
            series: [{ key: "y", label: "Y" }],
            data: [{ x: "a", y: "oops" }],
          },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must be a finite number"))).toBe(true);
  });

  it("rejects a missing CTA", () => {
    const report = baseReport();
    // @ts-expect-error deliberately dropping cta
    delete report.cta;
    const result = validateReportContent(report);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("cta."))).toBe(true);
  });

  it("assertValidReportContent throws on an invalid report", () => {
    expect(() => assertValidReportContent(baseReport({ slug: "" }))).toThrow(/Invalid report content/);
  });
});

describe("formatValue", () => {
  it("formats currency without cents for large numbers", () => {
    expect(formatValue(538824, "currency")).toBe("$538,824");
  });
  it("formats percent points", () => {
    expect(formatValue(2.4, "percent")).toBe("2.4%");
  });
  it("formats plain numbers with grouping", () => {
    expect(formatValue(168166, "number")).toBe("168,166");
  });
  it("renders a dash for non-finite", () => {
    expect(formatValue(Number.NaN, "number")).toBe("—");
  });
});

describe("formatAxisTick", () => {
  it("compacts thousands", () => {
    expect(formatAxisTick(12500, "number")).toBe("12.5k");
  });
  it("compacts currency millions", () => {
    expect(formatAxisTick(2_400_000, "currency")).toBe("$2.4M");
  });
  it("keeps percent as-is", () => {
    expect(formatAxisTick(2.4, "percent")).toBe("2.4%");
  });
});

describe("seriesColor", () => {
  it("uses the explicit color when set", () => {
    expect(seriesColor({ key: "a", label: "A", color: "#123456" }, 0)).toBe("#123456");
  });
  it("falls back to the palette by index, wrapping", () => {
    expect(seriesColor({ key: "a", label: "A" }, 0)).toBe("hsl(var(--chart-1))");
    expect(seriesColor({ key: "a", label: "A" }, 5)).toBe("hsl(var(--chart-1))");
  });
});

describe("chartToTableRows", () => {
  const block: ChartBlock = {
    type: "chart",
    chartType: "bar",
    title: "Net by province",
    xKey: "province",
    format: "number",
    series: [{ key: "net", label: "Net migrants" }],
    data: [
      { province: "AB", net: 538824 },
      { province: "ON", net: -168166 },
    ],
  };

  it("shapes rows with x labels and formatted cells", () => {
    const rows = chartToTableRows(block);
    expect(rows).toHaveLength(2);
    expect(rows[0].x).toBe("AB");
    expect(rows[0].cells[0].label).toBe("Net migrants");
    expect(rows[0].cells[0].formatted).toBe("538,824");
    expect(rows[1].cells[0].formatted).toBe("-168,166");
  });
});

describe("registry mapping", () => {
  it("maps a report to a registry entry at the config route", () => {
    const entry = reportContentToRegistryEntry(baseReport({ slug: "abc" }));
    expect(entry.slug).toBe("abc");
    expect(entry.route).toBe(`${CONFIG_REPORT_ROUTE_PREFIX}/abc`);
    expect(entry.config).toBe(true);
    expect(entry.db).toBeUndefined();
  });

  it("prefers metaDescription over dek for the registry description", () => {
    const entry = reportContentToRegistryEntry(baseReport({ metaDescription: "Meta", dek: "Dek" }));
    expect(entry.description).toBe("Meta");
  });

  it("sorts multiple reports newest-first", () => {
    const entries = reportContentsToRegistryEntries([
      baseReport({ slug: "old", publishDate: "2024-01-01" }),
      baseReport({ slug: "new", publishDate: "2026-06-01" }),
    ]);
    expect(entries.map((e) => e.slug)).toEqual(["new", "old"]);
  });

  it("reportRoute uses the config prefix", () => {
    expect(reportRoute("x")).toBe("/insights/reports/x");
  });
});

describe("default author", () => {
  it("points at the site-wide Daniel Foch Person @id", () => {
    expect(DEFAULT_AUTHOR.personId).toBe(DANIEL_FOCH_PERSON_ID);
    expect(DANIEL_FOCH_PERSON_ID).toBe("https://realist.ca/#danielfoch");
  });
});

describe("content dir (shared/reports)", () => {
  it("every config report is valid", () => {
    for (const report of configReports) {
      expect(validateReportContent(report).valid).toBe(true);
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = configReports.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getConfigReport resolves the example report", () => {
    const report = getConfigReport("interprovincial-migration-fraser-1995-2024");
    expect(report).toBeDefined();
    expect(report?.kind).toBe("research");
  });

  it("getConfigReport returns undefined for unknown slugs", () => {
    expect(getConfigReport("does-not-exist")).toBeUndefined();
    expect(getConfigReport(undefined)).toBeUndefined();
  });

  it("every config report is present in the shared reports registry", () => {
    for (const entry of configReportRegistryEntries) {
      const found = reportsRegistry.find((r) => r.slug === entry.slug);
      expect(found, `registry missing config report ${entry.slug}`).toBeDefined();
      expect(found?.route).toBe(entry.route);
      expect(found?.config).toBe(true);
    }
  });
});
