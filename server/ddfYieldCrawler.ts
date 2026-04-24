import { searchDdfListings, isDdfConfigured } from "./creaDdf";
import { storage } from "./storage";
import { db } from "./db";
import { ddfListingSnapshots, type InsertDdfListingSnapshot, type InsertCityYieldHistory, type InsertAreaYieldHistory } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { CMHC_PROVINCIAL_RENTS, CMHC_CITY_RENTS, type CmhcRentData as CmhcRentEntry } from "@shared/cmhcRents";
import {
  queueDdfListingChangeNotifications,
  queueDdfListingRemovedNotifications,
  queueSavedSearchMatchNotificationsForDdf,
} from "./notifications";

const PROVINCE_TO_ABBREV: Record<string, string> = {
  "Ontario": "ON",
  "British Columbia": "BC",
  "Quebec": "QC",
  "Alberta": "AB",
  "Manitoba": "MB",
  "Saskatchewan": "SK",
  "Nova Scotia": "NS",
  "New Brunswick": "NB",
  "Prince Edward Island": "PE",
};

const CRAWL_PROVINCES = [
  "Ontario",
  "British Columbia",
  "Quebec",
  "Alberta",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Prince Edward Island",
];

interface CmhcRentData {
  [city: string]: { oneBed: number; twoBed: number; threeBed?: number };
}

async function getCmhcRents(): Promise<CmhcRentData> {
  return CMHC_CITY_RENTS as unknown as CmhcRentData;
}

function estimateMonthlyRent(
  listing: any,
  cmhcRents: CmhcRentData,
  city: string,
  province: string,
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

  const provRents = CMHC_PROVINCIAL_RENTS[province] || CMHC_PROVINCIAL_RENTS[PROVINCE_TO_ABBREV[province] || ""];
  if (provRents) {
    let perUnit: number;
    if (beds >= 3) {
      perUnit = provRents.threeBed;
    } else if (beds >= 2) {
      perUnit = provRents.twoBed;
    } else {
      perUnit = provRents.oneBed;
    }
    return { rent: perUnit * units, source: "cmhc_province" };
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

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function normalizePostalArea(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const normalized = postalCode.replace(/\s+/g, "").toUpperCase();
  return normalized.length >= 3 ? normalized.slice(0, 3) : null;
}

function aggregateYieldMetrics(snapshots: InsertDdfListingSnapshot[]) {
  const grossYields = snapshots.map(s => s.grossYield).filter((v): v is number => v != null && v > 0 && v < 20);
  const netYields = snapshots.map(s => s.netYield).filter((v): v is number => v != null && v > -10 && v < 15);
  const prices = snapshots.map(s => s.listPrice).filter((v): v is number => v != null && v > 0);
  const rents = snapshots.map(s => s.estimatedMonthlyRent).filter((v): v is number => v != null && v > 0);
  const doms = snapshots.map(s => s.daysOnMarket).filter((v): v is number => v != null);
  const beds = snapshots.map(s => s.bedroomsTotal).filter((v): v is number => v != null);
  const sqftPrices: number[] = [];

  for (const s of snapshots) {
    if (s.listPrice && s.livingArea && s.livingArea > 0) {
      sqftPrices.push(s.listPrice / s.livingArea);
    }
  }

  return {
    listingCount: snapshots.length,
    avgGrossYield: avg(grossYields) != null ? Math.round(avg(grossYields)! * 100) / 100 : null,
    medianGrossYield: median(grossYields) != null ? Math.round(median(grossYields)! * 100) / 100 : null,
    avgNetYield: avg(netYields) != null ? Math.round(avg(netYields)! * 100) / 100 : null,
    avgListPrice: avg(prices) != null ? Math.round(avg(prices)!) : null,
    medianListPrice: median(prices) != null ? Math.round(median(prices)!) : null,
    avgRentPerUnit: avg(rents) != null ? Math.round(avg(rents)!) : null,
    avgDaysOnMarket: avg(doms) != null ? Math.round(avg(doms)! * 10) / 10 : null,
    avgPricePerSqft: avg(sqftPrices) != null ? Math.round(avg(sqftPrices)! * 100) / 100 : null,
    inventoryCount: snapshots.length,
    avgBedsPerListing: avg(beds) != null ? Math.round(avg(beds)! * 10) / 10 : null,
    yieldTrend: null,
  };
}

export async function crawlDdfForProvince(
  ddfProvince: string,
  month: string,
  cmhcRents: CmhcRentData,
): Promise<InsertDdfListingSnapshot[]> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const pageSize = 100;
  const maxPages = 500;

  for (let page = 0; page < maxPages; page++) {
    try {
      const result = await searchDdfListings({
        stateOrProvince: ddfProvince,
        excludeBusinessSales: true,
        excludeParking: true,
        top: pageSize,
        skip: page * pageSize,
      });

      if (!result.listings || result.listings.length === 0) break;

      for (const listing of result.listings) {
        const listPrice = listing.ListPrice;
        if (!listPrice || listPrice <= 0) continue;

        const city = listing.City || "Unknown";
        const { rent, source } = estimateMonthlyRent(listing, cmhcRents, city, ddfProvince);
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
          city,
          province: PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince,
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

      console.log(`[ddf-crawler] ${ddfProvince} page ${page + 1}: ${result.listings.length} kept / ${result.listings.length} fetched (total so far: ${snapshots.length}, API count: ${result.count})`);

      if (result.listings.length < pageSize) break;

      await new Promise(r => setTimeout(r, 800));
    } catch (error) {
      console.error(`[ddf-crawler] Error crawling ${ddfProvince} page ${page}:`, error);
      break;
    }
  }

  return snapshots;
}

export async function crawlDdfForCity(
  city: string,
  province: string,
  month: string,
  cmhcRents: CmhcRentData,
): Promise<InsertDdfListingSnapshot[]> {
  const snapshots: InsertDdfListingSnapshot[] = [];
  const pageSize = 100;
  const maxPages = 200;

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

        const { rent, source } = estimateMonthlyRent(listing, cmhcRents, city, province);
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
          province: PROVINCE_TO_ABBREV[province] || province,
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
  return {
    city,
    province,
    month,
    ...aggregateYieldMetrics(citySnapshots),
  };
}

export async function aggregateAreaYield(
  areaType: "city" | "postal_fsa",
  areaKey: string,
  areaName: string,
  province: string,
  month: string,
  snapshots: InsertDdfListingSnapshot[],
): Promise<InsertAreaYieldHistory> {
  return {
    areaType,
    areaKey,
    areaName,
    city: areaType === "city" ? areaName : null,
    province,
    month,
    ...aggregateYieldMetrics(snapshots),
  };
}

let crawlInProgress = false;

export async function runDdfYieldCrawl(targetMonth?: string): Promise<{
  month: string;
  totalListings: number;
  citiesCrawled: number;
  provincesCompleted: number;
}> {
  if (!isDdfConfigured()) {
    console.log("[ddf-crawler] DDF credentials not configured, skipping crawl");
    return { month: "", totalListings: 0, citiesCrawled: 0, provincesCompleted: 0 };
  }

  if (crawlInProgress) {
    console.log("[ddf-crawler] Crawl already in progress, skipping");
    return { month: "", totalListings: 0, citiesCrawled: 0, provincesCompleted: 0 };
  }

  crawlInProgress = true;
  const now = new Date();
  const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`[ddf-crawler] Starting FULL yield crawl for ${month} across ${CRAWL_PROVINCES.length} provinces`);

  try {
    const cmhcRents = await getCmhcRents();
    let totalListings = 0;
    let allCities = new Set<string>();
    let provincesCompleted = 0;

    for (const ddfProvince of CRAWL_PROVINCES) {
      const shortProvince = PROVINCE_TO_ABBREV[ddfProvince] || ddfProvince;
      try {
        console.log(`[ddf-crawler] === Crawling province: ${ddfProvince} ===`);
        const provinceExistingSnapshots = await db.select().from(ddfListingSnapshots).where(and(
          eq(ddfListingSnapshots.snapshotMonth, month),
          eq(ddfListingSnapshots.province, shortProvince),
        ));
        const snapshots = await crawlDdfForProvince(ddfProvince, month, cmhcRents);

        if (snapshots.length > 0) {
          const listingKeys = Array.from(new Set(snapshots.map((snapshot) => snapshot.listingKey)));
          const listingKeySet = new Set(listingKeys);
          const existingSnapshots = listingKeys.length
            ? await db.select().from(ddfListingSnapshots).where(and(
              eq(ddfListingSnapshots.snapshotMonth, month),
              inArray(ddfListingSnapshots.listingKey, listingKeys),
            ))
            : [];
          const existingByKey = new Map(existingSnapshots.map((snapshot) => [snapshot.listingKey, snapshot]));
          const newSnapshots = snapshots.filter((snapshot) => !existingByKey.has(snapshot.listingKey));

          const batchSize = 500;
          let inserted = 0;
          for (let i = 0; i < snapshots.length; i += batchSize) {
            const batch = snapshots.slice(i, i + batchSize);
            inserted += await storage.insertDdfListingSnapshotsBatch(batch);
          }
          totalListings += inserted;
          console.log(`[ddf-crawler] ${ddfProvince}: ${inserted} listings stored`);

          const currentSnapshots = listingKeys.length
            ? await db.select().from(ddfListingSnapshots).where(and(
              eq(ddfListingSnapshots.snapshotMonth, month),
              inArray(ddfListingSnapshots.listingKey, listingKeys),
            ))
            : [];
          const changedSnapshots = currentSnapshots.flatMap((snapshot) => {
            const previous = existingByKey.get(snapshot.listingKey);
            if (!previous) return [];
            const previousStatus = String((previous.rawJson as Record<string, unknown> | undefined)?.StandardStatus || "");
            const currentStatus = String((snapshot.rawJson as Record<string, unknown> | undefined)?.StandardStatus || "");
            if (previous.listPrice === snapshot.listPrice && previousStatus === currentStatus) return [];
            return [{ previous, current: snapshot }];
          });
          const missingSnapshots = provinceExistingSnapshots.filter((snapshot) => !listingKeySet.has(snapshot.listingKey));

          await Promise.all([
            queueSavedSearchMatchNotificationsForDdf(newSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} saved-search notifications error:`, error);
            }),
            queueDdfListingChangeNotifications(changedSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} listing-change notifications error:`, error);
            }),
            queueDdfListingRemovedNotifications(missingSnapshots).catch((error) => {
              console.error(`[ddf-crawler] ${ddfProvince} listing-removal notifications error:`, error);
            }),
          ]);

          const citiesInProvince = new Map<string, InsertDdfListingSnapshot[]>();
          for (const s of snapshots) {
            const cityName = s.city || "Unknown";
            if (!citiesInProvince.has(cityName)) {
              citiesInProvince.set(cityName, []);
            }
            citiesInProvince.get(cityName)!.push(s);
          }

          const minListingsForYield = 5;
          for (const [cityName, citySnapshots] of Array.from(citiesInProvince.entries())) {
            if (citySnapshots.length >= minListingsForYield) {
              const yieldData = await aggregateCityYield(cityName, shortProvince, month, citySnapshots);
              await storage.upsertCityYieldHistory(yieldData);
              await storage.upsertAreaYieldHistory(
                await aggregateAreaYield("city", cityName.toLowerCase(), cityName, shortProvince, month, citySnapshots)
              );
              allCities.add(cityName);
            }
          }

          const postalAreas = new Map<string, InsertDdfListingSnapshot[]>();
          for (const snapshot of snapshots) {
            const postalArea = normalizePostalArea(snapshot.postalCode);
            if (!postalArea) continue;
            if (!postalAreas.has(postalArea)) postalAreas.set(postalArea, []);
            postalAreas.get(postalArea)!.push(snapshot);
          }

          for (const [postalArea, postalSnapshots] of Array.from(postalAreas.entries())) {
            if (postalSnapshots.length < minListingsForYield) continue;
            const sampleCity = postalSnapshots[0]?.city || postalArea;
            await storage.upsertAreaYieldHistory(
              await aggregateAreaYield(
                "postal_fsa",
                postalArea,
                `${postalArea} · ${sampleCity}`,
                shortProvince,
                month,
                postalSnapshots,
              )
            );
          }
          console.log(`[ddf-crawler] ${ddfProvince}: yield data for ${citiesInProvince.size} cities (${Array.from(citiesInProvince.entries()).filter(([_, s]) => s.length >= minListingsForYield).length} with 5+ listings)`);
        } else {
          console.log(`[ddf-crawler] ${ddfProvince}: no listings found`);
        }

        provincesCompleted++;
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.error(`[ddf-crawler] Failed to crawl province ${ddfProvince}:`, error);
      }
    }

    console.log(`[ddf-crawler] FULL crawl complete: ${totalListings} listings across ${allCities.size} cities in ${provincesCompleted} provinces`);
    return { month, totalListings, citiesCrawled: allCities.size, provincesCompleted };
  } finally {
    crawlInProgress = false;
  }
}
