// Realist Partner Network — referral terms, agreement text, and board registry.
// Single source of truth for what realtors and mortgage brokers agree to when
// they join the network. Pure module: no DB, no env, fully testable.

export const PARTNER_NETWORK_AGREEMENT_VERSION = "2026-06-12.v1";

export const NETWORK_PARTNER_TYPES = ["realtor", "mortgage_broker"] as const;
export type NetworkPartnerType = (typeof NETWORK_PARTNER_TYPES)[number];

export interface ReferralTerms {
  partnerType: NetworkPartnerType;
  partnerLabel: string;
  /** Percentage of the partner's gross compensation owed on closed/funded referred deals. */
  feePercent: number;
  payeeName: string;
  payeeCompany: string;
  /** What the fee applies to, in agreement language. */
  compensationBasis: string;
  /** Verb for a successfully executed referred deal ("closes" / "funds"). */
  successEvent: string;
  monthlyFee: 0;
}

export const REFERRAL_TERMS: Record<NetworkPartnerType, ReferralTerms> = {
  realtor: {
    partnerType: "realtor",
    partnerLabel: "Realtor",
    feePercent: 25,
    payeeName: "Valery Real Estate Inc.",
    payeeCompany: "Valery Real Estate Inc.",
    compensationBasis:
      "the gross commission earned by the Partner on any purchase, sale, or lease transaction completed with a Referred Lead",
    successEvent: "closes",
    monthlyFee: 0,
  },
  mortgage_broker: {
    partnerType: "mortgage_broker",
    partnerLabel: "Mortgage Broker",
    feePercent: 50,
    payeeName: "Nick Hill",
    payeeCompany: "BLD Financial",
    compensationBasis:
      "the gross compensation (including lender finder's fees, commissions, and volume bonuses) earned by the Partner on any mortgage transaction funded for a Referred Lead",
    successEvent: "funds",
    monthlyFee: 0,
  },
};

export function isNetworkPartnerType(value: unknown): value is NetworkPartnerType {
  return typeof value === "string" && (NETWORK_PARTNER_TYPES as readonly string[]).includes(value);
}

export function getReferralTerms(partnerType: NetworkPartnerType): ReferralTerms {
  return REFERRAL_TERMS[partnerType];
}

export function formatReferralPayee(terms: ReferralTerms): string {
  return terms.payeeName === terms.payeeCompany
    ? terms.payeeName
    : `${terms.payeeName}, ${terms.payeeCompany}`;
}

/**
 * Canadian real estate boards/associations a realtor can declare during onboarding.
 * Mortgage brokers skip the board step (they are provincially licensed instead).
 */
export const REAL_ESTATE_BOARDS = [
  "Toronto Regional Real Estate Board (TRREB)",
  "Greater Vancouver REALTORS® (REBGV)",
  "Calgary Real Estate Board (CREB)",
  "REALTORS® Association of Edmonton",
  "Ottawa Real Estate Board (OREB)",
  "Quebec Professional Association of Real Estate Brokers (QPAREB)",
  "WinnipegREALTORS®",
  "Cornerstone Association of REALTORS® (Hamilton/Waterloo)",
  "London & St. Thomas Association of REALTORS® (LSTAR)",
  "Nova Scotia Association of REALTORS® (NSAR)",
  "Victoria Real Estate Board (VREB)",
  "Saskatchewan REALTORS® Association",
  "Association of Interior REALTORS® (Okanagan)",
  "Niagara Association of REALTORS®",
  "Windsor-Essex County Association of REALTORS®",
  "Durham Region Association of REALTORS®",
  "Barrie & District Association of REALTORS®",
  "Guelph & District Association of REALTORS®",
  "Fraser Valley Real Estate Board (FVREB)",
  "Realtors Association of Hamilton-Burlington (RAHB)",
  "Other / Not listed",
] as const;

export interface AgreementInput {
  partnerType: NetworkPartnerType;
  signedName: string;
  brokerageName: string;
  marketCity: string;
  marketRegion: string;
  realEstateBoard?: string | null;
  licenseNumber?: string | null;
  /** ISO date string of signing; injected by the caller so this module stays pure. */
  signedAtIso: string;
}

export interface RenderedAgreement {
  version: string;
  title: string;
  text: string;
  terms: ReferralTerms;
}

/**
 * Render the referral agreement a partner signs during onboarding.
 * The rendered text is stored alongside the signature snapshot so the exact
 * agreed wording survives future copy changes.
 */
export function buildReferralAgreement(input: AgreementInput): RenderedAgreement {
  const terms = getReferralTerms(input.partnerType);
  const signedDate = input.signedAtIso.slice(0, 10);
  const title = `Realist Partner Network Referral Agreement — ${terms.partnerLabel}`;

  const partnerIdentity = [
    input.signedName,
    input.brokerageName ? `of ${input.brokerageName}` : null,
    input.realEstateBoard ? `member of ${input.realEstateBoard}` : null,
    input.licenseNumber ? `license #${input.licenseNumber}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const text = `${title}
Version ${PARTNER_NETWORK_AGREEMENT_VERSION} — signed ${signedDate}

This agreement is between ${partnerIdentity} (the "Partner") and ${formatReferralPayee(terms)} (the "Referring Party"), facilitated by Realist (realist.ca).

1. REFERRED LEADS. Realist will route investor leads originating from realist.ca in the Partner's claimed market of ${input.marketCity}, ${input.marketRegion} (each a "Referred Lead") to the Partner via the Realist platform, including email notifications and the Partner's Realist CRM workspace.

2. REFERRAL FEE. The Partner agrees to pay the Referring Party ${terms.feePercent}% of ${terms.compensationBasis}. The fee is due when the transaction ${terms.successEvent} and compensation is received by the Partner or the Partner's brokerage.

3. NO PLATFORM FEES. There are no monthly fees, seat fees, or subscription charges for participation in the Realist Partner Network. The referral fee in Section 2 is the only compensation owed.

4. DEAL MANAGEMENT AND REPORTING. The Partner agrees to manage Referred Leads through the Realist CRM, keep lead and deal statuses reasonably current, and, upon a successful transaction, provide documentation of the result (such as the agreement of purchase and sale, commitment letter, or trade record sheet) sufficient to calculate the referral fee.

5. CONDUCT. The Partner will respond to Referred Leads promptly, act within the rules of their licensing body and board, and not redirect Referred Leads outside the platform to avoid the referral fee.

6. TERM. Either party may terminate participation at any time. Sections 2 and 4 survive termination for any Referred Lead introduced before termination.

Signed electronically by ${input.signedName} on ${signedDate}.`;

  return { version: PARTNER_NETWORK_AGREEMENT_VERSION, title, text, terms };
}
