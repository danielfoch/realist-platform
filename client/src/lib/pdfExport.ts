import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";
import { formatCurrency, type StressTestResults } from "@/lib/calculations";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 15, g: 23, b: 42 };
}

export interface BrandingOptions {
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  disclaimerText?: string | null;
}

interface ExportData {
  address: string;
  inputs: BuyHoldInputs;
  results: AnalysisResults;
  strategy: string;
  branding?: BrandingOptions;
  stressTest?: StressTestResults;
}

export async function exportToPDF(data: ExportData): Promise<void> {
  const { address, inputs, results, strategy, branding, stressTest } = data;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  const headerColor = branding?.primaryColor 
    ? hexToRgb(branding.primaryColor) 
    : { r: 15, g: 23, b: 42 };
  
  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(0, 0, pageWidth, 45, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  
  const headerTitle = branding?.companyName || "REALIST.CA";
  pdf.text(headerTitle.toUpperCase(), margin, 20);
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Real Estate Investment Analysis", margin, 30);
  
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 38);
  
  if (branding?.contactEmail || branding?.contactPhone) {
    let contactText = "";
    if (branding.contactEmail) contactText += branding.contactEmail;
    if (branding.contactPhone) contactText += (contactText ? " | " : "") + branding.contactPhone;
    pdf.text(contactText, pageWidth - margin, 38, { align: "right" });
  }

  y = 55;
  pdf.setTextColor(0, 0, 0);

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Property Details", margin, y);
  y += 8;
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Address: ${address || "Not specified"}`, margin, y);
  y += 6;
  pdf.text(`Strategy: ${strategy.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`, margin, y);
  y += 12;

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, contentWidth, 50, 3, 3, "F");
  
  y += 8;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Key Metrics", margin + 5, y);
  y += 10;
  
  const metricsCol1X = margin + 5;
  const metricsCol2X = margin + contentWidth / 2;
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  
  pdf.setFont("helvetica", "bold");
  pdf.text("Cap Rate:", metricsCol1X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${results.capRate.toFixed(2)}%`, metricsCol1X + 35, y);
  
  pdf.setFont("helvetica", "bold");
  pdf.text("Cash-on-Cash:", metricsCol2X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${results.cashOnCash.toFixed(2)}%`, metricsCol2X + 40, y);
  y += 8;
  
  pdf.setFont("helvetica", "bold");
  pdf.text("DSCR:", metricsCol1X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${results.dscr.toFixed(2)}`, metricsCol1X + 35, y);
  
  pdf.setFont("helvetica", "bold");
  pdf.text("IRR:", metricsCol2X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${results.irr !== null ? results.irr.toFixed(2) : "N/A"}%`, metricsCol2X + 40, y);
  y += 8;
  
  pdf.setFont("helvetica", "bold");
  pdf.text("Monthly Cash Flow:", metricsCol1X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(formatCurrency(results.monthlyCashFlow), metricsCol1X + 50, y);
  
  pdf.setFont("helvetica", "bold");
  pdf.text("Annual Cash Flow:", metricsCol2X, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(formatCurrency(results.monthlyCashFlow * 12), metricsCol2X + 48, y);
  
  y += 25;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Purchase & Financing", margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  
  const addRow = (label: string, value: string, col: number) => {
    const xPos = col === 1 ? margin : margin + contentWidth / 2;
    pdf.text(`${label}: ${value}`, xPos, y);
  };
  
  addRow("Purchase Price", formatCurrency(inputs.purchasePrice), 1);
  addRow("Closing Costs", formatCurrency(inputs.closingCosts), 2);
  y += 6;
  
  addRow("Down Payment", `${inputs.downPaymentPercent}%`, 1);
  addRow("Loan Amount", formatCurrency(results.loanAmount), 2);
  y += 6;
  
  addRow("Interest Rate", `${inputs.interestRate}%`, 1);
  addRow("Monthly Payment", formatCurrency(results.monthlyMortgagePayment), 2);
  y += 6;
  
  addRow("Amortization", `${inputs.amortizationYears} years`, 1);
  addRow("Total Cash Invested", formatCurrency(results.totalCashInvested), 2);
  y += 12;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Income & Expenses", margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  
  addRow("Monthly Rent", formatCurrency(inputs.monthlyRent), 1);
  addRow("Vacancy Rate", `${inputs.vacancyPercent}%`, 2);
  y += 6;
  
  addRow("Effective Monthly Income", formatCurrency(results.effectiveMonthlyIncome), 1);
  addRow("Net Operating Income", formatCurrency(results.annualNoi), 2);
  y += 6;
  
  addRow("Property Tax", formatCurrency(inputs.propertyTax) + "/yr", 1);
  addRow("Insurance", formatCurrency(inputs.insurance) + "/yr", 2);
  y += 6;
  
  addRow("Maintenance", `${inputs.maintenancePercent}%`, 1);
  addRow("Management", `${inputs.managementPercent}%`, 2);
  y += 12;

  // Stress Test Section
  if (stressTest) {
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, contentWidth, 55, 3, 3, "F");
    
    y += 8;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Stress Test Analysis", margin + 5, y);
    y += 8;
    
    // Draw stress test table header
    const stressColWidth = (contentWidth - 60) / 3;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("Metric", margin + 5, y);
    pdf.text("Base", margin + 60, y, { align: "center" });
    pdf.text("Bear (-)", margin + 60 + stressColWidth, y, { align: "center" });
    pdf.text("Bull (+)", margin + 60 + stressColWidth * 2, y, { align: "center" });
    y += 2;
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin + 5, y, margin + contentWidth - 5, y);
    y += 6;
    
    // Draw stress test rows
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    
    const stressRows = [
      { label: "Annual NOI", base: stressTest.base.annualNoi, bear: stressTest.bear.annualNoi, bull: stressTest.bull.annualNoi, format: "currency" },
      { label: "DSCR", base: stressTest.base.dscr, bear: stressTest.bear.dscr, bull: stressTest.bull.dscr, format: "dscr" },
      { label: "Annual Cash Flow", base: stressTest.base.annualCashFlow, bear: stressTest.bear.annualCashFlow, bull: stressTest.bull.annualCashFlow, format: "currency" },
    ];
    
    stressRows.forEach(row => {
      pdf.text(row.label, margin + 5, y);
      const formatVal = (val: number) => row.format === "dscr" ? val.toFixed(2) + "x" : formatCurrency(val);
      pdf.text(formatVal(row.base), margin + 60, y, { align: "center" });
      
      // Color code bear/bull values
      const bearColor = row.bear < row.base ? [220, 38, 38] : [34, 197, 94];
      const bullColor = row.bull > row.base ? [34, 197, 94] : [220, 38, 38];
      
      pdf.setTextColor(bearColor[0], bearColor[1], bearColor[2]);
      pdf.text(formatVal(row.bear), margin + 60 + stressColWidth, y, { align: "center" });
      
      pdf.setTextColor(bullColor[0], bullColor[1], bullColor[2]);
      pdf.text(formatVal(row.bull), margin + 60 + stressColWidth * 2, y, { align: "center" });
      
      pdf.setTextColor(0, 0, 0);
      y += 6;
    });
    
    y += 4;
    pdf.setFontSize(7);
    pdf.setTextColor(128, 128, 128);
    pdf.text("Bear: -5% rent, +3% vacancy, +5% expenses, +1% rate  |  Bull: +3% rent, -1% vacancy, -2% expenses, -0.5% rate", margin + 5, y);
    pdf.setTextColor(0, 0, 0);
    y += 10;
  } else {
    // Original Investment Summary box if no stress test
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, y, contentWidth, 35, 3, 3, "F");
    
    y += 8;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Investment Summary", margin + 5, y);
    y += 10;
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    
    const summaryCol1X = margin + 5;
    const summaryCol2X = margin + contentWidth / 2;
    
    pdf.text(`Total Investment: ${formatCurrency(results.totalCashInvested)}`, summaryCol1X, y);
    pdf.text(`Annual Cash Flow: ${formatCurrency(results.annualCashFlow)}`, summaryCol2X, y);
    y += 6;
    
    pdf.text(`Break-even Occupancy: ${((results.monthlyExpenses + results.monthlyMortgagePayment) / inputs.monthlyRent * 100).toFixed(1)}%`, summaryCol1X, y);
    pdf.text(`Monthly Cash Flow: ${formatCurrency(results.monthlyCashFlow)}`, summaryCol2X, y);
    y += 10;
  }

  // Page 2: 10-Year Proforma
  pdf.addPage();
  y = margin;

  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(0, 0, pageWidth, 25, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("10-Year Cash Flow Proforma", margin, 16);
  
  y = 35;
  pdf.setTextColor(0, 0, 0);

  const projections = results.yearlyProjections;
  const rowHeight = 6;
  const headerHeight = 8;
  const colWidths = [42, ...Array(10).fill((contentWidth - 42) / 10)];
  
  const drawTableHeader = () => {
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, y, contentWidth, headerHeight, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("Category", margin + 2, y + 5);
    
    for (let i = 0; i < Math.min(10, projections.length); i++) {
      const xPos = margin + colWidths[0] + (colWidths[1] * i) + 2;
      pdf.text(`Year ${i + 1}`, xPos, y + 5);
    }
    y += headerHeight;
  };
  
  const drawRow = (label: string, values: number[], isBold = false, isNegative = false, indent = 0) => {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = margin;
      drawTableHeader();
    }
    
    pdf.setFontSize(6);
    pdf.setFont("helvetica", isBold ? "bold" : "normal");
    pdf.text(label, margin + 2 + indent, y + 4);
    
    for (let i = 0; i < Math.min(10, values.length); i++) {
      const xPos = margin + colWidths[0] + (colWidths[1] * i) + 2;
      const displayValue = isNegative ? `(${formatCurrency(Math.abs(values[i]))})` : formatCurrency(values[i]);
      const shortValue = displayValue.replace("CA$", "$").replace(",000", "k");
      pdf.text(shortValue, xPos, y + 4);
    }
    y += rowHeight;
  };
  
  drawTableHeader();
  
  pdf.setDrawColor(230, 230, 230);
  pdf.line(margin, y, margin + contentWidth, y);
  
  drawRow("Gross Rent", projections.map(p => p.grossRent), true);
  drawRow("Less: Vacancy", projections.map(p => p.vacancyLoss), false, true);
  drawRow("Effective Income", projections.map(p => p.effectiveIncome), true);
  
  pdf.line(margin, y, margin + contentWidth, y);
  
  drawRow("Operating Expenses", projections.map(p => p.expenses.total), true, true);
  drawRow("  Property Tax", projections.map(p => p.expenses.propertyTax), false, false, 4);
  drawRow("  Insurance", projections.map(p => p.expenses.insurance), false, false, 4);
  drawRow("  Utilities", projections.map(p => p.expenses.utilities), false, false, 4);
  drawRow("  Maintenance", projections.map(p => p.expenses.maintenance), false, false, 4);
  drawRow("  Management", projections.map(p => p.expenses.management), false, false, 4);
  drawRow("  CapEx Reserve", projections.map(p => p.expenses.capexReserve), false, false, 4);
  drawRow("  Other", projections.map(p => p.expenses.other), false, false, 4);
  
  pdf.line(margin, y, margin + contentWidth, y);
  
  drawRow("Net Operating Income", projections.map(p => p.noi), true);
  drawRow("Less: Debt Service", projections.map(p => p.debtService), false, true);
  
  pdf.setFillColor(240, 253, 244);
  pdf.rect(margin, y, contentWidth, rowHeight, "F");
  drawRow("Cash Flow", projections.map(p => p.cashFlow), true);
  
  y += 4;
  pdf.line(margin, y, margin + contentWidth, y);
  y += 2;
  
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Equity & Value", margin + 2, y + 4);
  y += 6;
  
  drawRow("Property Value", projections.map(p => p.propertyValue));
  drawRow("Loan Balance", projections.map(p => p.loanBalance), false, true);
  drawRow("Equity", projections.map(p => p.equity), true);
  drawRow("Cumulative Cash Flow", projections.map(p => p.cumulativeCashFlow));
  
  pdf.setFillColor(248, 250, 252);
  pdf.rect(margin, y, contentWidth, rowHeight, "F");
  drawRow("Total Return", projections.map(p => p.totalReturn), true);

  // Page 3: Charts & Analysis (Visual Data)
  pdf.addPage();
  y = margin;

  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(0, 0, pageWidth, 25, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("Investment Analysis Charts", margin, 16);
  
  y = 35;
  pdf.setTextColor(0, 0, 0);

  // Expense Breakdown Table
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Monthly Expense Breakdown", margin, y);
  y += 8;

  const expenses = results.expenseBreakdown;
  const expenseItems = [
    { name: "Property Tax", value: expenses.propertyTax, color: "#E53935" },
    { name: "Insurance", value: expenses.insurance, color: "#1E88E5" },
    { name: "Utilities", value: expenses.utilities, color: "#43A047" },
    { name: "Maintenance", value: expenses.maintenance, color: "#FB8C00" },
    { name: "Management", value: expenses.management, color: "#8E24AA" },
    { name: "CapEx Reserve", value: expenses.capexReserve, color: "#00ACC1" },
    { name: "Other", value: expenses.other, color: "#FDD835" },
  ].filter(e => e.value > 0);

  const totalExpenses = expenseItems.reduce((sum, e) => sum + e.value, 0);
  
  // Draw expense bars
  expenseItems.forEach(expense => {
    const percentage = (expense.value / totalExpenses) * 100;
    const barWidth = (percentage / 100) * (contentWidth - 80);
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(expense.name, margin, y + 4);
    
    const rgb = hexToRgb(expense.color);
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.roundedRect(margin + 45, y, barWidth, 6, 1, 1, "F");
    
    pdf.text(`${formatCurrency(expense.value)} (${percentage.toFixed(1)}%)`, margin + 50 + barWidth, y + 4);
    y += 10;
  });
  
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.text(`Total Monthly Expenses: ${formatCurrency(totalExpenses)}`, margin, y);
  y += 15;

  // Cash Flow Chart Data
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Annual Cash Flow Trend", margin, y);
  y += 8;

  const maxCashFlow = Math.max(...projections.map(p => p.cashFlow));
  const minCashFlow = Math.min(...projections.map(p => p.cashFlow));
  const range = maxCashFlow - minCashFlow || 1;
  const chartHeight = 40;
  const chartWidth = contentWidth - 20;
  const barSpacing = chartWidth / projections.length;

  // Draw chart background
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, contentWidth, chartHeight + 20, 3, 3, "F");
  
  // Draw zero line if there are negative values
  const zeroY = minCashFlow < 0 
    ? y + 5 + (chartHeight * (maxCashFlow / range))
    : y + 5 + chartHeight;
  
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin + 10, zeroY, margin + contentWidth - 10, zeroY);

  // Draw bars
  projections.forEach((p, i) => {
    const barHeight = (Math.abs(p.cashFlow) / range) * chartHeight;
    const barX = margin + 10 + (i * barSpacing) + 2;
    const barY = p.cashFlow >= 0 ? zeroY - barHeight : zeroY;
    
    if (p.cashFlow >= 0) {
      pdf.setFillColor(34, 197, 94);
    } else {
      pdf.setFillColor(239, 68, 68);
    }
    
    pdf.roundedRect(barX, barY, barSpacing - 4, barHeight, 1, 1, "F");
    
    // Year label
    pdf.setFontSize(6);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Y${p.year}`, barX + (barSpacing - 4) / 2, y + chartHeight + 15, { align: "center" });
  });
  
  pdf.setTextColor(0, 0, 0);
  y += chartHeight + 25;

  // Equity Growth Summary
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Equity & Value Growth Summary", margin, y);
  y += 8;

  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, contentWidth, 45, 3, 3, "F");
  y += 8;

  const yearStart = projections[0];
  const yearEnd = projections[projections.length - 1];

  pdf.setFontSize(10);
  const col1 = margin + 5;
  const col2 = margin + contentWidth / 3;
  const col3 = margin + (contentWidth * 2 / 3);

  pdf.setFont("helvetica", "bold");
  pdf.text("", col1, y);
  pdf.text("Year 1", col2, y);
  pdf.text(`Year ${projections.length}`, col3, y);
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.text("Property Value:", col1, y);
  pdf.text(formatCurrency(yearStart.propertyValue), col2, y);
  pdf.text(formatCurrency(yearEnd.propertyValue), col3, y);
  y += 6;

  pdf.text("Loan Balance:", col1, y);
  pdf.text(formatCurrency(yearStart.loanBalance), col2, y);
  pdf.text(formatCurrency(yearEnd.loanBalance), col3, y);
  y += 6;

  pdf.text("Equity:", col1, y);
  pdf.text(formatCurrency(yearStart.equity), col2, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(34, 150, 94);
  pdf.text(formatCurrency(yearEnd.equity), col3, y);
  pdf.setTextColor(0, 0, 0);
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.text("Total Return:", col1, y);
  pdf.text(formatCurrency(yearStart.totalReturn), col2, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(34, 150, 94);
  pdf.text(formatCurrency(yearEnd.totalReturn), col3, y);
  pdf.setTextColor(0, 0, 0);

  // Footer on last page
  y = pageHeight - 20;
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  
  if (branding?.disclaimerText) {
    pdf.text(branding.disclaimerText, margin, y);
    y += 4;
  }
  
  pdf.text("This analysis is for informational purposes only. Please consult with professionals before making investment decisions.", margin, y);
  y += 4;
  
  pdf.text("This report was prepared on realist.ca", margin, y);
  y += 3;
  
  if (branding?.website) {
    pdf.text(`Professional prepared by: ${branding.companyName || ''} | ${branding.website}`, margin, y);
  }

  const filename = `realist-analysis-${address ? address.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 30) : "property"}-${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(filename);
}

export async function captureAndExportPDF(
  elementRef: React.RefObject<HTMLElement>,
  data: ExportData
): Promise<void> {
  if (!elementRef.current) {
    await exportToPDF(data);
    return;
  }

  try {
    const dataUrl = await toPng(elementRef.current, {
      quality: 0.95,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const img = new Image();
    img.src = dataUrl;
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const imgRatio = img.width / img.height;
    let imgWidth = pageWidth - 20;
    let imgHeight = imgWidth / imgRatio;

    if (imgHeight > pageHeight - 30) {
      imgHeight = pageHeight - 30;
      imgWidth = imgHeight * imgRatio;
    }

    pdf.addImage(dataUrl, "PNG", 10, 15, imgWidth, imgHeight);

    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text("This report was prepared on realist.ca", 10, footerY);

    const filename = `realist-analysis-${data.address ? data.address.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 30) : "property"}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(filename);
  } catch {
    await exportToPDF(data);
  }
}
