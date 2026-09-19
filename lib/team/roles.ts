/**
 * The power team: the people an investor needs around a deal, in the order a
 * deal needs them. One list — the form, the account checklist and the CRM tags
 * all read it.
 */
export interface PowerTeamRole {
  key: string;
  label: string;
  /** What they do for an investor, in one line. */
  does: string;
  /** The moment in a deal when you want them already on the phone. */
  when: string;
}

export const POWER_TEAM_ROLES: PowerTeamRole[] = [
  {
    key: "realtor",
    label: "Investor realtor",
    does: "Pulls comps, books the one showing that matters, writes and negotiates the offer.",
    when: "Before you fall for a listing",
  },
  {
    key: "mortgage_broker",
    label: "Mortgage broker",
    does: "Pre-approval, rental-income treatment, CMHC MLI Select on five units and up.",
    when: "Before you write an offer",
  },
  {
    key: "lawyer",
    label: "Real estate lawyer",
    does: "Title, status certificates, closing — and the clauses that save a bad deal.",
    when: "The day the offer is accepted",
  },
  {
    key: "inspector",
    label: "Home inspector",
    does: "Finds the $40,000 problem while you can still walk away from it.",
    when: "Inside the condition period",
  },
  {
    key: "insurance",
    label: "Insurance broker",
    does: "Landlord and builder's-risk coverage that a lender will actually accept.",
    when: "Before conditions are waived",
  },
  {
    key: "accountant",
    label: "Accountant",
    does: "Hold it personally or in a corporation, HST on new builds, what's deductible.",
    when: "Before you decide how to hold it",
  },
  {
    key: "property_manager",
    label: "Property manager",
    does: "Leases it, keeps it full, and takes the 2 a.m. call so you don't.",
    when: "Thirty days before closing",
  },
  {
    key: "contractor",
    label: "Contractor / builder",
    does: "Prices the renovation or the build before your numbers depend on it.",
    when: "When the plan is to add value",
  },
  {
    key: "architect",
    label: "Architect / planner",
    does: "Turns a lot into permitted units: zoning, massing, drawings, committee of adjustment.",
    when: "When the plan is to add units",
  },
];

export function roleLabel(key: string): string {
  return POWER_TEAM_ROLES.find((role) => role.key === key)?.label ?? key;
}
