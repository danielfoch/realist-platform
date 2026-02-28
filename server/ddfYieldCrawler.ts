import { searchDdfListings, isDdfConfigured } from "./creaDdf";
import { storage } from "./storage";
import type { InsertDdfListingSnapshot, InsertCityYieldHistory } from "@shared/schema";

const CRAWL_CITIES = [
  { city: "Toronto", province: "ON" },
  { city: "Ottawa", province: "ON" },
  { city: "Hamilton", province: "ON" },
  { city: "London", province: "ON" },
  { city: "Windsor", province: "ON" },
  { city: "Kitchener", province: "ON" },
  { city: "Waterloo", province: "ON" },
  { city: "Cambridge", province: "ON" },
  { city: "Mississauga", province: "ON" },
  { city: "Brampton", province: "ON" },
  { city: "Sudbury", province: "ON" },
  { city: "Kingston", province: "ON" },
  { city: "St. Catharines", province: "ON" },
  { city: "Barrie", province: "ON" },
  { city: "Guelph", province: "ON" },
  { city: "Oshawa", province: "ON" },
  { city: "Vancouver", province: "BC" },
  { city: "Victoria", province: "BC" },
  { city: "Kelowna", province: "BC" },
  { city: "Surrey", province: "BC" },
  { city: "Burnaby", province: "BC" },
  { city: "Montreal", province: "QC" },
  { city: "Quebec City", province: "QC" },
  { city: "Gatineau", province: "QC" },
  { city: "Calgary", province: "AB" },
  { city: "Edmonton", province: "AB" },
  { city: "Winnipeg", province: "MB" },
  { city: "Saskatoon", province: "SK" },
  { city: "Regina", province: "SK" },
  { city: "Halifax", province: "NS" },
  { city: "St. John's", province: "NL" },
  { city: "Moncton", province: "NB" },
  { city: "Fredericton", province: "NB" },
  { city: "Charlottetown", province: "PE" },
];

interface CmhcRentData {
  [city: string]: { oneBed: number; twoBed: number; threeBed?: number };
}

async function getCmhcRents(): Promise<CmhcRentData> {
  const { CMHC_CITY_RENTS } = await import("@shared/cmhcRents");
  return CMHC_CITY_RENTS;
}

function estimateMonthlyRent(
  listing: any,
  cmhcRents: CmhcRentData,
  city: string,
): { rent: number; source: string } {
  if (listing.TotalActualRent && listing.TotalActualRent > 0) {
    return { rent: listing.TotalActualRent, source: "ddf_actual" };
  }

  const beds = listing.BedroomsTotal || 1;
  const units = listing.NumberOfUnitsTotal || 1;
  const cmhc = cmhcRents[city];

  if (cmhc) {
    let perUnit: number;
    if (beds >= 3) {
      perUnit = cmhc.threeBed || cmhc.twoBed * 1.15;
    } else if (beds >= 2) {
      perUnit = cmhc.twoBed;
    } else {
      perUnit = cmhc.oneBed;
    }
    return { rent: perUnit * units, source: "cmhc_city" };
  }

  const defaultRent = beds >= 3 ? 1800 : beds >= 2 ? 1500 : 1200;
  return { rent: defaultRent * units, source: "default" };
}

function calculateYield(
  listPrice: number,
  monthlyRent: number,
  taxAnnual: number = 0,
  associationFee: number = 0,
): { grossYield: number; netYield: number; estimatedExpenses: number; estimatedNoi: number } {
  if (!listPrice || listPrice <= 0) {
    return { grossYield: 0, netYield: 0, estimatedExpenses: 0, estimatedNoi: 0 };
  }

  const annualRent = monthlyRent * 12;
  const grossYield = (annualRent / listPrice) * 100;

  const annualAssocFee = associationFee * 12;
  const insurance = listPrice * 0.003;
  const maintenance = annualRent * 0.05;
  const vacancy = annualRent * 0.05;
  const management = annualRent * 0.08;
  const estimatedExpenses = taxAnnual + annualAssocFee + insurance + maintenance + vacancy + management;

  const estimatedNoi = annualRent - estimatedExpenses;
  const netYield = (estimatedNoi / listPrice) * 100;

  return {
    grossYield: Math.round(grossYield * 100) / 100,
    netYield: Math.round(netYield * 100) / 100,
    estimatedExpenses: Math.round(estimatedExpenses),
    estimatedNoi: Math.round(estimatedNoi),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function crawlDdfForCity(
  city: string,
  province: string,
  month: string,
  cmhcRents: CmhcRentData,
): Promise<InsertDdfListingSnapshot[]> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const maxPages = 10;
  const pageSize = 200;

  for (let page = 0; page < maxPages; page++) {
    try {
      const result = await searchDdfListings({
        city,
        stateOrProvince: province,
        excludeBusinessSales: true,
        excludeParking: true,
        top: pageSize,
        skip: page * pageSize,
      });

      if (!result.listings || result.listings.length === 0) break;

      for (const listing of result.listings) {
        const listPrice = listing.ListPrice;
        if (!listPrice || listPrice <= 0) continue;

        const { rent, source } = estimateMonthlyRent(listing, cmhcRents, city);
        const { grossYield, netYield, estimatedExpenses, estimatedNoi } = calculateYield(
          listPrice,
          rent,
          listing.TaxAnnualAmount || 0,
          listing.AssociationFee || 0,
        );

        const dom = listing.OriginalEntryTimestamp
          ? Math.floor((Date.now() - new Date(listing.OriginalEntryTimestamp).getTime()) / 86400000)
          : null;

        snapshots.push({
          listingKey: listing.ListingKey,
          mlsNumber: listing.ListingId || null,
          city: listing.City || city,
          province: listing.StateOrProvince || province,
          postalCode: listing.PostalCode || null,
          listPrice,
          bedroomsTotal: listing.BedroomsTotal || null,
          bathroomsTotal: listing.BathroomsTotalInteger || null,
          numberOfUnits: listing.NumberOfUnitsTotal || null,
          livingArea: listing.LivingArea || null,
          yearBuilt: listing.YearBuilt || null,
          propertySubType: listing.PropertySubType || null,
          structureType: listing.StructureType || null,
          latitude: listing.Latitude || null,
          longitude: listing.Longitude || null,
          totalActualRent: listing.TotalActualRent || null,
          taxAnnualAmount: listing.TaxAnnualAmount || null,
          associationFee: listing.AssociationFee || null,
          estimatedMonthlyRent: rent,
          grossYield,
          estimatedExpenses,
          estimatedNoi,
          netYield,
          daysOnMarket: dom,
          rentSource: source,
          rawJson: {
            publicRemarks: listing.PublicRemarks?.substring(0, 500),
            streetAddress: listing.UnparsedAddress,
            photosCount: listing.PhotosCount,
            modificationTimestamp: listing.ModificationTimestamp,
          },
          snapshotMonth: month,
        });
      }

      if (result.listings.length < pageSize) break;

      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[ddf-crawler] Error crawling ${city}, ${province} page ${page}:`, error);
      break;
    }
  }

  return snapshots;
}

export async function aggregateCityYield(
  city: string,
  province: string,
  month: string,
  snapshots: InsertDdfListingSnapshot[],
): Promise<InsertCityYieldHistory> {
  const citySnapshots = snapshots.filter(
    s => s.city?.toLowerCase() === city.toLowerCase() && s.province === province
  );

  const grossYields = citySnapshots.map(s => s.grossYield).filter((v): v is number => v != null && v > 0);
  const netYields = citySnapshots.map(s => s.netYield).filter((v): v is number => v != null);
  const prices = citySnapshots.map(s => s.listPrice).filter((v): v is number => v != null && v > 0);
  const rents = citySnapshots.map(s => s.estimatedMonthlyRent).filter((v): v is number => v != null && v > 0);
  const doms = citySnapshots.map(s => s.daysOnMarket).filter((v): v is number => v != null);
  const beds = citySnapshots.map(s => s.bedroomsTotal).filter((v): v is number => v != null);
  const sqftPrices: number[] = [];
  for (const s of citySnapshots) {
    if (s.listPrice && s.livingArea && s.livingArea > 0) {
      sqftPrices.push(s.listPrice / s.livingArea);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    city,
    province,
    month,
    listingCount: citySnapshots.length,
    avgGrossYield: avg(grossYields) != null ? Math.round(avg(grossYields)! * 100) / 100 : null,
    medianGrossYield: median(grossYields) != null ? Math.round(median(grossYields)! * 100) / 100 : null,
    avgNetYield: avg(netYields) != null ? Math.round(avg(netYields)! * 100) / 100 : null,
    avgListPrice: avg(prices) != null ? Math.round(avg(prices)!) : null,
    medianListPrice: median(prices) != null ? Math.round(median(prices)!) : null,
    avgRentPerUnit: avg(rents) != null ? Math.round(avg(rents)!) : null,
    avgDaysOnMarket: avg(doms) != null ? Math.round(avg(doms)! * 10) / 10 : null,
    avgPricePerSqft: avg(sqftPrices) != null ? Math.round(avg(sqftPrices)! * 100) / 100 : null,
    inventoryCount: citySnapshots.length,
    avgBedsPerListing: avg(beds) != null ? Math.round(avg(beds)! * 10) / 10 : null,
    yieldTrend: null,
  };
}

let crawlInProgress = false;

export async function runDdfYieldCrawl(targetMonth?: string): Promise<{
  month: string;
  totalListings: number;
  citiesCrawled: number;
}> {
  if (!isDdfConfigured()) {
    console.log("[ddf-crawler] DDF credentials not configured, skipping crawl");
    return { month: "", totalListings: 0, citiesCrawled: 0 };
  }

  if (crawlInProgress) {
    console.log("[ddf-crawler] Crawl already in progress, skipping");
    return { month: "", totalListings: 0, citiesCrawled: 0 };
  }

  crawlInProgress = true;
  const now = new Date();
  const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`[ddf-crawler] Starting yield crawl for ${month} across ${CRAWL_CITIES.length} cities`);

  try {
    const cmhcRents = await getCmhcRents();
    let totalListings = 0;
    let citiesCrawled = 0;

    for (const { city, province } of CRAWL_CITIES) {
      try {
        console.log(`[ddf-crawler] Crawling ${city}, ${province}...`);
        const snapshots = await crawlDdfForCity(city, province, month, cmhcRents);

        if (snapshots.length > 0) {
          const inserted = await storage.insertDdfListingSnapshotsBatch(snapshots);
          totalListings += inserted;
          console.log(`[ddf-crawler] ${city}: ${inserted} listings stored`);

          const yieldData = await aggregateCityYield(city, province, month, snapshots);
          await storage.upsertCityYieldHistory(yieldData);
          console.log(`[ddf-crawler] ${city}: yield history updated (avg gross: ${yieldData.avgGrossYield}%)`);
        } else {
          await storage.upsertCityYieldHistory({
            city, province, month,
            listingCount: 0,
            avgGrossYield: null, medianGrossYield: null, avgNetYield: null,
            avgListPrice: null, medianListPrice: null, avgRentPerUnit: null,
            avgDaysOnMarket: null, avgPricePerSqft: null, inventoryCount: 0,
            avgBedsPerListing: null, yieldTrend: null,
          });
          console.log(`[ddf-crawler] ${city}: no listings found, zero row stored`);
        }

        citiesCrawled++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error(`[ddf-crawler] Failed to crawl ${city}, ${province}:`, error);
      }
    }

    console.log(`[ddf-crawler] Crawl complete: ${totalListings} listings across ${citiesCrawled} cities`);
    return { month, totalListings, citiesCrawled };
  } finally {
    crawlInProgress = false;
  }
}
