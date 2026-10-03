import type { MunicipalFeed } from "./ontario-municipal-sources";
export const YORK_MUNICIPALITIES = ["Vaughan","Markham","Richmond Hill","Newmarket","Aurora","Georgina","East Gwillimbury","Whitchurch-Stouffville","King"] as const;
export type YorkMunicipality = typeof YORK_MUNICIPALITIES[number];
export const YORK_COMMUNITIES: Record<string,{municipality:YorkMunicipality;publishedCommunity:string}> = {maple:{municipality:"Vaughan",publishedCommunity:"Maple"},unionville:{municipality:"Markham",publishedCommunity:"Unionville"},"king city":{municipality:"King",publishedCommunity:"King City"},schomberg:{municipality:"King",publishedCommunity:"Schomberg"},keswick:{municipality:"Georgina",publishedCommunity:"Keswick"},sharon:{municipality:"East Gwillimbury",publishedCommunity:"Sharon"},stouffville:{municipality:"Whitchurch-Stouffville",publishedCommunity:"Whitchurch-Stouffville"}};
export const YORK_PLAN_GUIDANCE="https://www.york.ca/business/planning-for-regional-growth";
export const YORK_REVIEW_GUIDANCE="https://www.york.ca/business/economic-and-development-services/land-development/development-planning-review";
export const YORK_LICENCE_ITEM="78cc02388af248c0b7a30eda6adfade0";
export const YORK_LICENCE_EPOCH={owner:"YorkMunicipalGovt",orgId:"GzvOwaQBbX7KLiuG",access:"public",type:"PDF",title:"York Region Open Data Licence",name:"Open_Data_Licence.pdf",modified:1754061708000,size:140668};
export const YORK_PROPERTY_ADDRESS_TYPES=["Single","Multiple","Building","Building Entrance","Parcel"];
export const YORK_PUBLISHED_MUNICIPAL_LABELS:Record<YorkMunicipality,string>={Vaughan:"City of Vaughan",Markham:"City of Markham","Richmond Hill":"City of Richmond Hill",Newmarket:"Town of Newmarket",Aurora:"Town of Aurora",Georgina:"Town of Georgina","East Gwillimbury":"Town of East Gwillimbury","Whitchurch-Stouffville":"Town of Whitchurch-Stouffville",King:"Township of King"};
export interface YorkFeed extends MunicipalFeed {expectedItemTitle:string;expectedCopyright:string;fieldTypes:Record<string,string>}
export const YORK_FEEDS:YorkFeed[] = [
  {
    "market": "York Region",
    "key": "addresses",
    "item": "588a00fa0451426386ca2f6195555601",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Location/MapServer/0",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website."
    ],
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "expectedLayerName": "Address Point",
    "expectedItemTitle": "Address Point",
    "expectedCopyright": "",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS_NUMBER": "civicNumber",
      "ADD_NUM_SUFFIX": "civicSuffix",
      "FULL_STREET_NAME": "publishedStreet",
      "SUITE_NUMBER": "unit",
      "UNIT_DESIGNATOR": "unitDesignator",
      "MUNICIPALITY": "municipality",
      "MAIL_COMMUNITY_NAME": "postalCommunity",
      "ADDRS_PNT_TYPE": "publishedAddressType",
      "PARID": "municipalParcelId",
      "LIFESTATUS": "publishedLifecycleStatus",
      "MODDATE": "recordModifiedDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS_NUMBER": "esriFieldTypeInteger",
      "ADD_NUM_SUFFIX": "esriFieldTypeString",
      "FULL_STREET_NAME": "esriFieldTypeString",
      "SUITE_NUMBER": "esriFieldTypeString",
      "UNIT_DESIGNATOR": "esriFieldTypeString",
      "MUNICIPALITY": "esriFieldTypeString",
      "MAIL_COMMUNITY_NAME": "esriFieldTypeString",
      "ADDRS_PNT_TYPE": "esriFieldTypeString",
      "PARID": "esriFieldTypeInteger",
      "LIFESTATUS": "esriFieldTypeString",
      "MODDATE": "esriFieldTypeDate"
    },
    "dates": [
      "MODDATE"
    ],
    "note": "Only active Single, Multiple, Building, Building Entrance and Parcel civic points assigned to the nine York municipalities are accepted. Transit, utility, park, unknown and other address types are excluded. Shared points are building/site context, not verified individual units or legal dwelling counts.",
    "source": {
      "id": "york:addresses",
      "name": "York Region Address Point",
      "url": "https://insights-york.opendata.arcgis.com/datasets/588a00fa0451426386ca2f6195555601/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  },
  {
    "market": "York Region",
    "key": "municipality",
    "item": "834537fee6d541a5a7e9a404d9da648a",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Boundary/MapServer/1",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website."
    ],
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "expectedLayerName": "Municipal Boundary",
    "expectedItemTitle": "Municipal Boundary",
    "expectedCopyright": "",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "municipality",
      "FULL_NAME": "publishedMunicipalLabel",
      "YORK_MUNICIPALITY_ID": "regionalMunicipalityId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "FULL_NAME": "esriFieldTypeString",
      "YORK_MUNICIPALITY_ID": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "note": "Only the nine York municipal names are queried; surrounding municipalities and First Nation boundaries are excluded. A unique point intersection must agree with the requested municipality.",
    "source": {
      "id": "york:municipality",
      "name": "York Region Municipal Boundary",
      "url": "https://insights-york.opendata.arcgis.com/datasets/834537fee6d541a5a7e9a404d9da648a/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  },
  {
    "market": "York Region",
    "key": "parcel",
    "item": "1048110e8960444f9390d96dc9f1e376",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Planning/FeatureServer/0",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website."
    ],
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "expectedLayerName": "Parcel",
    "expectedItemTitle": "Parcel",
    "expectedCopyright": "",
    "fields": {
      "OBJECTID": "recordId",
      "PAR_GIS_ID": "municipalParcelId",
      "LOCATION": "publishedLocation",
      "MUNNAME": "municipality",
      "PAR_TYPE": "publishedParcelType",
      "LIFESTATUS": "publishedLifecycleStatus",
      "SOURCE": "publishedRecordSource",
      "SOURCETYPE": "publishedSourceType",
      "MODDATE": "recordModifiedDate",
      "Shape__Area": "publishedGeometryAreaInternalUnitsSquared"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PAR_GIS_ID": "esriFieldTypeInteger",
      "LOCATION": "esriFieldTypeString",
      "MUNNAME": "esriFieldTypeString",
      "PAR_TYPE": "esriFieldTypeString",
      "LIFESTATUS": "esriFieldTypeString",
      "SOURCE": "esriFieldTypeString",
      "SOURCETYPE": "esriFieldTypeString",
      "MODDATE": "esriFieldTypeDate",
      "Shape__Area": "esriFieldTypeDouble"
    },
    "dates": [
      "MODDATE"
    ],
    "note": "Scoped to active records whose published SOURCE is York Region. Other or missing record-source values are excluded. Parcel references and boundaries are reference mapping, not title, PIN or survey evidence. Published location text may describe a multi-address site. Geometry area remains in internal units squared; no surveyed lot size is asserted. Multiple intersections or a conflict with the civic parcel reference remain ambiguous.",
    "source": {
      "id": "york:parcel",
      "name": "York Region Parcel",
      "url": "https://insights-york.opendata.arcgis.com/datasets/1048110e8960444f9390d96dc9f1e376/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  },
  {
    "market": "York Region",
    "key": "regionalPlanningApplications",
    "item": "2ea061702aaa4d5fae39c1226525fd4e",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/DevelopmentApplicationStatusAndTeams/MapServer/0",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website"
    ],
    "oid": "ESRI_OID",
    "geometry": "esriGeometryPolygon",
    "expectedLayerName": "Active Development Application",
    "expectedItemTitle": "Active Development Application Boundaries",
    "expectedCopyright": "The Regional Municipality of York",
    "fields": {
      "ESRI_OID": "queryRowId",
      "REG_FILE_NUM": "regionalFileNumber",
      "EXT_REF_NUM": "publishedLocalFileReference",
      "APPROVAL_NUM": "publishedApprovalReference",
      "APPL_TYPE": "legacyApplicationType",
      "APPL_SUBTYPE": "legacyApplicationSubtype",
      "DATE_RECVD": "legacyReceivedDate",
      "APPL_STAGE": "legacyPublishedStage",
      "APPL_STEP": "legacyPublishedStep",
      "APPL_STATUS": "legacyPublishedStatus",
      "APPL_DESC": "publishedDescription",
      "UNITS": "publishedUnitsText",
      "MUN_NAME": "municipality",
      "ADDRESS": "publishedAddressText",
      "LOCATION": "publishedLocationText",
      "MOD_DATE": "recordModifiedDate",
      "External_Ref__c": "publishedExternalReference",
      "Date_Received__c": "publishedReceivedDate",
      "application_type__C": "publishedApplicationType",
      "application_subtype__C": "publishedApplicationSubtype",
      "Application_Status__c": "publishedStatus",
      "Submission_Date__c": "publishedSubmissionDate",
      "Submission_Number__C": "publishedSubmissionNumber"
    },
    "fieldTypes": {
      "ESRI_OID": "esriFieldTypeOID",
      "REG_FILE_NUM": "esriFieldTypeString",
      "EXT_REF_NUM": "esriFieldTypeString",
      "APPROVAL_NUM": "esriFieldTypeString",
      "APPL_TYPE": "esriFieldTypeString",
      "APPL_SUBTYPE": "esriFieldTypeString",
      "DATE_RECVD": "esriFieldTypeDate",
      "APPL_STAGE": "esriFieldTypeString",
      "APPL_STEP": "esriFieldTypeString",
      "APPL_STATUS": "esriFieldTypeString",
      "APPL_DESC": "esriFieldTypeString",
      "UNITS": "esriFieldTypeString",
      "MUN_NAME": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "LOCATION": "esriFieldTypeString",
      "MOD_DATE": "esriFieldTypeDate",
      "External_Ref__c": "esriFieldTypeString",
      "Date_Received__c": "esriFieldTypeDate",
      "application_type__C": "esriFieldTypeString",
      "application_subtype__C": "esriFieldTypeString",
      "Application_Status__c": "esriFieldTypeString",
      "Submission_Date__c": "esriFieldTypeDate",
      "Submission_Number__C": "esriFieldTypeDouble"
    },
    "dates": [
      "DATE_RECVD",
      "MOD_DATE",
      "Date_Received__c",
      "Submission_Date__c"
    ],
    "note": "Published active regional application-boundary point intersections only. This is a York regional commenting/review context, not municipal approval, complete planning history or work tied exactly to the subject house. Legacy and newer published types, statuses and dates are preserved separately, even when they disagree. UNITS is untyped source text (it can be Yes/No), not a numeric dwelling count. ESRI_OID is retained as queryRowId, not promised as a persistent file identity; use the published regional/local file references. Private applicant/owner/contact names, roll/PIN values, team members, fees and cross-joined constraint classifications are excluded.",
    "source": {
      "id": "york:regionalPlanningApplications",
      "name": "York Region Active Development Application Boundaries",
      "url": "https://insights-york.opendata.arcgis.com/datasets/2ea061702aaa4d5fae39c1226525fd4e/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  },
  {
    "market": "York Region",
    "key": "employmentInventory2025",
    "item": "b2eae84f97cf41aaa9b13943e60b3cd3",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Planning/MapServer/5",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website."
    ],
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "expectedLayerName": "Employment Parcels",
    "expectedItemTitle": "Employment Parcels 2025",
    "expectedCopyright": "Integrated Growth Management",
    "fields": {
      "OBJECTID": "recordId",
      "PARCELID": "municipalParcelId",
      "LOCATION": "publishedLocation",
      "MUNNAME": "municipality",
      "EMP_NAME": "publishedEmploymentArea",
      "LAND_CAT": "publishedLandCategory",
      "DEV_STATUS": "publishedDevelopmentStatus",
      "BLT_STAT": "publishedBuiltStatus",
      "BLT_SUBSTAT": "publishedBuiltSubstatus",
      "GROSS_HA": "publishedGrossHectares",
      "DEV_HA": "publishedDevelopedHectares",
      "NET_HA": "publishedNetHectares",
      "CREDATE": "recordCreatedDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PARCELID": "esriFieldTypeDouble",
      "LOCATION": "esriFieldTypeString",
      "MUNNAME": "esriFieldTypeString",
      "EMP_NAME": "esriFieldTypeString",
      "LAND_CAT": "esriFieldTypeString",
      "DEV_STATUS": "esriFieldTypeString",
      "BLT_STAT": "esriFieldTypeString",
      "BLT_SUBSTAT": "esriFieldTypeString",
      "GROSS_HA": "esriFieldTypeDouble",
      "DEV_HA": "esriFieldTypeDouble",
      "NET_HA": "esriFieldTypeDouble",
      "CREDATE": "esriFieldTypeDate"
    },
    "dates": [
      "CREDATE"
    ],
    "note": "Published 2025 employment-land inventory point screen. Keep the inventory vintage and classifications; this is not current zoning, conversion permission, property valuation or verified present-day development/vacancy. Published hectare fields describe the inventory record and are not a survey. Owner names, roll numbers and unverified zone labels are excluded.",
    "source": {
      "id": "york:employmentInventory2025",
      "name": "York Region Employment Parcels 2025",
      "url": "https://insights-york.opendata.arcgis.com/datasets/b2eae84f97cf41aaa9b13943e60b3cd3/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  },
  {
    "market": "York Region",
    "key": "wellheadProtection",
    "item": "e848f2a3bd3f489dafd6373c5a7b90ac",
    "url": "https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Clean_Water_Act/MapServer/1",
    "owner": "YorkMunicipalGovt",
    "org": "GzvOwaQBbX7KLiuG",
    "licenceAnchors": [
      "Please refer to \"York Region Open Data Licence\", searchable on this website."
    ],
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "expectedLayerName": "Clean Water Act Wellhead Protection Areas",
    "expectedItemTitle": "Clean Water Act (CWA) - Wellhead Protection Area",
    "expectedCopyright": "",
    "fields": {
      "OBJECTID": "recordId",
      "WELLHEAD_PROTECTION_AREA": "publishedProtectionArea",
      "NAME": "publishedAreaName",
      "ZONE": "publishedZoneCode"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "WELLHEAD_PROTECTION_AREA": "esriFieldTypeString",
      "NAME": "esriFieldTypeString",
      "ZONE": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "note": "Published Clean Water Act wellhead-protection mapping point screen. Zone codes and names are preserved without inventing risk scores. It does not establish contamination, drinking-water safety, actual water connection, parcel-wide constraints or current activity-specific rules. Verify with the relevant source-protection authority.",
    "source": {
      "id": "york:wellheadProtection",
      "name": "York Region Clean Water Act (CWA) - Wellhead Protection Area",
      "url": "https://insights-york.opendata.arcgis.com/datasets/e848f2a3bd3f489dafd6373c5a7b90ac/about",
      "licence": "The Regional Municipality of York Open Data Licence v1.0",
      "licenceUrl": "https://insights-york.opendata.arcgis.com/documents/york-region-open-data-licence/explore",
      "attribution": "Contains public sector information made available under The Regional Municipality of York's Open Data Licence."
    }
  }
];
export const YORK_WITHHELD = [
  {
    "layer": "buildingFootprint",
    "item": "1142c5a1212a47d48ad5e57ac296399d",
    "reason": "The layer identifies First Base Solutions Inc. copyright. Authorization to redistribute those third-party footprints under the York licence has not been verified; no records are queried."
  },
  {
    "layer": "heritageNorthernCommunities",
    "item": "f3b4fb6fc1e34ec78225a48cbba869fe",
    "reason": "General public access is stated, but an explicit reuse licence was not verified; no records are queried."
  },
  {
    "layer": "heritageSouthernUrbanCentres",
    "item": "db502b5ba005478db0871aa4e1a2951b",
    "reason": "General public access is stated, but an explicit reuse licence was not verified; no records are queried."
  },
  {
    "layer": "regionalPlanLandUse2022",
    "item": "f7b21560013a4f81b8bec384f930bea0",
    "reason": "The official item has no verified dataset-specific reuse grant. The 2022 regional plan also needs current local municipal amendment and appeal checks; no records are queried."
  },
  {
    "layer": "urbanStructure",
    "item": "657306b5badb45c4a1557803b2023f4d",
    "reason": "The official item has a blank reuse licence; no records are queried."
  }
];
