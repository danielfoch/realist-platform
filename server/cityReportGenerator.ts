import { storage } from "./storage";
import { db } from "./db";
import { blogPosts } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { CMHC_CITY_RENTS, CMHC_PROVINCIAL_RENTS } from "@shared/cmhcRents";

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario", BC: "British Columbia", QC: "Quebec", AB: "Alberta",
  MB: "Manitoba", SK: "Saskatchewan", NS: "Nova Scotia", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", PE: "Prince Edward Island",
};

const TOP_30_CITIES = [
  { city: "Toronto", province: "ON", rank: 1 },
  { city: "Montreal", province: "QC", rank: 2 },
  { city: "Vancouver", province: "BC", rank: 3 },
  { city: "Calgary", province: "AB", rank: 4 },
  { city: "Edmonton", province: "AB", rank: 5 },
  { city: "Ottawa", province: "ON", rank: 6 },
  { city: "Winnipeg", province: "MB", rank: 7 },
  { city: "Mississauga", province: "ON", rank: 8 },
  { city: "Brampton", province: "ON", rank: 9 },
  { city: "Hamilton", province: "ON", rank: 10 },
  { city: "Surrey", province: "BC", rank: 11 },
  { city: "Quebec City", province: "QC", rank: 12 },
  { city: "Halifax", province: "NS", rank: 13 },
  { city: "London", province: "ON", rank: 14 },
  { city: "Kitchener", province: "ON", rank: 15 },
  { city: "Victoria", province: "BC", rank: 16 },
  { city: "Windsor", province: "ON", rank: 17 },
  { city: "Oshawa", province: "ON", rank: 18 },
  { city: "Gatineau", province: "QC", rank: 19 },
  { city: "Burnaby", province: "BC", rank: 20 },
  { city: "Saskatoon", province: "SK", rank: 21 },
  { city: "Barrie", province: "ON", rank: 22 },
  { city: "Regina", province: "SK", rank: 23 },
  { city: "St. Catharines", province: "ON", rank: 24 },
  { city: "Kelowna", province: "BC", rank: 25 },
  { city: "Guelph", province: "ON", rank: 26 },
  { city: "Kingston", province: "ON", rank: 27 },
  { city: "Sudbury", province: "ON", rank: 28 },
  { city: "Moncton", province: "NB", rank: 29 },
  { city: "Fredericton", province: "NB", rank: 30 },
];

function getCityScheduleForMonth(year: number, month: number): { city: string; province: string; rank: number; dayOfMonth: number }[] {
  const daysInMonth = new Date(year, month, 0).getDate();

  if (daysInMonth < 30) {
    const citiesToUse = TOP_30_CITIES.slice(0, 28);
    return citiesToUse.map((c, i) => ({ ...c, dayOfMonth: i + 1 }));
  }

  if (daysInMonth === 30) {
    return TOP_30_CITIES.map((c, i) => ({ ...c, dayOfMonth: i + 1 }));
  }

  const skipDay = 16;
  const schedule: { city: string; province: string; rank: number; dayOfMonth: number }[] = [];
  let cityIndex = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (day === skipDay) continue;
    if (cityIndex < TOP_30_CITIES.length) {
      schedule.push({ ...TOP_30_CITIES[cityIndex], dayOfMonth: day });
      cityIndex++;
    }
  }
  return schedule;
}

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return "N/A";
  return n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return "$" + Math.round(n).toLocaleString("en-CA");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return fmt(n) + "%";
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-CA", { month: "long" });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getYieldAssessment(grossYield: number | null | undefined): string {
  if (grossYield == null) return "insufficient data to assess";
  if (grossYield >= 7) return "strong yield territory for cash-flowing investments";
  if (grossYield >= 5) return "moderate yield range with value-add potential";
  if (grossYield >= 3.5) return "typical for appreciation-focused strategies";
  return "low-yield — primarily an appreciation play";
}

function getAffordabilityLevel(avgPrice: number | null | undefined): string {
  if (avgPrice == null) return "";
  if (avgPrice >= 1000000) return "premium";
  if (avgPrice >= 600000) return "mid-range";
  if (avgPrice >= 350000) return "affordable";
  return "highly affordable";
}

function getMarketCharacter(city: string, province: string, yieldData: any, cmhcRents: any): string {
  const traits: string[] = [];
  if (yieldData?.avgGrossYield >= 6) traits.push("high-yield cash flow market");
  else if (yieldData?.avgGrossYield >= 4.5) traits.push("balanced growth-and-income market");
  else if (yieldData?.avgGrossYield) traits.push("appreciation-driven market");
  if (yieldData?.avgListPrice && yieldData.avgListPrice < 400000) traits.push("one of the most affordable investment markets in Canada");
  if (yieldData?.avgListPrice && yieldData.avgListPrice > 800000) traits.push("a premium market favouring well-capitalized investors");
  if (yieldData?.avgDaysOnMarket && yieldData.avgDaysOnMarket < 25) traits.push("fast-moving with strong demand");
  if (yieldData?.avgDaysOnMarket && yieldData.avgDaysOnMarket > 60) traits.push("buyer-friendly with extended negotiation windows");
  if (cmhcRents?.twoBed >= 2000) traits.push("a strong rental demand hub");
  if (["ON", "BC"].includes(province) && yieldData?.avgListPrice < 500000) traits.push("an emerging value pocket within " + PROVINCE_NAMES[province]);
  return traits.length > 0 ? traits.join(", ") : "a developing market worth monitoring";
}

function generateSeoSummary(params: {
  city: string; province: string; provinceName: string; monthName: string; year: number;
  yieldData: any; cmhcRents: any; rank: number;
}): string {
  const { city, province, provinceName, monthName, year, yieldData, cmhcRents, rank } = params;
  const hasYield = yieldData && yieldData.listingCount > 0;
  const character = getMarketCharacter(city, province, yieldData, cmhcRents);
  const sections: string[] = [];

  sections.push(`<h2>Is ${city} a Good Real Estate Investment Market in ${year}?</h2>`);

  if (hasYield) {
    const yieldLevel = yieldData.avgGrossYield >= 6 ? "above-average for Canadian markets" : yieldData.avgGrossYield >= 4 ? "competitive among mid-tier Canadian cities" : "below-average for income-focused strategies";
    sections.push(`<p>${city} is currently ${character}. With a gross rental yield of <strong>${fmtPct(yieldData.avgGrossYield)}</strong> — ${yieldLevel} — ${city} ${yieldData.avgGrossYield >= 5 ? "ranks among the best real estate investment markets in Canada for income-focused investors" : "appeals primarily to investors seeking long-term capital appreciation"}. The median listing price of ${fmtDollar(yieldData.medianListPrice)} ${yieldData.avgListPrice < 500000 ? "makes it accessible for first-time investors and BRRR strategists" : yieldData.avgListPrice > 800000 ? "positions it as a premium market requiring significant capital or creative financing" : "places it in the mid-range for Canadian investment properties"}.</p>`);

    if (yieldData.avgDaysOnMarket) {
      const dom = yieldData.avgDaysOnMarket;
      sections.push(`<p>Properties in ${city} spend an average of <strong>${fmt(dom, 0)} days on market</strong> before selling. ${dom < 20 ? "This is an extremely competitive seller's market — investors need pre-approved financing and fast due diligence to secure deals." : dom < 40 ? "The market moves at a healthy pace, giving investors reasonable time to conduct due diligence while still reflecting strong demand." : "The extended days on market create opportunities for negotiation, conditional offers, and below-asking purchases — ideal conditions for value investors."}</p>`);
    }
  } else {
    sections.push(`<p>${city}, ${provinceName} is ${character}. As Canada's #${rank} largest metropolitan area, it draws consistent investor interest. This ${monthName} ${year} edition tracks the metrics that matter for anyone evaluating ${city} as a place to buy rental property in Canada.</p>`);
  }

  if (cmhcRents) {
    const rentContext = cmhcRents.twoBed >= 2000
      ? `strong rental rates that support positive cash flow on moderately leveraged properties`
      : cmhcRents.twoBed >= 1400
      ? `solid mid-market rents that can pencil out with conservative underwriting`
      : `lower rents that favour investors who can acquire properties below market value through distress deals or vendor take-back financing`;
    sections.push(`<p>On the rental side, ${city} features ${rentContext}. A typical 2-bedroom unit rents for approximately <strong>${fmtDollar(cmhcRents.twoBed)}/month</strong> according to CMHC benchmarks — a critical input for any buy-and-hold analysis.</p>`);
  }

  if (hasYield) {
    const buyerProfiles: string[] = [];
    if (yieldData.avgGrossYield >= 6) {
      buyerProfiles.push("cash flow investors looking for rental income in Canada");
      buyerProfiles.push("out-of-province buyers seeking higher yields than Toronto or Vancouver");
    }
    if (yieldData.avgListPrice < 500000) {
      buyerProfiles.push("first-time real estate investors starting with smaller capital");
      buyerProfiles.push("BRRR investors targeting forced appreciation through renovation");
    }
    if (yieldData.avgGrossYield >= 4 && yieldData.avgGrossYield < 6) {
      buyerProfiles.push("balanced investors seeking both growth and income");
    }
    if (yieldData.avgListPrice >= 800000) {
      buyerProfiles.push("equity-rich investors repositioning capital from primary markets");
      buyerProfiles.push("developers and land assemblers targeting rezoning upside");
    }
    buyerProfiles.push(`anyone comparing the best cities to invest in real estate in ${provinceName}`);

    sections.push(`
      <h3>Who Should Invest in ${city} Real Estate?</h3>
      <p>Based on the current ${monthName} ${year} data, ${city} is particularly well-suited for:</p>
      <ul>${buyerProfiles.map(b => `<li style="margin-bottom:6px;">${b.charAt(0).toUpperCase() + b.slice(1)}</li>`).join("")}</ul>
    `);
  }

  const comparisons: string[] = [];
  if (hasYield) {
    if (city !== "Toronto" && province === "ON") comparisons.push(`Compared to Toronto, ${city} offers ${yieldData.avgListPrice < 800000 ? "significantly more affordable entry points" : "similar pricing but different fundamentals"}.`);
    if (city !== "Vancouver" && province === "BC") comparisons.push(`While Vancouver commands premium prices, ${city} provides ${yieldData.avgGrossYield > 4 ? "better yields" : "a different risk-reward profile"} for BC investors.`);
    if (!["ON", "BC"].includes(province)) comparisons.push(`As an alternative to Ontario and BC, ${city} represents a growing segment of Canadian investors looking beyond traditional gateway markets for stronger returns.`);
  }
  if (comparisons.length > 0) {
    sections.push(`<h3>How ${city} Compares to Other Canadian Markets</h3><p>${comparisons.join(" ")}</p>`);
    sections.push(`<p>For a detailed city-vs-city comparison including yield maps and historical trends, visit the <a href="/insights/market-report">Monthly Market Report</a> dashboard on Realist.ca.</p>`);
  }

  return sections.join("\n");
}

function generateReportHtml(params: {
  city: string;
  province: string;
  provinceName: string;
  monthName: string;
  year: number;
  yieldData: any;
  prevYieldData: any;
  marketSnapshot: any;
  cmhcRents: { bachelor: number; oneBed: number; twoBed: number; threeBed: number } | null;
}): string {
  const { city, province, provinceName, monthName, year, yieldData, prevYieldData, marketSnapshot, cmhcRents } = params;
  const hasYield = yieldData && yieldData.listingCount > 0;
  const hasMarket = marketSnapshot && marketSnapshot.dealCount > 0;
  const hasPrev = prevYieldData && prevYieldData.listingCount > 0;

  let yieldTrendNote = "";
  if (hasYield && hasPrev && prevYieldData.avgGrossYield) {
    const diff = yieldData.avgGrossYield - prevYieldData.avgGrossYield;
    if (Math.abs(diff) > 0.1) {
      yieldTrendNote = diff > 0
        ? `Gross yields are <strong>up ${fmt(Math.abs(diff))} percentage points</strong> compared to last month, suggesting improving investor returns.`
        : `Gross yields are <strong>down ${fmt(Math.abs(diff))} percentage points</strong> from last month, indicating tighter margins.`;
    } else {
      yieldTrendNote = "Yields have remained <strong>stable</strong> month-over-month.";
    }
  }

  let priceTrendNote = "";
  if (hasYield && hasPrev && prevYieldData.avgListPrice) {
    const priceDiff = ((yieldData.avgListPrice - prevYieldData.avgListPrice) / prevYieldData.avgListPrice) * 100;
    if (Math.abs(priceDiff) > 1) {
      priceTrendNote = priceDiff > 0
        ? `Average listing prices have increased ${fmt(Math.abs(priceDiff))}% month-over-month.`
        : `Average listing prices have decreased ${fmt(Math.abs(priceDiff))}% month-over-month.`;
    }
  }

  const sections: string[] = [];

  sections.push(`
    <h2>Market Overview</h2>
    <p>${city}, ${provinceName} is Canada's #${params.yieldData?.rank || ""} largest market by population. This ${monthName} ${year} report aggregates live MLS listing data from the CREA DDF feed, CMHC rent benchmarks, and community-sourced deal analysis from the Realist.ca platform.</p>
    ${hasYield ? `<p>We analyzed <strong>${yieldData.listingCount} active investment-grade listings</strong> in ${city} this month.</p>` : `<p>DDF listing data for ${city} is currently being collected. Check back soon for updated yield metrics.</p>`}
  `);

  if (hasYield) {
    sections.push(`
      <h2>Investment Yields</h2>
      <p>${city} is currently in ${getYieldAssessment(yieldData.avgGrossYield)} with an average gross yield of <strong>${fmtPct(yieldData.avgGrossYield)}</strong> and a net yield of <strong>${fmtPct(yieldData.avgNetYield)}</strong>.</p>
      ${yieldTrendNote ? `<p>${yieldTrendNote}</p>` : ""}
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Metric</th>
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Value</th>
            ${hasPrev ? `<th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Previous Month</th>` : ""}
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Gross Yield</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtPct(yieldData.avgGrossYield)}</td>${hasPrev ? `<td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmtPct(prevYieldData.avgGrossYield)}</td>` : ""}</tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Median Gross Yield</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtPct(yieldData.medianGrossYield)}</td>${hasPrev ? `<td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmtPct(prevYieldData.medianGrossYield)}</td>` : ""}</tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Net Yield</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtPct(yieldData.avgNetYield)}</td>${hasPrev ? `<td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${fmtPct(prevYieldData.avgNetYield)}</td>` : ""}</tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Active Listings</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${yieldData.listingCount}</td>${hasPrev ? `<td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">${prevYieldData.listingCount}</td>` : ""}</tr>
        </tbody>
      </table>
    `);

    sections.push(`
      <h2>Pricing & Inventory</h2>
      ${priceTrendNote ? `<p>${priceTrendNote}</p>` : ""}
      <p>The ${getAffordabilityLevel(yieldData.avgListPrice)} ${city} market has an average listing price of <strong>${fmtDollar(yieldData.avgListPrice)}</strong> (median: ${fmtDollar(yieldData.medianListPrice)})${yieldData.avgPricePerSqft ? `, with an average price per square foot of <strong>${fmtDollar(yieldData.avgPricePerSqft)}/sqft</strong>` : ""}.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Metric</th>
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Average List Price</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(yieldData.avgListPrice)}</td></tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Median List Price</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(yieldData.medianListPrice)}</td></tr>
          ${yieldData.avgPricePerSqft ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Price/Sqft</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(yieldData.avgPricePerSqft)}</td></tr>` : ""}
          ${yieldData.avgDaysOnMarket ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Days on Market</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(yieldData.avgDaysOnMarket, 0)} days</td></tr>` : ""}
          ${yieldData.avgBedsPerListing ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Bedrooms/Listing</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(yieldData.avgBedsPerListing)}</td></tr>` : ""}
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Rent/Unit (Est.)</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(yieldData.avgRentPerUnit)}/mo</td></tr>
        </tbody>
      </table>
    `);
  }

  if (cmhcRents) {
    sections.push(`
      <h2>CMHC Rent Benchmarks</h2>
      <p>Official CMHC average rents for ${city} provide the baseline for yield calculations and rent gap analysis:</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Unit Type</th>
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Avg Monthly Rent</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Bachelor</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(cmhcRents.bachelor)}/mo</td></tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">1 Bedroom</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(cmhcRents.oneBed)}/mo</td></tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">2 Bedroom</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(cmhcRents.twoBed)}/mo</td></tr>
          <tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">3 Bedroom</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(cmhcRents.threeBed)}/mo</td></tr>
        </tbody>
      </table>
    `);
  }

  if (hasMarket) {
    sections.push(`
      <h2>Community Deal Analysis</h2>
      <p>Based on <strong>${marketSnapshot.dealCount} deals analyzed</strong> by the Realist.ca investor community in ${city}:</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Metric</th>
            <th style="padding:10px 12px; border-bottom:2px solid #e2e8f0;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${marketSnapshot.avgCapRate != null ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Cap Rate</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtPct(marketSnapshot.avgCapRate)}</td></tr>` : ""}
          ${marketSnapshot.avgCashOnCash != null ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Cash-on-Cash Return</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtPct(marketSnapshot.avgCashOnCash)}</td></tr>` : ""}
          ${marketSnapshot.avgDscr != null ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg DSCR</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmt(marketSnapshot.avgDscr, 2)}x</td></tr>` : ""}
          ${marketSnapshot.avgPurchasePrice != null ? `<tr><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0;">Avg Purchase Price</td><td style="padding:8px 12px; border-bottom:1px solid #e2e8f0; font-weight:600;">${fmtDollar(marketSnapshot.avgPurchasePrice)}</td></tr>` : ""}
        </tbody>
      </table>
    `);
  }

  const strategies: string[] = [];
  if (hasYield) {
    if (yieldData.avgGrossYield >= 6) strategies.push("Buy & Hold with strong cash flow potential");
    if (yieldData.avgGrossYield >= 4 && yieldData.avgListPrice < 500000) strategies.push("BRRR strategy where renovation adds forced equity");
    if (yieldData.avgDaysOnMarket && yieldData.avgDaysOnMarket < 30) strategies.push("Flip strategy given rapid market absorption");
    if (yieldData.avgRentPerUnit && yieldData.avgRentPerUnit > 1500) strategies.push("Airbnb/short-term rental where permitted");
    if (yieldData.avgBedsPerListing && yieldData.avgBedsPerListing >= 3) strategies.push("Multiplex conversion or suite addition");
  }
  if (strategies.length === 0) {
    strategies.push("Research current zoning for secondary suite potential");
    strategies.push("Compare with surrounding markets for relative value");
  }

  sections.push(`
    <h2>Investment Strategy Considerations</h2>
    <p>Based on the current data, investors looking at ${city} should consider:</p>
    <ul>
      ${strategies.map(s => `<li style="margin-bottom:8px;">${s}</li>`).join("")}
    </ul>
    <p>Use the <a href="/tools/analyzer">Realist.ca Deal Analyzer</a> to run detailed underwriting on any ${city} property, including multi-year projections, stress testing, and strategy comparison.</p>
  `);

  const rank = params.yieldData?.rank || TOP_30_CITIES.findIndex(c => c.city === city) + 1 || 15;
  sections.push(generateSeoSummary({
    city, province, provinceName, monthName, year,
    yieldData: hasYield ? yieldData : null, cmhcRents, rank,
  }));

  sections.push(`
    <h2>Methodology</h2>
    <p>This report is generated using data from the following sources:</p>
    <ul>
      <li><strong>CREA DDF</strong> — Live MLS listing data including prices, property details, and days on market</li>
      <li><strong>CMHC</strong> — Canada Mortgage and Housing Corporation average rent benchmarks by city and unit type</li>
      <li><strong>Realist.ca Community</strong> — Aggregated deal analysis metrics from the investor community</li>
    </ul>
    <p>Net yields are calculated using standardized expense assumptions: 5% vacancy, 8% property management, 5% maintenance, and 0.3% insurance rate. Actual returns may vary based on property-specific conditions.</p>
  `);

  sections.push(`
    <h2>Past Reports & Related Resources</h2>
    <p>This report is part of the Realist.ca Monthly Market Report series covering 30 Canadian cities. Browse the full archive of past reports in the <a href="/insights/blog">Blog &amp; Research</a> section, or explore the interactive <a href="/insights/market-report">Market Report Dashboard</a> for city-by-city comparisons.</p>
    <p>Related tools: <a href="/tools/analyzer">Deal Analyzer</a> · <a href="/tools/distress-deals">Distress Deals Browser</a> · <a href="/insights/distress-report">Monthly Distress Report</a> · <a href="/tools/cap-rates">Cap Rates Explorer</a></p>
  `);

  return sections.join("\n");
}

function generateExcerpt(city: string, province: string, monthName: string, year: number, yieldData: any): string {
  const provinceName = PROVINCE_NAMES[province] || province;
  if (yieldData && yieldData.avgGrossYield) {
    return `Is ${city} a good place to invest in real estate? ${monthName} ${year} report: ${fmtPct(yieldData.avgGrossYield)} gross yield, ${fmtPct(yieldData.avgNetYield)} net yield, ${yieldData.listingCount} listings analyzed. Complete ${city}, ${provinceName} investment analysis with CMHC rents, pricing trends, and strategy recommendations for Canadian real estate investors.`;
  }
  return `${monthName} ${year} real estate investment report for ${city}, ${provinceName}. Comprehensive market analysis including pricing, CMHC rent benchmarks, and investment strategy considerations for buying rental property in ${city}.`;
}

export async function generateCityReport(city: string, province: string, month: string): Promise<{ created: boolean; slug: string; message: string }> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthName = getMonthName(monthNum);
  const provinceName = PROVINCE_NAMES[province] || province;

  const slug = slugify(`${city}-${province}-real-estate-investment-report-${monthName}-${year}`);

  const existingPost = await storage.getBlogPostBySlug(slug);
  if (existingPost) {
    return { created: false, slug, message: `Report already exists for ${city} - ${monthName} ${year}` };
  }

  const [yieldResults, marketSnapshots] = await Promise.all([
    storage.getCityYieldHistory(city, province),
    storage.getMarketSnapshots(city, province),
  ]);

  const yieldData = yieldResults.find(y => y.month === month);
  const prevMonth = monthNum === 1 ? `${year - 1}-12` : `${year}-${String(monthNum - 1).padStart(2, "0")}`;
  const prevYieldData = yieldResults.find(y => y.month === prevMonth);

  const marketSnapshot = marketSnapshots.find(s => s.month === month) || marketSnapshots[marketSnapshots.length - 1];

  const cmhcRents = CMHC_CITY_RENTS[city] || null;

  const title = `${city}, ${province} Real Estate Investment Report — ${monthName} ${year}`;
  const content = generateReportHtml({
    city, province, provinceName, monthName, year,
    yieldData: yieldData ? { ...yieldData, rank: TOP_30_CITIES.find(c => c.city === city)?.rank } : null,
    prevYieldData, marketSnapshot, cmhcRents,
  });

  const excerpt = generateExcerpt(city, province, monthName, year, yieldData);
  const wordCount = content.replace(/<[^>]*>/g, " ").split(/\s+/).length;
  const readTimeMinutes = Math.max(3, Math.ceil(wordCount / 200));

  const tags = [city, provinceName, "Investment Report", "Market Analysis", monthName + " " + year, "Rental Yield", "Buy and Hold"];
  if (yieldData?.avgGrossYield && yieldData.avgGrossYield >= 5) tags.push("High Yield");
  if (yieldData?.avgListPrice && yieldData.avgListPrice < 500000) tags.push("Affordable Market");
  if (yieldData?.avgGrossYield && yieldData.avgGrossYield >= 4) tags.push("Cash Flow");

  await storage.createBlogPost({
    title,
    slug,
    excerpt,
    content,
    authorName: "Realist Research",
    category: "market-analysis",
    tags,
    status: "published",
    metaTitle: `${city} Real Estate Investment Report ${monthName} ${year} — Yields, Rents & Analysis | Realist.ca`,
    metaDescription: excerpt.length <= 160 ? excerpt : excerpt.substring(0, excerpt.lastIndexOf(".", 157) + 1) || excerpt.substring(0, 157) + "...",
    readTimeMinutes,
    publishedAt: new Date(),
  });

  return { created: true, slug, message: `Published report for ${city}, ${province} — ${monthName} ${year}` };
}

export async function runDailyCityReport(): Promise<{ action: string; details: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`;

  const schedule = getCityScheduleForMonth(year, month);
  const todayEntry = schedule.find(s => s.dayOfMonth === dayOfMonth);

  if (!todayEntry) {
    return { action: "skipped", details: `Day ${dayOfMonth} is a skip day this month (${new Date(year, month - 1, 1).toLocaleString("en-CA", { month: "long" })} has ${new Date(year, month, 0).getDate()} days)` };
  }

  try {
    const result = await generateCityReport(todayEntry.city, todayEntry.province, currentMonth);
    if (result.created) {
      console.log(`[city-report] Published: ${result.message}`);
      return { action: "published", details: result.message };
    } else {
      return { action: "exists", details: result.message };
    }
  } catch (error: any) {
    console.error(`[city-report] Failed for ${todayEntry.city}:`, error);
    return { action: "failed", details: `Error generating report for ${todayEntry.city}: ${error.message}` };
  }
}

export { TOP_30_CITIES, getCityScheduleForMonth };
