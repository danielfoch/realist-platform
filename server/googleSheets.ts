// Google Sheets Integration - using Replit Connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

interface ExportData {
  address: string;
  strategy: string;
  inputs: {
    purchasePrice: number;
    closingCosts: number;
    downPaymentPercent: number;
    interestRate: number;
    amortizationYears: number;
    loanTermYears: number;
    monthlyRent: number;
    vacancyPercent: number;
    propertyTax: number;
    insurance: number;
    utilities: number;
    maintenancePercent: number;
    managementPercent: number;
    capexReservePercent: number;
    otherExpenses: number;
    rentGrowthPercent: number;
    expenseInflationPercent: number;
    appreciationPercent: number;
    holdingPeriodYears: number;
    sellingCostsPercent: number;
  };
  results: {
    capRate: number;
    cashOnCash: number;
    dscr: number;
    irr: number | null;
    monthlyNoi: number;
    monthlyCashFlow: number;
    annualNoi: number;
    annualCashFlow: number;
    totalCashInvested: number;
    loanAmount: number;
    monthlyMortgagePayment: number;
    grossMonthlyIncome: number;
    effectiveMonthlyIncome: number;
    monthlyExpenses: number;
    yearlyProjections: Array<{
      year: number;
      equity: number;
      cashFlow: number;
      propertyValue: number;
      loanBalance: number;
      cumulativeCashFlow: number;
    }>;
    expenseBreakdown: {
      propertyTax: number;
      insurance: number;
      utilities: number;
      maintenance: number;
      management: number;
      capexReserve: number;
      other: number;
    };
  };
}

export async function exportToGoogleSheets(data: ExportData): Promise<string> {
  const sheets = await getUncachableGoogleSheetClient();
  
  const title = `Realist Analysis - ${data.address || 'Property'} - ${new Date().toLocaleDateString()}`;
  
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
      },
      sheets: [
        { properties: { title: 'Summary', sheetId: 0 } },
        { properties: { title: 'Financial Model', sheetId: 1 } },
        { properties: { title: 'Projections', sheetId: 2 } },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl!;

  const summaryData = [
    ['REALIST.CA - Real Estate Investment Analysis'],
    [''],
    ['Property Information'],
    ['Address', data.address || 'Not specified'],
    ['Strategy', data.strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['KEY METRICS'],
    ['Cap Rate', `${data.results.capRate.toFixed(2)}%`],
    ['Cash-on-Cash Return', `${data.results.cashOnCash.toFixed(2)}%`],
    ['DSCR', data.results.dscr.toFixed(2)],
    ['IRR', data.results.irr ? `${data.results.irr.toFixed(2)}%` : 'N/A'],
    ['Monthly Cash Flow', `$${data.results.monthlyCashFlow.toLocaleString()}`],
    ['Annual Cash Flow', `$${data.results.annualCashFlow.toLocaleString()}`],
    [''],
    ['INVESTMENT SUMMARY'],
    ['Total Cash Invested', `$${data.results.totalCashInvested.toLocaleString()}`],
    ['Loan Amount', `$${data.results.loanAmount.toLocaleString()}`],
    ['Monthly Mortgage Payment', `$${data.results.monthlyMortgagePayment.toLocaleString()}`],
  ];

  const modelData = [
    ['FINANCIAL MODEL'],
    [''],
    ['PURCHASE & FINANCING'],
    ['Purchase Price', data.inputs.purchasePrice],
    ['Closing Costs', data.inputs.closingCosts],
    ['Down Payment %', `${data.inputs.downPaymentPercent}%`],
    ['Down Payment $', data.inputs.purchasePrice * data.inputs.downPaymentPercent / 100],
    ['Loan Amount', data.results.loanAmount],
    ['Interest Rate', `${data.inputs.interestRate}%`],
    ['Amortization (Years)', data.inputs.amortizationYears],
    ['Loan Term (Years)', data.inputs.loanTermYears],
    [''],
    ['INCOME'],
    ['Monthly Rent', data.inputs.monthlyRent],
    ['Annual Gross Rent', data.inputs.monthlyRent * 12],
    ['Vacancy Rate', `${data.inputs.vacancyPercent}%`],
    ['Vacancy Loss', data.inputs.monthlyRent * 12 * data.inputs.vacancyPercent / 100],
    ['Effective Gross Income', data.results.effectiveMonthlyIncome * 12],
    [''],
    ['OPERATING EXPENSES (Annual)'],
    ['Property Tax', data.inputs.propertyTax],
    ['Insurance', data.inputs.insurance],
    ['Utilities', data.inputs.utilities * 12],
    ['Maintenance', data.results.expenseBreakdown.maintenance * 12],
    ['Property Management', data.results.expenseBreakdown.management * 12],
    ['CapEx Reserve', data.results.expenseBreakdown.capexReserve * 12],
    ['Other Expenses', data.inputs.otherExpenses],
    ['Total Operating Expenses', data.results.monthlyExpenses * 12],
    [''],
    ['CASH FLOW ANALYSIS'],
    ['Net Operating Income (NOI)', data.results.annualNoi],
    ['Annual Debt Service', data.results.monthlyMortgagePayment * 12],
    ['Annual Cash Flow', data.results.annualCashFlow],
    ['Monthly Cash Flow', data.results.monthlyCashFlow],
    [''],
    ['ASSUMPTIONS'],
    ['Rent Growth Rate', `${data.inputs.rentGrowthPercent}%`],
    ['Expense Inflation', `${data.inputs.expenseInflationPercent}%`],
    ['Appreciation Rate', `${data.inputs.appreciationPercent}%`],
    ['Holding Period', `${data.inputs.holdingPeriodYears} years`],
    ['Selling Costs', `${data.inputs.sellingCostsPercent}%`],
  ];

  const projectionsData = [
    ['YEARLY PROJECTIONS'],
    [''],
    ['Year', 'Property Value', 'Equity', 'Cash Flow', 'Cumulative Cash Flow', 'Loan Balance'],
    ...data.results.yearlyProjections.map(p => [
      p.year,
      p.propertyValue,
      p.equity,
      p.cashFlow,
      p.cumulativeCashFlow,
      p.loanBalance,
    ]),
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Summary!A1', values: summaryData },
        { range: 'Financial Model!A1', values: modelData },
        { range: 'Projections!A1', values: projectionsData },
      ],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 16 },
                backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 2, endRowIndex: 3 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 12 },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 7, endRowIndex: 8 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 12 },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 15, endRowIndex: 16 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 12 },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 200 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 150 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 200 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 150 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
            properties: { pixelSize: 150 },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });

  return spreadsheetUrl;
}
