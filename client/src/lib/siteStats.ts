// Single source of truth for homepage social-proof stats so the numbers can
// never drift between surfaces ($2.6B on one page vs $2.68B on another reads
// as hand-maintained). Update here only — ideally replace with an API-backed
// value derived from the analyses table.
export const SITE_STATS = {
  communityMembers: "11,000+",
  dealsAnalyzedVolume: "$2.6B",
  canadianCities: "26",
  skoolMembers: "1,200+",
} as const;
