import type { Source } from "./model";

const town = "https://www.haltonhills.ca";
export const HALTON_HILLS_GUIDANCE = {
  heritage: `${town}/heritage`,
  planning: `${town}/work/planning-development/active-development-applications`,
  zoning: `${town}/zoning`,
  plan: `${town}/work/planning-development/planning-policy/official-plan`,
  buildingRecords: `${town}/town-hall/governance-accountability/freedom-of-information`,
  additionalUnits: `${town}/aru`,
};
export const HALTON_HILLS_DEVELOPMENT_QUERY = "https://map.haltonhills.ca/awse/rest/services/eP/MapServer/24/query";
export const HALTON_HILLS_DEVELOPMENT_FIELDS = ["OBJECTID", "MAP_ID", "LOCATION", "FILE_NO", "APP_DESC", "TWN_AREA"] as const;
export const HALTON_HILLS_SOURCES: Record<"heritage" | "planningApplications", Source> = {
  heritage: {
    id: "haltonhills:published-heritage-tables", name: "Halton Hills published heritage tables",
    url: HALTON_HILLS_GUIDANCE.heritage, licenceUrl: HALTON_HILLS_GUIDANCE.heritage,
    licence: "Town website permission: content may be shared or reproduced with proper attribution",
    attribution: "Town of Halton Hills — published Listed, Part IV and Part V heritage tables. Reproduced with attribution; no Town endorsement.",
  },
  planningApplications: {
    id: "haltonhills:published-development-table", name: "Halton Hills published development table",
    url: HALTON_HILLS_GUIDANCE.planning, licenceUrl: HALTON_HILLS_GUIDANCE.planning,
    licence: "Town website permission: content may be shared or reproduced with proper attribution",
    attribution: "Town of Halton Hills — six fields published in its development table. Reproduced with attribution; no Town endorsement.",
  },
};
export const HALTON_HILLS_WITHHELD = [
  { layer: "addresses", url: "https://www.arcgis.com/sharing/rest/content/items/be687515dc994a98a4015270f4f024ef?f=json" },
  { layer: "municipality", url: "https://www.arcgis.com/sharing/rest/content/items/367958d6ab8f4cd6900b0b8374c59fef?f=json" },
  { layer: "ward", url: "https://www.arcgis.com/sharing/rest/content/items/64313917fa74470188cfadddb1b8b8d9?f=json" },
  { layer: "zoning", url: "https://map.haltonhills.ca/awse/rest/services/Planning/Zoning/MapServer/1?f=json" },
].map(item => ({ ...item, reason: "Dataset reuse scope unverified. ArcGIS item terms are blank and the Town's licensed Hub is private; website reproduction permission is not inherited by unrelated GIS feeds. No records queried." }));
