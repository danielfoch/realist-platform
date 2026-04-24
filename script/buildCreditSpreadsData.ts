import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

type CsvRow = Record<string, string>;

interface SourceRegistryEntry {
  datasetId: string;
  geography: string;
  theme: string;
  frequency: string;
  officialSeriesOrTable: string;
  source: string;
  sourcePageUrl: string;
  downloadUrl: string;
  status: string;
  notes: string;
}

interface CreditSpreadPoint {
  period: string;
  label: string;
  mortgageRatePct: number;
  businessRatePct: number;
  spreadPctPoints: number;
  spreadBps: number;
  mortgageLabel: string;
  businessLabel: string;
  sourceUrl: string;
  caveat: string;
}

const INPUT_ROOT = path.resolve(process.cwd(), "data/canada_us_credit_spreads");
const CSV_ROOT = path.join(INPUT_ROOT, "csv_and_scripts");
const OUTPUT_ROOT = path.resolve(process.cwd(), "client/public/data/credit-spreads");

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) => {
    const record: CsvRow = {};
    header.forEach((column, index) => {
      record[column] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function sortByPeriod<T extends { period?: string; year?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = a.period ?? String(a.year ?? "");
    const right = b.period ?? String(b.year ?? "");
    return left.localeCompare(right);
  });
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const content = await readFile(path.join(CSV_ROOT, fileName), "utf8");
  return parseCsv(content);
}

function buildSourceIndex(entries: SourceRegistryEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.datasetId, entry]));
}

export async function buildCreditSpreadsData() {
  await mkdir(OUTPUT_ROOT, { recursive: true });

  const [
    sourceRegistryRaw,
    lendingRatesRaw,
    spreadSeedRaw,
    businessEntryExitRaw,
    gdpPerCapitaRaw,
    housingEconomicAccountRaw,
    postedRatesRaw,
    historicalMortgageRaw,
    inputReadme,
  ] = await Promise.all([
    readCsv("source_registry.csv"),
    readCsv("ca_lending_rates_recent.csv"),
    readCsv("credit_spread_seed_recent.csv"),
    readCsv("ca_business_entry_exit_2002_2023.csv"),
    readCsv("ca_gdp_per_capita_annual.csv"),
    readCsv("ca_housing_economic_account_2024.csv"),
    readCsv("ca_posted_rates_recent.csv"),
    readCsv("ca_mortgage_5y_historical_monthly.csv"),
    readFile(path.join(CSV_ROOT, "README.md"), "utf8"),
  ]);

  const sourceRegistry: SourceRegistryEntry[] = sourceRegistryRaw.map((row) => ({
    datasetId: row.dataset_id,
    geography: row.geography,
    theme: row.theme,
    frequency: row.frequency,
    officialSeriesOrTable: row.official_series_or_table,
    source: row.source,
    sourcePageUrl: row.source_page_url,
    downloadUrl: row.download_url,
    status: row.status,
    notes: row.notes,
  }));
  const sourceIndex = buildSourceIndex(sourceRegistry);

  const pickRate = (loanProduct: string, measure = "Funds advanced") =>
    lendingRatesRaw
      .filter((row) => row.loan_product === loanProduct && row.measure === measure)
      .map((row) => ({
        period: row.period,
        ratePct: toNumber(row.rate_pct),
        sourceUrl: row.source_url,
      }))
      .filter((row): row is { period: string; ratePct: number; sourceUrl: string } => row.ratePct != null);

  const insured5y = pickRate("Residential mortgages, insured, fixed 5 years and over");
  const businessLoansTotal = pickRate("Business loans, Total");

  const businessByPeriod = new Map(businessLoansTotal.map((row) => [row.period, row]));
  const officialSpreadSeries: CreditSpreadPoint[] = insured5y
    .map((mortgage) => {
      const business = businessByPeriod.get(mortgage.period);
      if (!business) return null;
      const spread = Number((business.ratePct - mortgage.ratePct).toFixed(2));
      return {
        period: mortgage.period,
        label: mortgage.period,
        mortgageRatePct: mortgage.ratePct,
        businessRatePct: business.ratePct,
        spreadPctPoints: spread,
        spreadBps: Number((spread * 100).toFixed(1)),
        mortgageLabel: "Insured residential mortgage, fixed 5 years and over",
        businessLabel: "Business loans, total",
        sourceUrl: mortgage.sourceUrl,
        caveat: "Volume-weighted aggregate bank rates. This is not the same thing as founder-facing SME borrowing conditions.",
      };
    })
    .filter((row): row is CreditSpreadPoint => row != null);

  const entrepreneurProxySeries: CreditSpreadPoint[] = spreadSeedRaw
    .filter((row) => row.status.includes("entrepreneur-facing proxy"))
    .map((row) => {
      const mortgageRatePct = toNumber(row.mortgage_rate_pct);
      const businessRatePct = toNumber(row.business_rate_pct);
      const spreadPctPoints = toNumber(row.spread_pct_points);
      const spreadBps = toNumber(row.spread_bps);
      if (
        mortgageRatePct == null ||
        businessRatePct == null ||
        spreadPctPoints == null ||
        spreadBps == null
      ) {
        return null;
      }
      return {
        period: row.period,
        label: row.period,
        mortgageRatePct,
        businessRatePct,
        spreadPctPoints,
        spreadBps,
        mortgageLabel: row.mortgage_rate_label,
        businessLabel: row.business_rate_label,
        sourceUrl: row.source_url,
        caveat: row.status,
      };
    })
    .filter((row): row is CreditSpreadPoint => row != null);

  const businessDynamism = sortByPeriod(
    businessEntryExitRaw
      .map((row) => ({
        year: Number(row.year),
        entryRatePct: toNumber(row.entry_rate_pct),
        exitRatePct: toNumber(row.exit_rate_pct),
        netEntryRatePct: toNumber(row.net_entry_rate_pct),
        growthRateActiveBusinessesPct: toNumber(row.growth_rate_active_businesses_pct),
        sourceTable: row.source_table,
        sourceUrl: row.source_url,
      }))
      .filter(
        (
          row,
        ): row is {
          year: number;
          entryRatePct: number;
          exitRatePct: number;
          netEntryRatePct: number;
          growthRateActiveBusinessesPct: number;
          sourceTable: string;
          sourceUrl: string;
        } =>
          Number.isFinite(row.year) &&
          row.entryRatePct != null &&
          row.exitRatePct != null &&
          row.netEntryRatePct != null &&
          row.growthRateActiveBusinessesPct != null,
      ),
  );

  const gdpPerCapita = sortByPeriod(
    gdpPerCapitaRaw
      .map((row) => ({
        year: Number(row.year),
        realGdpPerCapita2017Cad: toNumber(row.real_gdp_per_capita_2017_cad),
        sourceTable: row.source_table,
        sourceUrl: row.source_url,
      }))
      .filter(
        (
          row,
        ): row is {
          year: number;
          realGdpPerCapita2017Cad: number;
          sourceTable: string;
          sourceUrl: string;
        } => Number.isFinite(row.year) && row.realGdpPerCapita2017Cad != null,
      ),
  );

  const housingEconomicAccount = housingEconomicAccountRaw
    .map((row) => ({
      year: Number(row.year),
      metric: row.metric,
      value: toNumber(row.value),
      unit: row.unit,
      sourceUrl: row.source_url,
    }))
    .filter(
      (
        row,
      ): row is {
        year: number;
        metric: string;
        value: number;
        unit: string;
        sourceUrl: string;
      } => Number.isFinite(row.year) && row.value != null,
    );

  const currentPosted5y = postedRatesRaw
    .filter((row) => row.short_name === "mortgage_5y_pct")
    .map((row) => ({
      date: row.date,
      ratePct: toNumber(row.rate_pct),
      sourceUrl: row.source_url,
    }))
    .filter((row): row is { date: string; ratePct: number; sourceUrl: string } => row.ratePct != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const historicalMortgage5y = historicalMortgageRaw
    .map((row) => ({
      period: row.period,
      ratePct: toNumber(row.mortgage_5y_posted_rate_pct),
      sourceUrl: row.source_url,
    }))
    .filter((row): row is { period: string; ratePct: number; sourceUrl: string } => row.ratePct != null)
    .sort((a, b) => a.period.localeCompare(b.period));

  const latestOfficial = officialSpreadSeries.at(-1) ?? null;
  const latestEntrepreneurProxy = entrepreneurProxySeries.at(-1) ?? null;
  const latestBusinessDynamism = businessDynamism.at(-1) ?? null;
  const latestGdpPerCapita = gdpPerCapita.at(-1) ?? null;
  const gdpDeltaSince2019 =
    latestGdpPerCapita && gdpPerCapita.find((row) => row.year === 2019)
      ? Number(
          (
            ((latestGdpPerCapita.realGdpPerCapita2017Cad -
              (gdpPerCapita.find((row) => row.year === 2019)?.realGdpPerCapita2017Cad ?? 0)) /
              (gdpPerCapita.find((row) => row.year === 2019)?.realGdpPerCapita2017Cad ?? 1)) *
            100
          ).toFixed(1),
        )
      : null;

  const reportData = {
    generatedAt: new Date().toISOString(),
    title: "The Spread That Ate the Economy",
    subtitle:
      "How Canada’s Credit Architecture Redirected Capital from Business Formation to Housing",
    inputRoot: "data/canada_us_credit_spreads/",
    notes: {
      methodology:
        "This report uses the supplied CSV seed datasets only. Where the pack provides only a point-in-time proxy rather than a true time series, the UI calls that out explicitly.",
      thesisGuardrail:
        "Treat this as an evidence-backed framework about amplification and incentives, not a monocausal proof.",
    },
    executiveSummary: [
      "Housing is not only an affordability issue; it is also a capital-allocation issue.",
      "Canada has made levered residential real estate easier to finance, standardize, and scale than most operating businesses.",
      "Lower discount rates let investors accept lower yields, which can compress cap rates and lift values even when rents do not rise proportionally.",
      "Higher ownership values relative to rental income can push households toward renting while making housing more attractive as an investment vehicle.",
      "Business formation and productivity outcomes likely have multiple causes, but credit architecture may amplify the tilt toward housing.",
      "The evidence here is directional and framework-building; it should not be read as a single-cause explanation for Canada’s economic performance.",
    ],
    datasets: {
      officialCreditSpreadSeries: officialSpreadSeries,
      entrepreneurProxySeries,
      businessDynamism,
      gdpPerCapita,
      housingEconomicAccount,
      postedMortgage5yRecent: currentPosted5y,
      historicalMortgage5y,
    },
    highlights: {
      latestOfficialSpreadBps: latestOfficial?.spreadBps ?? null,
      latestOfficialPeriod: latestOfficial?.period ?? null,
      latestEntrepreneurFacingSpreadBps: latestEntrepreneurProxy?.spreadBps ?? null,
      latestEntrepreneurFacingPeriod: latestEntrepreneurProxy?.period ?? null,
      latestEntryRatePct: latestBusinessDynamism?.entryRatePct ?? null,
      latestExitRatePct: latestBusinessDynamism?.exitRatePct ?? null,
      latestNetEntryRatePct: latestBusinessDynamism?.netEntryRatePct ?? null,
      latestGdpPerCapita2017Cad: latestGdpPerCapita?.realGdpPerCapita2017Cad ?? null,
      gdpPerCapitaChangeSince2019Pct: gdpDeltaSince2019,
      housingWealthSharePct:
        housingEconomicAccount.find((row) => row.metric === "Housing assets share of national wealth")
          ?.value ?? null,
    },
    sourceRegistry,
    sourceLookup: {
      officialCreditSpread: sourceIndex.ca_new_existing_lending_rates_monthly ?? null,
      entrepreneurProxy: sourceIndex.bdc_small_business_loan_proxy ?? null,
      postedRates: sourceIndex.ca_posted_rates_weekly ?? null,
      historicalMortgage: sourceIndex.ca_mortgage_5y_historical_monthly ?? null,
      businessDynamism: sourceIndex.ca_business_entry_exit_2002_2023 ?? null,
      gdpPerCapita: sourceIndex.ca_gdp_per_capita_annual ?? null,
      housingEconomicAccount: sourceIndex.ca_housing_economic_account_2024 ?? null,
    },
  };

  const outputReadme = `# Credit Spreads Report Data

Generated from: \`data/canada_us_credit_spreads/\`
Generated at: ${reportData.generatedAt}

## Files

- \`report-data.json\` — normalized datasets and source metadata for the interactive Realist insight page.
- \`source-registry.json\` — source registry rows preserved from the supplied data pack.

## Datasets in report-data.json

- \`datasets.officialCreditSpreadSeries\` — monthly Bank of Canada aggregate spread series using insured 5-year residential mortgages vs total business loans.
- \`datasets.entrepreneurProxySeries\` — borrower-facing proxy points from the supplied seed file. This is not a true time series.
- \`datasets.businessDynamism\` — annual business entry, exit, and net entry rates for Canada.
- \`datasets.gdpPerCapita\` — annual real GDP per capita in 2017 CAD.
- \`datasets.housingEconomicAccount\` — 2024 housing economic account headline values from Statistics Canada.
- \`sourceRegistry\` — source metadata, URLs, statuses, and caveats from the pack.

## Input Pack README

${inputReadme.trim()}
`;

  await Promise.all([
    writeFile(path.join(OUTPUT_ROOT, "report-data.json"), JSON.stringify(reportData, null, 2)),
    writeFile(path.join(OUTPUT_ROOT, "source-registry.json"), JSON.stringify(sourceRegistry, null, 2)),
    writeFile(path.join(OUTPUT_ROOT, "README.md"), outputReadme),
  ]);
}

const executedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedDirectly) {
  buildCreditSpreadsData().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
