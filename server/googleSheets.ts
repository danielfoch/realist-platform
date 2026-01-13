// Google Sheets Integration - using Replit Connector or User OAuth tokens
import { google } from 'googleapis';

// Replit connector settings cache
let connectionSettings: any;

// Interface for user OAuth tokens
interface UserOAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

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

export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Get a Google Drive client using user's own OAuth tokens
export function getUserGoogleDriveClient(tokens: UserOAuthTokens) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
    expiry_date: tokens.expiresAt ? tokens.expiresAt.getTime() : undefined,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Get a Google Sheets client using user's own OAuth tokens
export function getUserGoogleSheetClient(tokens: UserOAuthTokens) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
    expiry_date: tokens.expiresAt ? tokens.expiresAt.getTime() : undefined,
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
      grossRent: number;
      vacancyLoss: number;
      effectiveIncome: number;
      expenses: {
        propertyTax: number;
        insurance: number;
        utilities: number;
        maintenance: number;
        management: number;
        capexReserve: number;
        other: number;
        total: number;
      };
      noi: number;
      debtService: number;
      cashFlow: number;
      propertyValue: number;
      loanBalance: number;
      equity: number;
      cumulativeCashFlow: number;
      principalPaidThisYear: number;
      cumulativePrincipalPaid: number;
      capitalAppreciation: number;
      totalReturn: number;
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

export async function exportToGoogleSheets(data: ExportData, userTokens?: UserOAuthTokens): Promise<string> {
  // Use user's own tokens if provided, otherwise fall back to Replit connector
  const sheets = userTokens 
    ? getUserGoogleSheetClient(userTokens)
    : await getUncachableGoogleSheetClient();
  
  const title = `Realist Analysis - ${data.address || 'Property'} - ${new Date().toLocaleDateString()}`;
  
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
      },
      sheets: [
        { properties: { title: 'Projections', sheetId: 0 } },
        { properties: { title: 'Inputs', sheetId: 1 } },
        { properties: { title: 'Summary', sheetId: 2 } },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId!;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl!;

  const inputsData = [
    ['Realist.ca Deal Analyzer'],
    ['Free Real Estate Investment Calculator - realist.ca'],
    [''],
    ['PROPERTY INFO'],
    ['Address', data.address || 'Not specified'],
    ['Strategy', data.strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['PURCHASE & FINANCING', '', 'EDIT VALUES'],
    ['Purchase Price', data.inputs.purchasePrice, ''],
    ['Closing Costs', data.inputs.closingCosts, ''],
    ['Down Payment %', data.inputs.downPaymentPercent / 100, ''],
    ['Interest Rate %', data.inputs.interestRate / 100, ''],
    ['Amortization (Years)', data.inputs.amortizationYears, ''],
    ['Loan Term (Years)', data.inputs.loanTermYears, ''],
    [''],
    ['INCOME'],
    ['Monthly Rent', data.inputs.monthlyRent, ''],
    ['Vacancy %', data.inputs.vacancyPercent / 100, ''],
    [''],
    ['OPERATING EXPENSES'],
    ['Property Tax (Annual)', data.inputs.propertyTax, ''],
    ['Insurance (Annual)', data.inputs.insurance, ''],
    ['Utilities (Monthly)', data.inputs.utilities, ''],
    ['Maintenance %', data.inputs.maintenancePercent / 100, ''],
    ['Management %', data.inputs.managementPercent / 100, ''],
    ['CapEx Reserve %', data.inputs.capexReservePercent / 100, ''],
    ['Other Expenses (Annual)', data.inputs.otherExpenses, ''],
    [''],
    ['GROWTH ASSUMPTIONS'],
    ['Rent Growth %', data.inputs.rentGrowthPercent / 100, ''],
    ['Expense Inflation %', data.inputs.expenseInflationPercent / 100, ''],
    ['Appreciation %', data.inputs.appreciationPercent / 100, ''],
    ['Holding Period (Years)', data.inputs.holdingPeriodYears, ''],
    ['Selling Costs %', data.inputs.sellingCostsPercent / 100, ''],
    [''],
    ['CALCULATED VALUES (Auto-updated)'],
    ['Down Payment $', '=B10*B12'],
    ['Loan Amount', '=B10-B38'],
    ['Monthly Rate', '=B13/12'],
    ['Num Payments', '=B14*12'],
    ['Monthly Mortgage Payment', '=IF(B39=0,0,PMT(B40,B41,-B39))'],
    ['Annual Debt Service', '=B42*12'],
    [''],
    ['Annual Gross Rent', '=B18*12'],
    ['Vacancy Loss', '=B45*B19'],
    ['Effective Gross Income', '=B45-B46'],
    [''],
    ['Annual Property Tax', '=B22'],
    ['Annual Insurance', '=B23'],
    ['Annual Utilities', '=B24*12'],
    ['Annual Maintenance', '=B47*B25'],
    ['Annual Management', '=B47*B26'],
    ['Annual CapEx', '=B47*B27'],
    ['Annual Other', '=B28'],
    ['Total Operating Expenses', '=SUM(B49:B55)'],
    [''],
    ['Net Operating Income (NOI)', '=B47-B56'],
    ['Annual Cash Flow', '=B58-B43'],
    ['Monthly Cash Flow', '=B59/12'],
    [''],
    ['Total Cash Invested', '=B38+B11'],
    ['Cap Rate', '=IF(B10=0,0,B58/B10)'],
    ['Cash-on-Cash Return', '=IF(B62=0,0,B59/B62)'],
    ['DSCR', '=IF(B43=0,0,B58/B43)'],
  ];

  const summaryData = [
    ['Realist.ca Deal Analyzer'],
    ['Free Real Estate Investment Calculator - realist.ca'],
    [''],
    ['INVESTMENT SUMMARY'],
    ['All values auto-calculate from Inputs tab'],
    [''],
    ['KEY METRICS'],
    ['Cap Rate', '=Inputs!B63'],
    ['Cash-on-Cash Return', '=Inputs!B64'],
    ['DSCR', '=Inputs!B65'],
    ['Monthly Cash Flow', '=Inputs!B60'],
    ['Annual Cash Flow', '=Inputs!B59'],
    ['Net Operating Income', '=Inputs!B58'],
    [''],
    ['INVESTMENT BREAKDOWN'],
    ['Purchase Price', '=Inputs!B10'],
    ['Closing Costs', '=Inputs!B11'],
    ['Down Payment', '=Inputs!B38'],
    ['Total Cash Invested', '=Inputs!B62'],
    ['Loan Amount', '=Inputs!B39'],
    ['Monthly Mortgage Payment', '=Inputs!B42'],
    [''],
    ['INCOME'],
    ['Monthly Rent', '=Inputs!B18'],
    ['Annual Gross Rent', '=Inputs!B45'],
    ['Less: Vacancy', '=Inputs!B46'],
    ['Effective Gross Income', '=Inputs!B47'],
    [''],
    ['EXPENSES'],
    ['Property Tax', '=Inputs!B49'],
    ['Insurance', '=Inputs!B50'],
    ['Utilities', '=Inputs!B51'],
    ['Maintenance', '=Inputs!B52'],
    ['Management', '=Inputs!B53'],
    ['CapEx Reserve', '=Inputs!B54'],
    ['Other', '=Inputs!B55'],
    ['Total Operating Expenses', '=Inputs!B56'],
  ];

  const projectionsData = [
    ['Realist.ca Deal Analyzer'],
    ['Free Real Estate Investment Calculator - realist.ca'],
    [''],
    ['10-YEAR CASH FLOW PROFORMA'],
    ['All values auto-calculate based on Inputs tab - change inputs to update projections'],
    [''],
    ['', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10'],
    [''],
    ['REVENUE'],
    ['Gross Rent', 
      '=Inputs!$B$45',
      '=B10*(1+Inputs!$B$31)',
      '=C10*(1+Inputs!$B$31)',
      '=D10*(1+Inputs!$B$31)',
      '=E10*(1+Inputs!$B$31)',
      '=F10*(1+Inputs!$B$31)',
      '=G10*(1+Inputs!$B$31)',
      '=H10*(1+Inputs!$B$31)',
      '=I10*(1+Inputs!$B$31)',
      '=J10*(1+Inputs!$B$31)'
    ],
    ['Less: Vacancy',
      '=-B10*Inputs!$B$19',
      '=-C10*Inputs!$B$19',
      '=-D10*Inputs!$B$19',
      '=-E10*Inputs!$B$19',
      '=-F10*Inputs!$B$19',
      '=-G10*Inputs!$B$19',
      '=-H10*Inputs!$B$19',
      '=-I10*Inputs!$B$19',
      '=-J10*Inputs!$B$19',
      '=-K10*Inputs!$B$19'
    ],
    ['Effective Income',
      '=B10+B11',
      '=C10+C11',
      '=D10+D11',
      '=E10+E11',
      '=F10+F11',
      '=G10+G11',
      '=H10+H11',
      '=I10+I11',
      '=J10+J11',
      '=K10+K11'
    ],
    [''],
    ['OPERATING EXPENSES'],
    ['Property Tax',
      '=-Inputs!$B$22',
      '=-Inputs!$B$22*(1+Inputs!$B$32)',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^2',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^3',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^4',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^5',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^6',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^7',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^8',
      '=-Inputs!$B$22*(1+Inputs!$B$32)^9'
    ],
    ['Insurance',
      '=-Inputs!$B$23',
      '=-Inputs!$B$23*(1+Inputs!$B$32)',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^2',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^3',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^4',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^5',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^6',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^7',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^8',
      '=-Inputs!$B$23*(1+Inputs!$B$32)^9'
    ],
    ['Utilities',
      '=-Inputs!$B$24*12',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^2',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^3',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^4',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^5',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^6',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^7',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^8',
      '=-Inputs!$B$24*12*(1+Inputs!$B$32)^9'
    ],
    ['Maintenance',
      '=-B12*Inputs!$B$25',
      '=-C12*Inputs!$B$25',
      '=-D12*Inputs!$B$25',
      '=-E12*Inputs!$B$25',
      '=-F12*Inputs!$B$25',
      '=-G12*Inputs!$B$25',
      '=-H12*Inputs!$B$25',
      '=-I12*Inputs!$B$25',
      '=-J12*Inputs!$B$25',
      '=-K12*Inputs!$B$25'
    ],
    ['Management',
      '=-B12*Inputs!$B$26',
      '=-C12*Inputs!$B$26',
      '=-D12*Inputs!$B$26',
      '=-E12*Inputs!$B$26',
      '=-F12*Inputs!$B$26',
      '=-G12*Inputs!$B$26',
      '=-H12*Inputs!$B$26',
      '=-I12*Inputs!$B$26',
      '=-J12*Inputs!$B$26',
      '=-K12*Inputs!$B$26'
    ],
    ['CapEx Reserve',
      '=-B12*Inputs!$B$27',
      '=-C12*Inputs!$B$27',
      '=-D12*Inputs!$B$27',
      '=-E12*Inputs!$B$27',
      '=-F12*Inputs!$B$27',
      '=-G12*Inputs!$B$27',
      '=-H12*Inputs!$B$27',
      '=-I12*Inputs!$B$27',
      '=-J12*Inputs!$B$27',
      '=-K12*Inputs!$B$27'
    ],
    ['Other',
      '=-Inputs!$B$28',
      '=-Inputs!$B$28*(1+Inputs!$B$32)',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^2',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^3',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^4',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^5',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^6',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^7',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^8',
      '=-Inputs!$B$28*(1+Inputs!$B$32)^9'
    ],
    ['Total Expenses',
      '=SUM(B15:B21)',
      '=SUM(C15:C21)',
      '=SUM(D15:D21)',
      '=SUM(E15:E21)',
      '=SUM(F15:F21)',
      '=SUM(G15:G21)',
      '=SUM(H15:H21)',
      '=SUM(I15:I21)',
      '=SUM(J15:J21)',
      '=SUM(K15:K21)'
    ],
    [''],
    ['CASH FLOW'],
    ['Net Operating Income',
      '=B12+B22',
      '=C12+C22',
      '=D12+D22',
      '=E12+E22',
      '=F12+F22',
      '=G12+G22',
      '=H12+H22',
      '=I12+I22',
      '=J12+J22',
      '=K12+K22'
    ],
    ['Less: Debt Service',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43',
      '=-Inputs!$B$43'
    ],
    ['Cash Flow',
      '=B25+B26',
      '=C25+C26',
      '=D25+D26',
      '=E25+E26',
      '=F25+F26',
      '=G25+G26',
      '=H25+H26',
      '=I25+I26',
      '=J25+J26',
      '=K25+K26'
    ],
    ['Cumulative Cash Flow',
      '=B27',
      '=B28+C27',
      '=C28+D27',
      '=D28+E27',
      '=E28+F27',
      '=F28+G27',
      '=G28+H27',
      '=H28+I27',
      '=I28+J27',
      '=J28+K27'
    ],
    [''],
    ['EQUITY & VALUE'],
    ['Property Value',
      '=Inputs!$B$10*(1+Inputs!$B$33)',
      '=Inputs!$B$10*(1+Inputs!$B$33)^2',
      '=Inputs!$B$10*(1+Inputs!$B$33)^3',
      '=Inputs!$B$10*(1+Inputs!$B$33)^4',
      '=Inputs!$B$10*(1+Inputs!$B$33)^5',
      '=Inputs!$B$10*(1+Inputs!$B$33)^6',
      '=Inputs!$B$10*(1+Inputs!$B$33)^7',
      '=Inputs!$B$10*(1+Inputs!$B$33)^8',
      '=Inputs!$B$10*(1+Inputs!$B$33)^9',
      '=Inputs!$B$10*(1+Inputs!$B$33)^10'
    ],
    ['Loan Balance',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,12,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,24,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,36,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,48,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,60,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,72,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,84,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,96,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,108,-Inputs!$B$42,Inputs!$B$39))',
      '=IF(Inputs!$B$40=0,0,FV(Inputs!$B$40,120,-Inputs!$B$42,Inputs!$B$39))'
    ],
    ['Equity',
      '=B31-B32',
      '=C31-C32',
      '=D31-D32',
      '=E31-E32',
      '=F31-F32',
      '=G31-G32',
      '=H31-H32',
      '=I31-I32',
      '=J31-J32',
      '=K31-K32'
    ],
    ['Total Return (Equity + Cash)',
      '=B33+B28',
      '=C33+C28',
      '=D33+D28',
      '=E33+E28',
      '=F33+F28',
      '=G33+G28',
      '=H33+H28',
      '=I33+I28',
      '=J33+J28',
      '=K33+K28'
    ],
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Inputs!A1', values: inputsData },
        { range: 'Summary!A1', values: summaryData },
        { range: 'Projections!A1', values: projectionsData },
      ],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Projections sheet (sheetId: 0) - branded header styling
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 18, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.13, green: 0.55, blue: 0.13 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2 },
            cell: {
              userEnteredFormat: {
                textFormat: { italic: true, fontSize: 11, foregroundColor: { red: 0.4, green: 0.4, blue: 0.4 } },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        // Inputs sheet (sheetId: 1) - branded header styling
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 18, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.13, green: 0.55, blue: 0.13 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 1, endRowIndex: 2 },
            cell: {
              userEnteredFormat: {
                textFormat: { italic: true, fontSize: 11, foregroundColor: { red: 0.4, green: 0.4, blue: 0.4 } },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 8, endRowIndex: 9 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 9, endRowIndex: 35, startColumnIndex: 1, endColumnIndex: 2 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
              },
            },
            fields: 'userEnteredFormat(backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 1, startRowIndex: 36, endRowIndex: 65 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
              },
            },
            fields: 'userEnteredFormat(backgroundColor)',
          },
        },
        // Summary sheet (sheetId: 2) - branded header styling
        {
          repeatCell: {
            range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true, fontSize: 18, foregroundColor: { red: 1, green: 1, blue: 1 } },
                backgroundColor: { red: 0.13, green: 0.55, blue: 0.13 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: 2, startRowIndex: 1, endRowIndex: 2 },
            cell: {
              userEnteredFormat: {
                textFormat: { italic: true, fontSize: 11, foregroundColor: { red: 0.4, green: 0.4, blue: 0.4 } },
              },
            },
            fields: 'userEnteredFormat(textFormat)',
          },
        },
        // Column widths
        {
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 180 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 11 },
            properties: { pixelSize: 120 },
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
            range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 200 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 150 },
            fields: 'pixelSize',
          },
        },
        {
          setBasicFilter: {
            filter: {
              range: { sheetId: 0, startRowIndex: 6, endRowIndex: 35, startColumnIndex: 0, endColumnIndex: 11 }
            }
          }
        },
      ],
    },
  });

  return spreadsheetUrl;
}
