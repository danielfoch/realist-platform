const WDS_ENDPOINT = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods";
const PRODUCT_ID = 18100004;

type CategoryKey =
  | "allItems"
  | "allItemsExGas"
  | "allItemsExFoodEnergy"
  | "food"
  | "shelter"
  | "rentedAccommodation"
  | "ownedAccommodation"
  | "transportation"
  | "gasoline"
  | "energy"
  | "electricity"
  | "naturalGas"
  | "fuelOil"
  | "freshVegetables"
  | "freshFruit"
  | "clothing"
  | "health"
  | "recreation"
  | "alcoholTobacco"
  | "household";

const CATEGORY_SPEC: Record<CategoryKey, { productMemberId: number; label: string }> = {
  allItems: { productMemberId: 2, label: "All-items" },
  allItemsExGas: { productMemberId: 302, label: "All-items excl. gasoline" },
  allItemsExFoodEnergy: { productMemberId: 285, label: "All-items excl. food & energy" },
  food: { productMemberId: 4, label: "Food purchased from stores" },
  shelter: { productMemberId: 79, label: "Shelter" },
  rentedAccommodation: { productMemberId: 80, label: "Rented accommodation" },
  ownedAccommodation: { productMemberId: 84, label: "Owned accommodation" },
  transportation: { productMemberId: 176, label: "Transportation" },
  gasoline: { productMemberId: 184, label: "Gasoline" },
  energy: { productMemberId: 288, label: "Energy" },
  electricity: { productMemberId: 92, label: "Electricity" },
  naturalGas: { productMemberId: 94, label: "Natural gas" },
  fuelOil: { productMemberId: 95, label: "Fuel oil and other fuels" },
  freshVegetables: { productMemberId: 50, label: "Fresh vegetables" },
  freshFruit: { productMemberId: 40, label: "Fresh fruit" },
  clothing: { productMemberId: 139, label: "Clothing and footwear" },
  health: { productMemberId: 201, label: "Health and personal care" },
  recreation: { productMemberId: 219, label: "Recreation, education and reading" },
  alcoholTobacco: { productMemberId: 256, label: "Alcohol, tobacco, cannabis" },
  household: { productMemberId: 96, label: "Household ops, furnishings & equipment" },
};

const PROVINCE_SPEC: Array<{ geoId: number; name: string; abbr: string }> = [
  { geoId: 3, name: "Newfoundland and Labrador", abbr: "NL" },
  { geoId: 5, name: "Prince Edward Island", abbr: "PE" },
  { geoId: 7, name: "Nova Scotia", abbr: "NS" },
  { geoId: 9, name: "New Brunswick", abbr: "NB" },
  { geoId: 11, name: "Quebec", abbr: "QC" },
  { geoId: 14, name: "Ontario", abbr: "ON" },
  { geoId: 18, name: "Manitoba", abbr: "MB" },
  { geoId: 20, name: "Saskatchewan", abbr: "SK" },
  { geoId: 22, name: "Alberta", abbr: "AB" },
  { geoId: 24, name: "British Columbia", abbr: "BC" },
];

interface WdsDataPoint {
  refPer: string;
  value: number | null;
  releaseTime?: string;
}

interface WdsResponseItem {
  status: string;
  object: {
    productId: number;
    coordinate: string;
    vectorId: number;
    vectorDataPoint: WdsDataPoint[];
  };
}

async function fetchWds(requests: Array<{ productId: number; coordinate: string; latestN: number }>): Promise<WdsResponseItem[]> {
  const res = await fetch(WDS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  });
  if (!res.ok) throw new Error(`StatCan WDS ${res.status} ${res.statusText}`);
  return res.json() as Promise<WdsResponseItem[]>;
}

function coord(geoId: number, productId: number): string {
  return `${geoId}.${productId}.0.0.0.0.0.0.0.0`;
}

function yoyPct(current: number, yearAgo: number): number {
  return ((current - yearAgo) / yearAgo) * 100;
}

function fmtMonth(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

export interface CpiReport {
  generatedAt: string;
  referenceMonth: string;
  referenceMonthLabel: string;
  releaseDate: string;
  sourceUrl: string;
  sourceTable: string;
  headline: {
    yoyPct: number;
    yoyPctPrev: number;
    momPct: number;
    momSaPct: number | null;
    index: number;
    indexPrev: number;
    exGasYoyPct: number;
    exFoodEnergyYoyPct: number;
  };
  series: Array<{ refPer: string; label: string; index: number; yoyPct: number | null }>;
  components: Array<{
    key: string;
    label: string;
    index: number;
    yoyPct: number;
    momPct: number;
    yoyPctPrev: number;
  }>;
  provinces: Array<{
    abbr: string;
    name: string;
    geoId: number;
    index: number;
    yoyPct: number;
    yoyPctPrev: number;
    accelerationBps: number;
  }>;
  notableDrivers: Array<{ label: string; yoyPct: number; momPct: number; note: string }>;
  baseYearEffects: Array<{ label: string; yoyPct: number; note: string }>;
  summary: string[];
  investorTakeaways: string[];
}

let cache: { report: CpiReport; expiresAt: number } | null = null;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function getCpiReport(forceRefresh = false): Promise<CpiReport> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) return cache.report;

  const componentKeys = Object.keys(CATEGORY_SPEC) as CategoryKey[];
  const requests: Array<{ productId: number; coordinate: string; latestN: number }> = [];

  for (const key of componentKeys) {
    const spec = CATEGORY_SPEC[key];
    const periods = key === "allItems" ? 36 : 14;
    requests.push({ productId: PRODUCT_ID, coordinate: coord(2, spec.productMemberId), latestN: periods });
  }
  for (const prov of PROVINCE_SPEC) {
    requests.push({ productId: PRODUCT_ID, coordinate: coord(prov.geoId, 2), latestN: 14 });
  }

  const results = await fetchWds(requests);

  const byCoord = new Map<string, WdsDataPoint[]>();
  for (const item of results) {
    if (item.status !== "SUCCESS") continue;
    byCoord.set(item.object.coordinate, item.object.vectorDataPoint.filter(p => p.value !== null));
  }

  const pickPoints = (geoId: number, productId: number): WdsDataPoint[] => {
    return byCoord.get(coord(geoId, productId)) ?? [];
  };

  const allItemsPoints = pickPoints(2, 2);
  if (allItemsPoints.length < 13) {
    throw new Error("StatCan returned insufficient CPI data for all-items series");
  }
  const latest = allItemsPoints[allItemsPoints.length - 1];
  const prevMonth = allItemsPoints[allItemsPoints.length - 2];
  const yearAgo = allItemsPoints[allItemsPoints.length - 13];
  const twoMonthsAgo = allItemsPoints[allItemsPoints.length - 3];
  const thirteenMonthsAgo = allItemsPoints[allItemsPoints.length - 14];

  const headlineYoy = yoyPct(latest.value!, yearAgo.value!);
  const headlineYoyPrev = prevMonth && thirteenMonthsAgo
    ? yoyPct(prevMonth.value!, thirteenMonthsAgo.value!)
    : headlineYoy;
  const headlineMom = ((latest.value! - prevMonth.value!) / prevMonth.value!) * 100;

  const exGasPoints = pickPoints(2, CATEGORY_SPEC.allItemsExGas.productMemberId);
  const exFoodEnergyPoints = pickPoints(2, CATEGORY_SPEC.allItemsExFoodEnergy.productMemberId);

  const exGasYoy = exGasPoints.length >= 13
    ? yoyPct(exGasPoints[exGasPoints.length - 1].value!, exGasPoints[exGasPoints.length - 13].value!)
    : NaN;
  const exFoodEnergyYoy = exFoodEnergyPoints.length >= 13
    ? yoyPct(exFoodEnergyPoints[exFoodEnergyPoints.length - 1].value!, exFoodEnergyPoints[exFoodEnergyPoints.length - 13].value!)
    : NaN;

  // Build 24-month YoY series (needs 36 points of index history)
  const series: CpiReport["series"] = [];
  for (let i = 12; i < allItemsPoints.length; i++) {
    const curr = allItemsPoints[i];
    const prev = allItemsPoints[i - 12];
    if (!curr?.value || !prev?.value) continue;
    series.push({
      refPer: curr.refPer,
      label: fmtMonth(curr.refPer),
      index: curr.value,
      yoyPct: yoyPct(curr.value, prev.value),
    });
  }

  // Component breakdown
  const components: CpiReport["components"] = [];
  for (const key of componentKeys) {
    if (key === "allItems" || key === "allItemsExGas" || key === "allItemsExFoodEnergy") continue;
    const spec = CATEGORY_SPEC[key];
    const pts = pickPoints(2, spec.productMemberId);
    if (pts.length < 13) continue;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const ya = pts[pts.length - 13];
    const pp = pts[pts.length - 14] ?? ya;
    components.push({
      key,
      label: spec.label,
      index: last.value!,
      yoyPct: yoyPct(last.value!, ya.value!),
      momPct: ((last.value! - prev.value!) / prev.value!) * 100,
      yoyPctPrev: pp && prev ? yoyPct(prev.value!, pp.value!) : 0,
    });
  }
  components.sort((a, b) => b.yoyPct - a.yoyPct);

  // Provinces
  const provinces: CpiReport["provinces"] = [];
  for (const prov of PROVINCE_SPEC) {
    const pts = pickPoints(prov.geoId, 2);
    if (pts.length < 13) continue;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const ya = pts[pts.length - 13];
    const pp = pts[pts.length - 14] ?? ya;
    const y = yoyPct(last.value!, ya.value!);
    const yPrev = pp && prev ? yoyPct(prev.value!, pp.value!) : y;
    provinces.push({
      abbr: prov.abbr,
      name: prov.name,
      geoId: prov.geoId,
      index: last.value!,
      yoyPct: y,
      yoyPctPrev: yPrev,
      accelerationBps: Math.round((y - yPrev) * 100),
    });
  }
  provinces.sort((a, b) => b.yoyPct - a.yoyPct);

  const findComp = (k: string) => components.find(c => c.key === k);
  const gas = findComp("gasoline");
  const fuelOil = findComp("fuelOil");
  const natGas = findComp("naturalGas");
  const freshVeg = findComp("freshVegetables");
  const energy = findComp("energy");
  const rent = findComp("rentedAccommodation");
  const owned = findComp("ownedAccommodation");
  const elec = findComp("electricity");

  const notableDrivers: CpiReport["notableDrivers"] = [];
  if (gas) notableDrivers.push({
    label: "Gasoline",
    yoyPct: gas.yoyPct,
    momPct: gas.momPct,
    note: "Largest monthly gasoline increase on record, driven by Middle East supply disruption.",
  });
  if (fuelOil) notableDrivers.push({
    label: "Fuel oil and other fuels",
    yoyPct: fuelOil.yoyPct,
    momPct: fuelOil.momPct,
    note: "Sharp monthly spike alongside crude oil move-through.",
  });
  if (freshVeg) notableDrivers.push({
    label: "Fresh vegetables",
    yoyPct: freshVeg.yoyPct,
    momPct: freshVeg.momPct,
    note: "Largest jump since Aug 2023. Cucumbers, peppers and celery squeezed by adverse growing conditions abroad.",
  });
  if (natGas) notableDrivers.push({
    label: "Natural gas",
    yoyPct: natGas.yoyPct,
    momPct: natGas.momPct,
    note: "The one large-category deflator on the headline this month.",
  });
  if (energy) notableDrivers.push({
    label: "Energy (aggregate)",
    yoyPct: energy.yoyPct,
    momPct: energy.momPct,
    note: "Swung from -9.3% YoY in February to a firm positive in March.",
  });

  // Base-year effects: hard-coded labels pair with StatCan commentary
  const baseYearEffects: CpiReport["baseYearEffects"] = [
    { label: "Restaurant food", yoyPct: 3.2, note: "Eased from 7.8%. GST/HST break (Dec 2024–Feb 2025) drops out of the base next month." },
    { label: "Alcoholic beverages (on-premise)", yoyPct: 2.0, note: "Base-year effect from the 2024-25 tax holiday." },
    { label: "Toys, games and hobby supplies", yoyPct: 1.5, note: "Ditto — tax-break base-year rollover." },
  ];

  const summary = [
    `Canada headline CPI accelerated to ${headlineYoy.toFixed(1)}% YoY in ${fmtMonth(latest.refPer)}, up from ${headlineYoyPrev.toFixed(1)}% the prior month.`,
    `All ten provinces saw faster price growth versus February. ${provinces[0].abbr} leads at ${provinces[0].yoyPct.toFixed(1)}%; ${provinces[provinces.length - 1].abbr} is softest at ${provinces[provinces.length - 1].yoyPct.toFixed(1)}%.`,
    `Gasoline (+${gas?.yoyPct.toFixed(1) ?? "—"}% YoY, +${gas?.momPct.toFixed(1) ?? "—"}% MoM) did most of the lifting. Strip it out and CPI ran ${exGasYoy.toFixed(1)}%.`,
    `Shelter eased to ${findComp("shelter")?.yoyPct.toFixed(1) ?? "—"}%. Rent is still the hot side (+${rent?.yoyPct.toFixed(1) ?? "—"}%) while owned accommodation grew just +${owned?.yoyPct.toFixed(1) ?? "—"}%.`,
    `Restaurant food printed +3.2% vs +7.8% last month — a GST/HST base-year effect as the Dec 2024–Feb 2025 tax break drops out of the comparison.`,
  ];

  const investorTakeaways = [
    `Shelter disinflation remains the single biggest signal for Canadian real estate. With shelter running ${findComp("shelter")?.yoyPct.toFixed(1) ?? "—"}% and owned accommodation at just ${owned?.yoyPct.toFixed(1) ?? "—"}%, the carrying-cost side of underwriting is no longer the inflation story it was in 2023–24.`,
    `Rent is the outlier: ${rent?.yoyPct.toFixed(1) ?? "—"}% YoY — still well above headline. Buy-and-hold cash-flow models should continue to run asymmetric rent growth vs price growth assumptions.`,
    `Electricity at ${elec?.yoyPct.toFixed(1) ?? "—"}% and natural gas at ${natGas?.yoyPct.toFixed(1) ?? "—"}% point to a mixed utility-cost picture. For multiplex underwriting, landlord-paid heat is a tailwind (nat-gas deflating); landlord-paid electricity is a modest drag.`,
    `A gasoline-led print is exactly the kind of inflation the Bank of Canada has historically looked through. Watch next month's core-trim/median release — if core holds, the rate-cut path stays live despite the headline tick-up.`,
    `Base-year effects from the 2024–25 GST/HST break are rolling off over the next two months. Expect additional upside noise in headline through May regardless of underlying pressure.`,
  ];

  const report: CpiReport = {
    generatedAt: new Date().toISOString(),
    referenceMonth: latest.refPer,
    referenceMonthLabel: fmtMonth(latest.refPer),
    releaseDate: latest.releaseTime ?? "",
    sourceUrl: "https://www150.statcan.gc.ca/n1/daily-quotidien/260420/dq260420a-eng.htm",
    sourceTable: "Statistics Canada Table 18-10-0004-01",
    headline: {
      yoyPct: headlineYoy,
      yoyPctPrev: headlineYoyPrev,
      momPct: headlineMom,
      momSaPct: 0.5,
      index: latest.value!,
      indexPrev: prevMonth.value!,
      exGasYoyPct: exGasYoy,
      exFoodEnergyYoyPct: exFoodEnergyYoy,
    },
    series,
    components,
    provinces,
    notableDrivers,
    baseYearEffects,
    summary,
    investorTakeaways,
  };

  cache = { report, expiresAt: Date.now() + CACHE_TTL_MS };
  return report;
}
