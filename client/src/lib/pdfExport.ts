import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";
import { formatCurrency } from "@/lib/calculations";

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
}

export async function exportToPDF(data: ExportData): Promise<void> {
  const { address, inputs, results, strategy, branding } = data;
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Header with branding support
  const headerColor = branding?.primaryColor 
    ? hexToRgb(branding.primaryColor) 
    : { r: 15, g: 23, b: 42 };
  
  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(0, 0, pageWidth, 45, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  
  // Use company name or default to REALIST.CA
  const headerTitle = branding?.companyName || "REALIST.CA";
  pdf.text(headerTitle.toUpperCase(), margin, 20);
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Real Estate Investment Analysis", margin, 30);
  
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 38);
  
  // Add contact info if branding available
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

  pdf.addPage();
  y = margin;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 25, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("10-Year Cash Flow Proforma", margin, 16);
  
  y = 35;
  pdf.setTextColor(0, 0, 0);

  const projections = results.yearlyProjections;
  const tableStartY = y;
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
    if (y > pdf.internal.pageSize.getHeight() - 20) {
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

  y = pdf.internal.pageSize.getHeight() - 20;
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  
  // Custom disclaimer if available
  if (branding?.disclaimerText) {
    pdf.text(branding.disclaimerText, margin, y);
    y += 4;
  }
  
  pdf.text("This analysis is for informational purposes only. Please consult with professionals before making investment decisions.", margin, y);
  y += 4;
  
  // Required footer - always include "prepared on realist.ca"
  pdf.text("This report was prepared on realist.ca", margin, y);
  y += 3;
  
  // Add website if branding available
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
