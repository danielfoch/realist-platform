import type { Source } from "./model";

export const HAMILTON_ORG = "rYz782eMbySr2srL";
export const HAMILTON_ATTRIBUTION = "Contains public sector Data made available under the City of Hamilton’s Open Data Licence";
const ROOT = `https://services.arcgis.com/${HAMILTON_ORG}/arcgis/rest/services/`;
function feed(item: string, service: string, id: number, name: string, fields: string) {
  const root = ROOT + service + "/FeatureServer";
  const source: Source = { id: `hamilton:${service}`, name: `Hamilton ${name}`, url: `https://open.hamilton.ca/datasets/${item}_${id}/explore`, licence: "City of Hamilton Open Data Licence v1.1", attribution: HAMILTON_ATTRIBUTION };
  return { item, root, url: root + "/" + id, source, fields: fields.split(",") };
}
export const HAMILTON = {
  addresses: feed("89a6c5bf4ee44fc89719584a8f78d0b2", "Addresses", 1, "civic addresses", "OBJECTID,NUMBER_COMPLETE,UNIT_NUMBER_COMPLETE,STREET_NAME,FULL_STREET_NAME,STREET_SUFFIX_TYPE,STREET_SUFFIX_DIRECTION,COMMUNITY,MUNICIPALITY,PROVINCE,COUNTRY"),
  heritage: feed("8a9013bfc00f4502b02a404da1d1e1f9", "Heritage_Properties", 0, "heritage properties", "OBJECTID,HERITAGE_STATUS,NAME,STREET_NO_1,STREET_NO_2,STREET_NAME,COMMUNITY,DATE_HERITAGE,PART_IV,PART_V,BYLAW_NO,HCD_NAME,EASEMENT"),
  development: feed("da765ab0f2f64ce5a4792879ecad9f17", "Development_Applications", 2, "development applications", "OBJECTID,FILE_NUM,FILE_TYPE,ADDRESS,FILE_YEAR,DESCRIP"),
  zoning: feed("c61604e849b941099bb4319c97048e4d", "Zoning_By_law_Boundary", 1, "zoning by-law boundaries", "OBJECTID,ZONING_CODE,ZONING_DESC,PARENT_BY_LAW_NUMBER,PARENT_BY_LAW_URL,BY_LAW_NUMBER,BY_LAW_URL,EXCEPTION1,EXCEPTION1_BYLAW,EXCEPTION1_URL,HOLDING1,HOLDING1_BYLAW,HOLDING1_URL,EXCEPTION2,EXCEPTION2_BYLAW,EXCEPTION2_URL,HOLDING2,HOLDING2_BYLAW,HOLDING2_URL,EXCEPTION3,EXCEPTION3_BYLAW,EXCEPTION3_URL,HOLDING3,COMMUNITY,ZONING_MAP,COUNCIL_APP_DATE,FINALBINDING_DATE,ZONING_FILE,OMB_NUMBER,OMB_CASE_NUMBER"),
  environmentalSensitivity: feed("27fb52cd87d347e09706d8990ba9a1c1", "Environmentally_Sensitive_Areas_Boundaries", 3, "environmentally sensitive areas", "OBJECTID,OP_NUMBER,ESA_NAME,SIGNIFICANCE,ANSI_NO,ANSI_CLASS,ANSI_TYPE,CAROLINIAN,NAI"),
  ward: feed("c2c6e4fbf4ca4dbca39446bf8892df38", "Ward_Boundaries", 7, "ward boundaries", "OBJECTID,WARD"),
  permitsRecent: feed("12c2ec7de2d3458c861c699dd724f337", "Building_and_Demolition_Permits_2017_to_Present", 6, "building and demolition permits — published 2017 to Present dataset", "OBJECTID,PERMITNUMBER,DESCRIPTION,APPLIEDDATE,ISSUEDDATE,COMPLETEDDATE,STATUSCURRENT,ORIGINALADDRESS1,ORIGINALADDRESS2,ORIGINALCITY,ORIGINALSTATE,PERMITCLASS,WORKCLASS"),
  permitsHistory: feed("4669e078362d4b57815ffbef77e3dcd6", "Building_and_Demolition_Permits_2008_to_2015", 17, "building and demolition permits — published 2008 to 2016 dataset", "OBJECTID,PERMITNUMBER,DESCRIPTION,APPLIEDDATE,ISSUEDDATE,COMPLETEDDATE,STATUSCURRENT,ORIGINALADDRESS1,ORIGINALADDRESS2,ORIGINALCITY,ORIGINALSTATE,PERMITCLASS,WORKCLASS"),
} as const;
export type HamiltonFeed = typeof HAMILTON[keyof typeof HAMILTON];
export function validHamiltonItem(item: Record<string, unknown>, feed: HamiltonFeed): boolean {
  return item.access === "public" && item.owner === "OpenHamilton" && item.orgId === HAMILTON_ORG && item.url === feed.root && typeof item.licenseInfo === "string" && /href=['"]https:\/\/www\.hamilton\.ca\/(?:city-initiatives\/strategies-actions|city-council\/data-maps\/open-data)\/open-data-licence-terms-and-conditions['"]/i.test(item.licenseInfo);
}
