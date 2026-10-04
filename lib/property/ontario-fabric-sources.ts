import type { Source } from "./model";

export const FABRIC_LICENCE = "https://www.ontario.ca/page/open-government-licence-ontario";
export const FABRIC_ROOT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open06/MapServer";
export const FABRIC_NOTE = "Original Crown lot/concession and geographic township reference only. Geographic townships differ from current municipal jurisdictions; original lot fabric is not a modern parcel, PIN, title, survey or legal description. Source accuracy and raw verification/annulment/road-allowance labels must be preserved. They do not establish ownership, legal or year-round access, road maintenance, frontage, lot area, severance, permitted use or development rights. A point intersection does not screen the whole property; no-match does not establish absence. Record timestamps are not survey or legal-validity dates; live observation vintage and date timezone remain unverified.";
export interface FabricFeed {
  key: string; packageId: string; slug: string; resourceId: string; title: string;
  item: string; child: number; name: string; fields: Record<string, string>; source: Source;
}
const common = { OBJECTID: "esriFieldTypeOID", OGF_ID: "esriFieldTypeDouble", LOCATION_ACCURACY: "esriFieldTypeString", GEOMETRY_UPDATE_DATETIME: "esriFieldTypeDate", EFFECTIVE_DATETIME: "esriFieldTypeDate", SYSTEM_DATETIME: "esriFieldTypeDate" };
const make = (f: Omit<FabricFeed, "source">): FabricFeed => ({ ...f, source: { id: `ontario:${f.slug}:${f.child}`, name: f.title, url: `${FABRIC_ROOT}/${f.child}`, licence: "Open Government Licence – Ontario", licenceUrl: FABRIC_LICENCE, attribution: "Contains information licensed under the Open Government Licence – Ontario. Land Information Ontario / Office of the Surveyor General." } });
export const FABRIC_FEEDS: FabricFeed[] = [
  make({ key: "ontarioLotFabricReference", packageId: "2af8a864-72c5-4714-9f66-66f6dd01c43e", slug: "lot-fabric-improved", resourceId: "f8abaf9f-3e97-405a-9e06-bfcca3c9fd39", title: "Lot fabric improved", item: "960b8dccf21740e99448e47941ee84d6", child: 2, name: "Lot Fabric Improved", fields: { ...common, CLASS_SUBTYPE: "esriFieldTypeString", LOT_IDENT: "esriFieldTypeString", CONCESSION_IDENT: "esriFieldTypeString", GEOGRAPHIC_TOWNSHIP_NAME: "esriFieldTypeString", ROAD_ALLOWANCE_STATUS_FLG: "esriFieldTypeString", VERIFICATION_STATUS_FLG: "esriFieldTypeString", VERIFICATION_STATUS_DATE: "esriFieldTypeDate" } }),
  make({ key: "ontarioGeographicTownshipReference", packageId: "f4a8f715-894b-4b70-8244-7f5b4ca75876", slug: "geographic-township-improved", resourceId: "ff861d02-dc4d-46da-87dd-e28de58ce96a", title: "Geographic Township Improved", item: "a159cf53aefb46ac806cda5c5f79792c", child: 1, name: "Geographic Township Improved", fields: { ...common, OFFICIAL_NAME: "esriFieldTypeString", TOWNSHIP_SURVEY_SYSTEM: "esriFieldTypeString", ANNULMENT_STATUS_FLG: "esriFieldTypeString" } }),
];
