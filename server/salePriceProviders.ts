export interface SalePriceLookupListing {
  listingKey: string;
  mlsNumber?: string | null;
  board?: string | null;
  province?: string | null;
}

export interface SalePriceLookupResult {
  status: "resolved" | "unavailable" | "not_allowed" | "error";
  actualSalePriceCents?: number;
  soldDate?: Date;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  confidence?: number;
  errorMessage?: string;
}

export interface SalePriceProvider {
  name: string;
  isEnabled(): boolean;
  supports(listing: SalePriceLookupListing): boolean;
  lookupSoldPrice(listing: SalePriceLookupListing): Promise<SalePriceLookupResult>;
}

export class TrrebPropTxVowProvider implements SalePriceProvider {
  name = "trreb_proptx_vow";

  isEnabled(): boolean {
    return process.env.ENABLE_TRREB_PROPTX_VOW_PROVIDER === "true"
      && Boolean(process.env.TRREB_PROPTX_API_BASE_URL)
      && Boolean(process.env.TRREB_PROPTX_CLIENT_ID)
      && Boolean(process.env.TRREB_PROPTX_CLIENT_SECRET);
  }

  supports(listing: SalePriceLookupListing): boolean {
    const province = listing.province?.toUpperCase();
    const board = listing.board?.toUpperCase() || "";
    return province === "ON" && (board.includes("TRREB") || board.includes("TORONTO"));
  }

  async lookupSoldPrice(_listing: SalePriceLookupListing): Promise<SalePriceLookupResult> {
    return {
      status: "not_allowed",
      sourceType: "trreb_proptx_vow",
      sourceName: "TRREB/PropTx VOW",
      errorMessage: "Provider adapter is configured as an authorization boundary; API integration must be completed under valid data rights.",
    };
  }
}

export class HouseSigmaAuthorizedProvider implements SalePriceProvider {
  name = "housesigma_authorized";

  isEnabled(): boolean {
    return process.env.ENABLE_HOUSESIGMA_AUTHORIZED_PROVIDER === "true"
      && Boolean(process.env.HOUSESIGMA_AUTHORIZED_API_KEY);
  }

  supports(_listing: SalePriceLookupListing): boolean {
    return this.isEnabled();
  }

  async lookupSoldPrice(_listing: SalePriceLookupListing): Promise<SalePriceLookupResult> {
    return {
      status: "not_allowed",
      sourceType: "housesigma_authorized",
      sourceName: "HouseSigma Authorized",
      errorMessage: "HouseSigma scraping is prohibited; this adapter only works with explicit authorized API/data access.",
    };
  }
}

export class ManualAdminProvider implements SalePriceProvider {
  name = "manual_admin";

  isEnabled(): boolean {
    return true;
  }

  supports(_listing: SalePriceLookupListing): boolean {
    return true;
  }

  async lookupSoldPrice(_listing: SalePriceLookupListing): Promise<SalePriceLookupResult> {
    return {
      status: "unavailable",
      sourceType: "manual_admin",
      sourceName: "Manual admin",
    };
  }
}

export function getSalePriceProviders(): SalePriceProvider[] {
  return [
    new TrrebPropTxVowProvider(),
    new HouseSigmaAuthorizedProvider(),
    new ManualAdminProvider(),
  ];
}
