/**
 * Builds the downloadable Excel model for an underwriting view.
 *
 * Three sheets — Summary, Assumptions, Pro Forma — wired together with live
 * formulas that mirror shared/buyHoldAnalysis.ts line for line, so changing a
 * blue input cell in Excel / Google Sheets / Numbers re-underwrites the deal.
 * Cached values come from the same JS engine, which also makes the workbook
 * self-checking: proFormaWorkbook.test.ts recomputes the formulas and asserts
 * they agree with the engine.
 */
import type { BuyHoldInputs } from "@shared/schema";
import { calculateBuyHoldAnalysis } from "@shared/buyHoldAnalysis";
import { AGENT_VIEW_DISCLAIMER } from "@shared/agentViews";
import { XLSX_STYLE as S, buildXlsx, cellRef, columnLetter, type XlsxCell, type XlsxSheet } from "./xlsx";

export interface ProFormaWorkbookMeta {
  title: string;
  subtitle?: string | null;
  viewUrl?: string | null;
  generatedAt?: Date;
}

/** Row indexes (0-based) of each input on the Assumptions sheet, column B. */
const A = {
  purchasePrice: 5,
  closingCosts: 6,
  downPaymentPercent: 7,
  interestRate: 8,
  amortizationYears: 9,
  monthlyRent: 12,
  vacancyPercent: 13,
  rentGrowthPercent: 14,
  propertyTax: 17,
  insurance: 18,
  utilities: 19,
  maintenancePercent: 20,
  managementPercent: 21,
  capexReservePercent: 22,
  otherExpenses: 23,
  expenseInflationPercent: 24,
  appreciationPercent: 27,
  holdingPeriodYears: 28,
  sellingCostsPercent: 29,
  downPayment: 32,
  loanAmount: 33,
  totalCashInvested: 34,
  monthlyPayment: 35,
  annualDebtService: 36,
} as const;

/** Row indexes (0-based) on the Pro Forma sheet; years run across from column B. */
const P = {
  year: 0,
  grossRent: 1,
  vacancy: 2,
  effectiveIncome: 3,
  propertyTax: 4,
  insurance: 5,
  utilities: 6,
  maintenance: 7,
  management: 8,
  capex: 9,
  other: 10,
  totalExpenses: 11,
  noi: 12,
  debtService: 13,
  cashFlow: 14,
  cumulativeCashFlow: 15,
  propertyValue: 17,
  loanBalance: 18,
  equity: 19,
  principalPaid: 20,
  totalReturn: 21,
  netSaleProceeds: 23,
} as const;

const ASSUMPTIONS = "Assumptions";
const PRO_FORMA = "'Pro Forma'";

/** Absolute reference to an Assumptions input, e.g. Assumptions!$B$6. */
const a = (row: number) => `${ASSUMPTIONS}!${cellRef(1, row, true)}`;

const text = (value: string, style?: XlsxCell["style"]): XlsxCell => ({ value, style });

export function buildProFormaSheets(inputs: BuyHoldInputs, meta: ProFormaWorkbookMeta): XlsxSheet[] {
  const results = calculateBuyHoldAnalysis(inputs);
  const years = results.yearlyProjections;
  const generatedAt = meta.generatedAt ?? new Date();
  const downPayment = (inputs.purchasePrice * inputs.downPaymentPercent) / 100;

  // ----- Assumptions -----
  const assumptionRows: XlsxSheet["rows"] = [];
  const setA = (row: number, label: string, cell: XlsxCell, note?: string) => {
    assumptionRows[row] = [text(label), cell, note ? text(note, S.note) : null];
  };
  assumptionRows[0] = [text("Assumptions", S.title)];
  assumptionRows[1] = [text("Blue cells on yellow are inputs — change them and every sheet recalculates.", S.caption)];
  assumptionRows[4] = [text("Purchase & financing", S.section), text("", S.section), text("", S.section)];
  setA(A.purchasePrice, "Purchase price", { value: inputs.purchasePrice, style: S.inputCurrency });
  setA(A.closingCosts, "Closing costs", { value: inputs.closingCosts, style: S.inputCurrency }, "Land transfer tax, legal, inspection");
  setA(A.downPaymentPercent, "Down payment", { value: inputs.downPaymentPercent / 100, style: S.inputPercent });
  setA(A.interestRate, "Interest rate (annual)", { value: inputs.interestRate / 100, style: S.inputPercent });
  setA(A.amortizationYears, "Amortization (years)", { value: inputs.amortizationYears, style: S.inputInteger });
  assumptionRows[11] = [text("Income", S.section), text("", S.section), text("", S.section)];
  setA(A.monthlyRent, "Monthly rent (all units)", { value: inputs.monthlyRent, style: S.inputCurrency });
  setA(A.vacancyPercent, "Vacancy allowance", { value: inputs.vacancyPercent / 100, style: S.inputPercent }, "% of gross rent");
  setA(A.rentGrowthPercent, "Rent growth (per year)", { value: inputs.rentGrowthPercent / 100, style: S.inputPercent });
  assumptionRows[16] = [text("Operating expenses", S.section), text("", S.section), text("", S.section)];
  setA(A.propertyTax, "Property tax (annual)", { value: inputs.propertyTax, style: S.inputCurrency });
  setA(A.insurance, "Insurance (annual)", { value: inputs.insurance, style: S.inputCurrency });
  setA(A.utilities, "Utilities (monthly)", { value: inputs.utilities, style: S.inputCurrency }, "Owner-paid only");
  setA(A.maintenancePercent, "Maintenance", { value: inputs.maintenancePercent / 100, style: S.inputPercent }, "% of gross rent");
  setA(A.managementPercent, "Property management", { value: inputs.managementPercent / 100, style: S.inputPercent }, "% of gross rent");
  setA(A.capexReservePercent, "CapEx reserve", { value: inputs.capexReservePercent / 100, style: S.inputPercent }, "% of gross rent");
  setA(A.otherExpenses, "Other expenses (monthly)", { value: inputs.otherExpenses, style: S.inputCurrency });
  setA(A.expenseInflationPercent, "Expense inflation (per year)", { value: inputs.expenseInflationPercent / 100, style: S.inputPercent });
  assumptionRows[26] = [text("Exit", S.section), text("", S.section), text("", S.section)];
  setA(A.appreciationPercent, "Appreciation (per year)", { value: inputs.appreciationPercent / 100, style: S.inputPercent });
  setA(A.holdingPeriodYears, "Holding period (years)", { value: inputs.holdingPeriodYears, style: S.inputInteger }, `Between 1 and ${years.length} — the Pro Forma sheet projects ${years.length} years`);
  setA(A.sellingCostsPercent, "Selling costs", { value: inputs.sellingCostsPercent / 100, style: S.inputPercent }, "% of sale price");
  assumptionRows[31] = [text("Derived", S.section), text("", S.section), text("", S.section)];
  const price = cellRef(1, A.purchasePrice);
  const rate = cellRef(1, A.interestRate);
  const amort = cellRef(1, A.amortizationYears);
  const loan = cellRef(1, A.loanAmount);
  setA(A.downPayment, "Down payment ($)", { formula: `${price}*${cellRef(1, A.downPaymentPercent)}`, value: downPayment, style: S.currency });
  setA(A.loanAmount, "Loan amount", { formula: `${price}-${cellRef(1, A.downPayment)}`, value: results.loanAmount, style: S.currency });
  setA(A.totalCashInvested, "Total cash invested", { formula: `${cellRef(1, A.downPayment)}+${cellRef(1, A.closingCosts)}`, value: results.totalCashInvested, style: S.currency });
  setA(A.monthlyPayment, "Monthly mortgage payment", {
    formula: `IF(OR(${loan}<=0,${amort}<=0),0,IF(${rate}<=0,${loan}/(${amort}*12),${loan}*(${rate}/12)*(1+${rate}/12)^(${amort}*12)/((1+${rate}/12)^(${amort}*12)-1)))`,
    value: results.monthlyMortgagePayment,
    style: S.currency,
  }, "Monthly compounding, matching realist.ca");
  setA(A.annualDebtService, "Annual debt service", { formula: `${cellRef(1, A.monthlyPayment)}*12`, value: results.monthlyMortgagePayment * 12, style: S.currency });

  // ----- Pro Forma -----
  const proFormaRows: XlsxSheet["rows"] = [];
  const line = (row: number, label: string, labelStyle?: XlsxCell["style"]) => {
    proFormaRows[row] = [text(label, labelStyle)];
    return proFormaRows[row]!;
  };
  const header = line(P.year, "Year", S.header);
  const rowsByKey = {
    grossRent: line(P.grossRent, "Gross rent"),
    vacancy: line(P.vacancy, "Less: vacancy"),
    effectiveIncome: line(P.effectiveIncome, "Effective income", S.label),
    propertyTax: line(P.propertyTax, "  Property tax"),
    insurance: line(P.insurance, "  Insurance"),
    utilities: line(P.utilities, "  Utilities"),
    maintenance: line(P.maintenance, "  Maintenance"),
    management: line(P.management, "  Management"),
    capex: line(P.capex, "  CapEx reserve"),
    other: line(P.other, "  Other"),
    totalExpenses: line(P.totalExpenses, "Total operating expenses", S.label),
    noi: line(P.noi, "Net operating income", S.label),
    debtService: line(P.debtService, "Less: debt service"),
    cashFlow: line(P.cashFlow, "Cash flow", S.label),
    cumulativeCashFlow: line(P.cumulativeCashFlow, "Cumulative cash flow"),
    propertyValue: line(P.propertyValue, "Property value"),
    loanBalance: line(P.loanBalance, "Loan balance"),
    equity: line(P.equity, "Equity", S.label),
    principalPaid: line(P.principalPaid, "Principal paid (cumulative)"),
    totalReturn: line(P.totalReturn, "Total return", S.label),
    netSaleProceeds: line(P.netSaleProceeds, "Net proceeds if sold this year"),
  };

  years.forEach((y, i) => {
    const col = i + 1;
    const here = (row: number) => cellRef(col, row);
    const yr = `${columnLetter(col)}$1`;
    const inflation = `(1+${a(A.expenseInflationPercent)})^(${yr}-1)`;
    const r = a(A.interestRate);
    const L = a(A.loanAmount);
    const n = a(A.amortizationYears);
    const pmt = a(A.monthlyPayment);
    const months = `(12*${yr})`;

    header[col] = i === 0 ? { value: 1, style: S.header } : { formula: `${cellRef(col - 1, P.year)}+1`, value: y.year, style: S.header };
    rowsByKey.grossRent[col] = { formula: `${a(A.monthlyRent)}*12*(1+${a(A.rentGrowthPercent)})^(${yr}-1)`, value: y.grossRent, style: S.currency };
    rowsByKey.vacancy[col] = { formula: `${here(P.grossRent)}*${a(A.vacancyPercent)}`, value: y.vacancyLoss, style: S.currency };
    rowsByKey.effectiveIncome[col] = { formula: `${here(P.grossRent)}-${here(P.vacancy)}`, value: y.effectiveIncome, style: S.totalCurrency };
    rowsByKey.propertyTax[col] = { formula: `${a(A.propertyTax)}*${inflation}`, value: y.expenses.propertyTax, style: S.currency };
    rowsByKey.insurance[col] = { formula: `${a(A.insurance)}*${inflation}`, value: y.expenses.insurance, style: S.currency };
    rowsByKey.utilities[col] = { formula: `${a(A.utilities)}*12*${inflation}`, value: y.expenses.utilities, style: S.currency };
    rowsByKey.maintenance[col] = { formula: `${here(P.grossRent)}*${a(A.maintenancePercent)}`, value: y.expenses.maintenance, style: S.currency };
    rowsByKey.management[col] = { formula: `${here(P.grossRent)}*${a(A.managementPercent)}`, value: y.expenses.management, style: S.currency };
    rowsByKey.capex[col] = { formula: `${here(P.grossRent)}*${a(A.capexReservePercent)}`, value: y.expenses.capexReserve, style: S.currency };
    rowsByKey.other[col] = { formula: `${a(A.otherExpenses)}*12*${inflation}`, value: y.expenses.other, style: S.currency };
    rowsByKey.totalExpenses[col] = { formula: `SUM(${here(P.propertyTax)}:${here(P.other)})`, value: y.expenses.total, style: S.totalCurrency };
    rowsByKey.noi[col] = { formula: `${here(P.effectiveIncome)}-${here(P.totalExpenses)}`, value: y.noi, style: S.totalCurrency };
    rowsByKey.debtService[col] = { formula: a(A.annualDebtService), value: y.debtService, style: S.currency };
    rowsByKey.cashFlow[col] = { formula: `${here(P.noi)}-${here(P.debtService)}`, value: y.cashFlow, style: S.totalCurrency };
    rowsByKey.cumulativeCashFlow[col] = {
      formula: i === 0 ? here(P.cashFlow) : `${cellRef(col - 1, P.cumulativeCashFlow)}+${here(P.cashFlow)}`,
      value: y.cumulativeCashFlow,
      style: S.currency,
    };
    rowsByKey.propertyValue[col] = { formula: `${a(A.purchasePrice)}*(1+${a(A.appreciationPercent)})^${yr}`, value: y.propertyValue, style: S.currency };
    rowsByKey.loanBalance[col] = {
      formula: `IF(${L}<=0,0,IF(${r}<=0,MAX(0,${L}-${L}/(${n}*12)*${months}),MAX(0,${L}*(1+${r}/12)^${months}-${pmt}*(((1+${r}/12)^${months}-1)/(${r}/12)))))`,
      value: y.loanBalance,
      style: S.currency,
    };
    rowsByKey.equity[col] = { formula: `${here(P.propertyValue)}-${here(P.loanBalance)}`, value: y.equity, style: S.totalCurrency };
    rowsByKey.principalPaid[col] = { formula: `${L}-${here(P.loanBalance)}`, value: y.cumulativePrincipalPaid, style: S.currency };
    rowsByKey.totalReturn[col] = {
      formula: `${here(P.cumulativeCashFlow)}+${here(P.principalPaid)}+(${here(P.propertyValue)}-${a(A.purchasePrice)})`,
      value: y.totalReturn,
      style: S.totalCurrency,
    };
    rowsByKey.netSaleProceeds[col] = {
      formula: `${here(P.propertyValue)}*(1-${a(A.sellingCostsPercent)})-${here(P.loanBalance)}`,
      value: y.propertyValue * (1 - inputs.sellingCostsPercent / 100) - y.loanBalance,
      style: S.currency,
    };
  });

  // ----- Summary -----
  const pf = (row: number, col = 1) => `${PRO_FORMA}!${cellRef(col, row)}`;
  const IRR_FIRST_ROW = 14; // Year 0 row on the Summary sheet
  const hold = a(A.holdingPeriodYears);
  const irrFlows = [-results.totalCashInvested];
  const summaryRows: XlsxSheet["rows"] = [];
  summaryRows[0] = [text(meta.title, S.title)];
  summaryRows[1] = [text(meta.subtitle || "Buy & hold underwriting", S.caption)];
  summaryRows[2] = [text(`Generated ${generatedAt.toISOString().slice(0, 10)} by Realist.ca${meta.viewUrl ? ` — interactive version: ${meta.viewUrl}` : ""}`, S.caption)];
  summaryRows[4] = [text("Key metrics (year 1)", S.section), text("", S.section), text("", S.section)];
  summaryRows[5] = [text("Cap rate"), { formula: `IF(${a(A.purchasePrice)}>0,${pf(P.noi)}/${a(A.purchasePrice)},0)`, value: results.capRate / 100, style: S.percent }, text("NOI ÷ purchase price", S.note)];
  summaryRows[6] = [text("Cash-on-cash return"), { formula: `IF(${a(A.totalCashInvested)}>0,${pf(P.cashFlow)}/${a(A.totalCashInvested)},0)`, value: results.cashOnCash / 100, style: S.percent }, text("Year-1 cash flow ÷ total cash invested", S.note)];
  summaryRows[7] = [text("DSCR"), { formula: `IF(${a(A.annualDebtService)}>0,${pf(P.noi)}/${a(A.annualDebtService)},0)`, value: Number.isFinite(results.dscr) ? results.dscr : 0, style: S.ratio }, text("NOI ÷ annual debt service (lenders usually want 1.20x+)", S.note)];
  summaryRows[8] = [text("Monthly cash flow"), { formula: `${pf(P.cashFlow)}/12`, value: results.monthlyCashFlow, style: S.currency }];
  summaryRows[9] = [text("Net operating income"), { formula: pf(P.noi), value: results.annualNoi, style: S.currency }];
  summaryRows[10] = [text("Total cash invested"), { formula: a(A.totalCashInvested), value: results.totalCashInvested, style: S.currency }];
  summaryRows[11] = [
    text("IRR over the holding period", S.label),
    { formula: `IFERROR(IRR(${cellRef(1, IRR_FIRST_ROW)}:${cellRef(1, IRR_FIRST_ROW + years.length)}),0)`, value: (results.irr ?? 0) / 100, style: S.totalPercent },
    text("Levered, after selling costs — from the cash flows below", S.note),
  ];
  summaryRows[13] = [text("Investor cash flows", S.section), text("", S.section), text("", S.section)];
  summaryRows[IRR_FIRST_ROW] = [text("Year 0 (cash in)"), { formula: `-${a(A.totalCashInvested)}`, value: -results.totalCashInvested, style: S.currency }];
  years.forEach((y, i) => {
    const col = i + 1;
    const cf = pf(P.cashFlow, col);
    const sale = pf(P.netSaleProceeds, col);
    const held = y.year < inputs.holdingPeriodYears;
    const exit = y.year === inputs.holdingPeriodYears;
    const cached = held ? y.cashFlow : exit ? y.cashFlow + (y.propertyValue * (1 - inputs.sellingCostsPercent / 100) - y.loanBalance) : 0;
    irrFlows.push(cached);
    summaryRows[IRR_FIRST_ROW + 1 + i] = [
      text(`Year ${y.year}`),
      { formula: `IF(${y.year}<${hold},${cf},IF(${y.year}=${hold},${cf}+${sale},0))`, value: cached, style: S.currency },
      exit ? text("Exit year: operating cash flow + net sale proceeds", S.note) : null,
    ];
  });
  summaryRows[IRR_FIRST_ROW + years.length + 2] = [text(AGENT_VIEW_DISCLAIMER, S.caption)];

  return [
    { name: "Summary", rows: summaryRows, columnWidths: [34, 18, 70] },
    { name: "Assumptions", rows: assumptionRows, columnWidths: [34, 18, 70] },
    { name: "Pro Forma", rows: proFormaRows, columnWidths: [32, ...years.map(() => 14)], freeze: { cols: 1, rows: 1 } },
  ];
}

export function buildProFormaWorkbook(inputs: BuyHoldInputs, meta: ProFormaWorkbookMeta): Buffer {
  return buildXlsx(buildProFormaSheets(inputs, meta));
}

/** Year-by-year pro forma as CSV (values only) for tools that cannot read xlsx. */
export function buildProFormaCsv(inputs: BuyHoldInputs): string {
  const years = calculateBuyHoldAnalysis(inputs).yearlyProjections;
  const lines: Array<[string, (y: (typeof years)[number]) => number]> = [
    ["Gross rent", (y) => y.grossRent],
    ["Vacancy", (y) => -y.vacancyLoss],
    ["Effective income", (y) => y.effectiveIncome],
    ["Property tax", (y) => -y.expenses.propertyTax],
    ["Insurance", (y) => -y.expenses.insurance],
    ["Utilities", (y) => -y.expenses.utilities],
    ["Maintenance", (y) => -y.expenses.maintenance],
    ["Management", (y) => -y.expenses.management],
    ["CapEx reserve", (y) => -y.expenses.capexReserve],
    ["Other", (y) => -y.expenses.other],
    ["Net operating income", (y) => y.noi],
    ["Debt service", (y) => -y.debtService],
    ["Cash flow", (y) => y.cashFlow],
    ["Cumulative cash flow", (y) => y.cumulativeCashFlow],
    ["Property value", (y) => y.propertyValue],
    ["Loan balance", (y) => y.loanBalance],
    ["Equity", (y) => y.equity],
    ["Total return", (y) => y.totalReturn],
  ];
  const header = ["Line item", ...years.map((y) => `Year ${y.year}`)].join(",");
  const body = lines.map(([label, pick]) => [label, ...years.map((y) => Math.round(pick(y)))].join(","));
  return [header, ...body].join("\n") + "\n";
}
