import { searchDdfListings } from "./creaDdf";
import { storage } from "./storage";
import { CMHC_CITY_RENTS, CMHC_PROVINCIAL_RENTS } from "../shared/cmhcRents";
import type { InsertDdfListingSnapshot, InsertCityYieldHistory } from "@shared/schema";

const PROVINCE_TO_ABBREV: Record<string, string> = {
  "Ontario": "ON", "British Columbia": "BC", "Quebec": "QC", "Alberta": "AB",
  "Manitoba": "MB", "Saskatchewan": "SK", "Nova Scotia": "NS", "New Brunswick": "NB",
  "Prince Edward Island": "PE",
};

const CRAWL_PROVINCES = [
  "Ontario", "British Columbia", "Alberta", "Saskatchewan",
  "Nova Scotia", "New Brunswick", "Prince Edward Island", "Manitoba",
];

function estimateRent(listing: any, city: string, province: string) {
  if (listing.TotalActualRent && listing.TotalActualRent > 0) return { rent: listing.TotalActualRent, source: "ddf_actual" };
  const beds = listing.BedroomsTotal || 1;
  const units = listing.NumberOfUnitsTotal || 1;
  const cmhc = (CMHC_CITY_RENTS as any)[city];
  if (cmhc) {
    const perUnit = beds >= 3 ? (cmhc.threeBed || cmhc.twoBed * 1.15) : beds >= 2 ? cmhc.twoBed : cmhc.oneBed;
    return { rent: perUnit * units, source: "cmhc_city" };
  }
  const prov = CMHC_PROVINCIAL_RENTS[province] || CMHC_PROVINCIAL_RENTS[PROVINCE_TO_ABBREV[province] || ""];
  if (prov) {
    const perUnit = beds >= 3 ? prov.threeBed : beds >= 2 ? prov.twoBed : prov.oneBed;
    return { rent: perUnit * units, source: "cmhc_province" };
  }
  return { rent: (beds >= 3 ? 1800 : beds >= 2 ? 1500 : 1200) * units, source: "default" };
}

function calcYield(price: number, monthlyRent: number, tax = 0, assocFee = 0) {
  if (!price || price <= 0) return { grossYield: 0, netYield: 0, estimatedExpenses: 0, estimatedNoi: 0 };
  const annual = monthlyRent * 12;
  const gross = (annual / price) * 100;
  const expenses = tax + assocFee * 12 + price * 0.003 + annual * 0.05 + annual * 0.05 + annual * 0.08;
  const noi = annual - expenses;
  return {
    grossYield: Math.round(gross * 100) / 100,
    netYield: Math.round((noi / price) * 10000) / 100,
    estimatedExpenses: Math.round(expenses),
    estimatedNoi: Math.round(noi),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

async function crawlProvince(province: string, month: string): Promise<number> {
  const abbrev = PROVINCE_TO_ABBREV[province];
  let totalStored = 0;
  const allSnapshots: InsertDdfListingSnapshot[] = [];

  for (let page = 0; page < 2000; page++) {
    try {
      const result = await searchDdfListings({
        stateOrProvince: province,
        excludeBusinessSales: true,
        excludeParking: true,
        top: 100,
        skip: page * 100,
      });

      if (!result.listings || result.listings.length === 0) {
        console.log(`  ${province}: no more listings at page ${page}`);
        break;
      }

      const snapshots: InsertDdfListingSnapshot[] = [];
      for (const l of result.listings) {
        if (!l.ListPrice || l.ListPrice <= 0) continue;
        const city = l.City || "Unknown";
        const { rent, source } = estimateRent(l, city, province);
        const { grossYield, netYield, estimatedExpenses, estimatedNoi } = calcYield(
          l.ListPrice, rent, l.TaxAnnualAmount || 0, l.AssociationFee || 0
        );
        const dom = l.OriginalEntryTimestamp
          ? Math.floor((Date.now() - new Date(l.OriginalEntryTimestamp).getTime()) / 86400000)
          : null;

        const snap: InsertDdfListingSnapshot = {
          listingKey: l.ListingKey,
          mlsNumber: l.ListingId || null,
          city,
          province: abbrev,
          postalCode: l.PostalCode || null,
          listPrice: l.ListPrice,
          bedroomsTotal: l.BedroomsTotal || null,
          bathroomsTotal: l.BathroomsTotalInteger || null,
          numberOfUnits: l.NumberOfUnitsTotal || null,
          livingArea: l.LivingArea || null,
          yearBuilt: l.YearBuilt || null,
          propertySubType: l.PropertySubType || null,
          structureType: l.StructureType || null,
          latitude: l.Latitude || null,
          longitude: l.Longitude || null,
          totalActualRent: l.TotalActualRent || null,
          taxAnnualAmount: l.TaxAnnualAmount || null,
          associationFee: l.AssociationFee || null,
          estimatedMonthlyRent: rent,
          grossYield,
          estimatedExpenses,
          estimatedNoi,
          netYield,
          daysOnMarket: dom,
          rentSource: source,
          rawJson: {
            streetAddress: l.UnparsedAddress,
            photosCount: l.PhotosCount,
          },
          snapshotMonth: month,
        };
        snapshots.push(snap);
        allSnapshots.push(snap);
      }

      if (snapshots.length > 0) {
        await storage.insertDdfListingSnapshotsBatch(snapshots);
        totalStored += snapshots.length;
      }

      if (page % 50 === 0 || page < 5) {
        console.log(`  ${province} page ${page}: ${totalStored} stored (API total: ${result.count})`);
      }

      if (result.rawPageSize < 100) break;
      await new Promise(r => setTimeout(r, 200));
    } catch (error: any) {
      console.error(`  ${province} page ${page} ERROR: ${error.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  const citiesMap = new Map<string, InsertDdfListingSnapshot[]>();
  for (const s of allSnapshots) {
    const c = s.city || "Unknown";
    if (!citiesMap.has(c)) citiesMap.set(c, []);
    citiesMap.get(c)!.push(s);
  }

  let citiesWithYield = 0;
  for (const [cityName, citySnaps] of citiesMap) {
    if (citySnaps.length < 5) continue;
    const grossYields = citySnaps.map(s => s.grossYield).filter((v): v is number => v != null && v > 0 && v < 20);
    const netYields = citySnaps.map(s => s.netYield).filter((v): v is number => v != null && v > -10 && v < 15);
    const prices = citySnaps.map(s => s.listPrice).filter((v): v is number => v != null && v > 0);
    const rents = citySnaps.map(s => s.estimatedMonthlyRent).filter((v): v is number => v != null && v > 0);
    const doms = citySnaps.map(s => s.daysOnMarket).filter((v): v is number => v != null);
    const beds = citySnaps.map(s => s.bedroomsTotal).filter((v): v is number => v != null);

    await storage.upsertCityYieldHistory({
      city: cityName,
      province: abbrev,
      month,
      listingCount: citySnaps.length,
      avgGrossYield: avg(grossYields) != null ? Math.round(avg(grossYields)! * 100) / 100 : null,
      medianGrossYield: median(grossYields) != null ? Math.round(median(grossYields)! * 100) / 100 : null,
      avgNetYield: avg(netYields) != null ? Math.round(avg(netYields)! * 100) / 100 : null,
      avgListPrice: avg(prices) != null ? Math.round(avg(prices)!) : null,
      medianListPrice: median(prices) != null ? Math.round(median(prices)!) : null,
      avgRentPerUnit: avg(rents) != null ? Math.round(avg(rents)!) : null,
      avgDaysOnMarket: avg(doms) != null ? Math.round(avg(doms)! * 10) / 10 : null,
      avgPricePerSqft: null,
      inventoryCount: citySnaps.length,
      avgBedsPerListing: avg(beds) != null ? Math.round(avg(beds)! * 10) / 10 : null,
      yieldTrend: null,
    });
    citiesWithYield++;
  }

  console.log(`  ${province} DONE: ${totalStored} listings, ${citiesMap.size} cities found, ${citiesWithYield} with yield data`);
  return totalStored;
}

async function main() {
  const month = "2026-03";
  console.log(`=== FULL DDF CRAWL START: ${new Date().toISOString()} ===`);
  console.log(`Target month: ${month}`);
  console.log(`Provinces: ${CRAWL_PROVINCES.join(", ")}`);

  let grandTotal = 0;
  for (const prov of CRAWL_PROVINCES) {
    console.log(`\n--- Starting ${prov} ---`);
    const count = await crawlProvince(prov, month);
    grandTotal += count;
    console.log(`Running total: ${grandTotal}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== CRAWL COMPLETE: ${grandTotal} total listings at ${new Date().toISOString()} ===`);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
