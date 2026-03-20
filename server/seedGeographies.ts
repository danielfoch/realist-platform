import { storage } from "./storage";
import { CMHC_CITY_RENTS } from "@shared/cmhcRents";
import type { InsertGeography, InsertMetric } from "@shared/schema";

const CITY_PROVINCES: Record<string, string> = {
  "Vancouver": "BC", "Burnaby": "BC", "Surrey": "BC", "Richmond": "BC",
  "Coquitlam": "BC", "Langley": "BC", "New Westminster": "BC",
  "North Vancouver": "BC", "West Vancouver": "BC", "Victoria": "BC",
  "Kelowna": "BC", "Nanaimo": "BC", "Kamloops": "BC", "Abbotsford": "BC",
  "Chilliwack": "BC", "Prince George": "BC",
  "Calgary": "AB", "Edmonton": "AB", "Red Deer": "AB", "Lethbridge": "AB",
  "Medicine Hat": "AB", "Grande Prairie": "AB", "Fort McMurray": "AB",
  "Airdrie": "AB", "Cochrane": "AB",
  "Saskatoon": "SK", "Regina": "SK",
  "Winnipeg": "MB", "Brandon": "MB",
  "Toronto": "ON", "Ottawa": "ON", "Mississauga": "ON", "Brampton": "ON",
  "Hamilton": "ON", "London": "ON", "Kitchener": "ON", "Waterloo": "ON",
  "Windsor": "ON", "Oshawa": "ON", "Barrie": "ON", "Kingston": "ON",
  "Guelph": "ON", "Cambridge": "ON", "Thunder Bay": "ON", "Sudbury": "ON",
  "St. Catharines": "ON", "Niagara Falls": "ON", "Brantford": "ON",
  "Peterborough": "ON", "Belleville": "ON",
  "Burlington": "ON", "Oakville": "ON", "Markham": "ON",
  "Richmond Hill": "ON", "Vaughan": "ON", "Whitby": "ON", "Ajax": "ON",
  "Pickering": "ON", "Milton": "ON", "Georgetown": "ON",
  "Montreal": "QC", "Quebec City": "QC", "Laval": "QC", "Gatineau": "QC",
  "Longueuil": "QC", "Sherbrooke": "QC", "Trois-Rivières": "QC",
  "Halifax": "NS", "Dartmouth": "NS",
  "Saint John": "NB", "Moncton": "NB", "Fredericton": "NB",
  "Charlottetown": "PE",
  "St. John's": "NL",
};

const VACANCY_RATES: Record<string, number> = {
  "Vancouver": 0.9, "Victoria": 1.0, "Kelowna": 1.5, "Toronto": 1.4,
  "Ottawa": 2.5, "Montreal": 2.3, "Calgary": 2.8, "Edmonton": 4.1,
  "Halifax": 1.0, "Winnipeg": 3.2, "Saskatoon": 4.5, "Regina": 5.0,
  "Hamilton": 2.0, "Kitchener": 1.8, "London": 2.2, "Windsor": 3.0,
  "St. John's": 5.5, "Moncton": 2.8, "Charlottetown": 1.5,
  "Quebec City": 2.0, "Gatineau": 2.4, "Kingston": 1.2, "Barrie": 1.8,
  "Guelph": 1.4, "Surrey": 1.1, "Burnaby": 0.8, "Mississauga": 1.6,
  "Brampton": 1.8, "Markham": 1.5, "Richmond Hill": 1.6,
};

const MEDIAN_INCOMES: Record<string, number> = {
  "Vancouver": 85000, "Victoria": 78000, "Kelowna": 72000, "Toronto": 84000,
  "Ottawa": 95000, "Montreal": 62000, "Calgary": 98000, "Edmonton": 92000,
  "Halifax": 68000, "Winnipeg": 70000, "Saskatoon": 82000, "Regina": 85000,
  "Hamilton": 75000, "Kitchener": 80000, "London": 68000, "Windsor": 62000,
  "St. John's": 72000, "Moncton": 60000, "Charlottetown": 58000,
  "Quebec City": 70000, "Gatineau": 82000, "Kingston": 72000, "Barrie": 76000,
  "Guelph": 82000, "Surrey": 82000, "Burnaby": 78000, "Mississauga": 80000,
  "Brampton": 78000, "Markham": 88000, "Richmond Hill": 90000,
};

function computeInvestorScore(rent: number, vacancy: number, income: number): number {
  const rentScore = Math.min(30, (rent / 3000) * 30);
  const vacancyScore = vacancy < 1 ? 25 : vacancy < 2 ? 22 : vacancy < 3 ? 18 : vacancy < 5 ? 12 : 5;
  const affordabilityScore = income > 90000 ? 25 : income > 75000 ? 20 : income > 60000 ? 15 : 10;
  const yieldEstimate = ((rent * 12) / (income * 6)) * 100;
  const yieldScore = Math.min(20, yieldEstimate * 4);
  return Math.min(100, Math.round(rentScore + vacancyScore + affordabilityScore + yieldScore));
}

export async function seedGeographies() {
  const existing = await storage.getGeographies();
  const existingNames = new Set(existing.map((g) => g.name));

  console.log(`[seed-geographies] Checking for new geographies (${existing.length} existing)...`);

  const geosCreated: { id: string; city: string }[] = [];
  const months = [
    "2020-01", "2020-06", "2021-01", "2021-06",
    "2022-01", "2022-06", "2023-01", "2023-06",
    "2024-01", "2024-06", "2025-01", "2025-06", "2026-01",
  ];

  for (const [city, rents] of Object.entries(CMHC_CITY_RENTS)) {
    const province = CITY_PROVINCES[city];
    if (!province) continue;
    if (existingNames.has(city)) continue;

    try {
      const geo = await storage.createGeography({
        name: city,
        type: "city",
        city,
        province,
        geometry: null,
        centroidLat: null,
        centroidLng: null,
      });
      geosCreated.push({ id: geo.id, city });

      const avgRent = Math.round((rents.oneBed + rents.twoBed) / 2);
      const vacancy = VACANCY_RATES[city] ?? 3.0;
      const income = MEDIAN_INCOMES[city] ?? 70000;
      const homeownership = 60 + Math.random() * 20;

      const metricsBatch: InsertMetric[] = [];

      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const factor = 1 + (i * 0.015) + (Math.random() - 0.5) * 0.03;
        const rentVal = Math.round(avgRent * factor);
        const vacancyVal = Math.max(0.2, vacancy + (Math.random() - 0.5) * 1.5 - (i * 0.05));
        const incomeVal = Math.round(income * (1 + i * 0.008));

        metricsBatch.push(
          { geographyId: geo.id, metricType: "rent", value: rentVal, date: month, source: "CMHC" },
          { geographyId: geo.id, metricType: "vacancy_rate", value: parseFloat(vacancyVal.toFixed(1)), date: month, source: "CMHC" },
          { geographyId: geo.id, metricType: "income", value: incomeVal, date: month, source: "StatCan" },
          { geographyId: geo.id, metricType: "homeownership_rate", value: parseFloat((homeownership + (Math.random() - 0.5) * 2).toFixed(1)), date: month, source: "StatCan" },
        );
      }

      await storage.createMetricsBatch(metricsBatch);

      const score = computeInvestorScore(avgRent, vacancy, income);
      await storage.upsertAreaScore({
        geographyId: geo.id,
        date: "2026-01",
        investorScore: score,
        livabilityScore: Math.round(40 + Math.random() * 40),
        growthScore: Math.round(30 + Math.random() * 50),
      });
    } catch (err) {
      console.error(`[seed-geographies] Error seeding ${city}:`, err);
    }
  }

  if (geosCreated.length === 0) {
    console.log(`[seed-geographies] All geographies already exist, nothing to seed`);
  } else {
    console.log(`[seed-geographies] Seeded ${geosCreated.length} new geographies with metrics`);
  }
}
