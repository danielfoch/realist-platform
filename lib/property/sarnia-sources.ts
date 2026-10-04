import type { Source } from "./model";
export interface SarniaFeed { key:string; item:string; itemUrl:string; expectedItemType:string; expectedAccessInformation:string|null; rootUrl:string; url:string; child:number; expectedItemTitle:string; expectedLayerName:string; geometry:string; oid:string; expectedRootServiceItem:string|null; expectedServiceItem:string|null; expectedRootCopyright:string; expectedCopyright:string; rootDescriptionHash:string; descriptionHash:string; itemDescriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; matchField?:string; radiusMeters?:number; note:string; source:Source; }
export const SARNIA_GRANT={
  "site": "28a2a847e147447f8eb6ddc6025d561b",
  "siteTitle": "Sarnia GeoHub",
  "siteOwner": "nicole.ferguson",
  "org": null,
  "siteUrl": "https://city-of-sarnia.hub.arcgis.com",
  "defaultHostname": "city-of-sarnia.hub.arcgis.com",
  "group": "b649f143e4a842e1a923dca3b3279eeb",
  "groupTitle": "Sarnia GIS Hub Content",
  "groupOwner": "nicole.ferguson",
  "page": "4acef04992034598a45181305786d2f3",
  "pageTitle": "Terms of Use",
  "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
  "fullGrantHash": "c185525de44499046df30d105d3d52b110439d11470c3c1f74c25e3c5166a71b",
  "officialOffer": "https://www.sarnia.ca/city-of-sarnia-open-data-portal/",
  "publisher": "troy.fox",
  "serviceOrg": "ICybsLmBXrZCZV3x"
};
export const SARNIA_FEEDS:SarniaFeed[]=[
  {
    "key": "municipalAddresses",
    "item": "2ed254db85d6442a8b040213c0c6b097",
    "itemUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Addresses_Open_Data_AGOL/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Addresses_Open_Data_AGOL/FeatureServer",
    "url": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Addresses_Open_Data_AGOL/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "Addresses Open Data",
    "expectedLayerName": "Addresses Open Data",
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID_1",
    "expectedRootServiceItem": "2ed254db85d6442a8b040213c0c6b097",
    "expectedServiceItem": "2ed254db85d6442a8b040213c0c6b097",
    "expectedRootCopyright": "",
    "expectedCopyright": "Planning Department",
    "rootDescriptionHash": "1737bebd31778687c4585af785c95b7db1fbcb8092dc0b2cb81e5885beb9ee56",
    "descriptionHash": "6230216c4dbc3400f69c22f197958d04235231f25f22973c80274d34ade451c7",
    "itemDescriptionHash": "ab256df4ad3d2b0456cadbca70330d5c8ecf320ccbec18f337f6f121064c3c42",
    "termsHash": "86afdc3fc1e0ce38ef6f20d65d2aeb2c451140114772b9e9b7784a9846e8e1bf",
    "fields": {
      "OBJECTID_1": "recordId",
      "ADDRESS": "publishedAddress",
      "STNUM": "publishedStreetNumber",
      "STNAME": "publishedStreetName",
      "STTYPE": "publishedStreetType",
      "STTYPE_A": "publishedStreetTypeAbbreviation",
      "STDIR": "publishedDirection",
      "STDIR_A": "publishedDirectionAbbreviation",
      "CITY": "publishedCity"
    },
    "fieldTypes": {
      "OBJECTID_1": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "STNUM": "esriFieldTypeString",
      "STNAME": "esriFieldTypeString",
      "STTYPE": "esriFieldTypeString",
      "STTYPE_A": "esriFieldTypeString",
      "STDIR": "esriFieldTypeString",
      "STDIR_A": "esriFieldTypeString",
      "CITY": "esriFieldTypeString"
    },
    "matchField": "ADDRESS",
    "note": "Unique strict City civic attributes only. Full address, civic number/suffix, street/type/direction components and City must agree. Generic City point geometry is not reused as precise building, unit or cadastral identity.",
    "source": {
      "id": "sarnia:municipalAddresses",
      "name": "Sarnia — Addresses Open Data",
      "url": "https://www.arcgis.com/home/item.html?id=2ed254db85d6442a8b040213c0c6b097",
      "licence": "Open Government Licence – City of Sarnia",
      "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Sarnia. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "catalogueZoningReference",
    "item": "6a10a84c460e4ea3814ffce7bf0faa1a",
    "itemUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Zoning_Open_Data/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Zoning_Open_Data/FeatureServer",
    "url": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Zoning_Open_Data/FeatureServer/1",
    "child": 1,
    "expectedItemTitle": "Zoning Open Data",
    "expectedLayerName": "Zoning",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "6a10a84c460e4ea3814ffce7bf0faa1a",
    "expectedServiceItem": "6a10a84c460e4ea3814ffce7bf0faa1a",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "388e1123ed314896278aa8dbd8771a4f5f0f138827c04a07d3d9885b990437fa",
    "termsHash": "86afdc3fc1e0ce38ef6f20d65d2aeb2c451140114772b9e9b7784a9846e8e1bf",
    "fields": {
      "OBJECTID": "recordId",
      "ZC_KEY": "publishedZoneCode",
      "ZC_CAT": "publishedZoneCategory",
      "ZC_DESC": "publishedZoneDescription",
      "ZC_JURI": "publishedJurisdiction",
      "EFFECTDATE": "publishedEffectDate",
      "BYLAW_NO": "publishedBylawNumber"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZC_KEY": "esriFieldTypeString",
      "ZC_CAT": "esriFieldTypeString",
      "ZC_DESC": "esriFieldTypeString",
      "ZC_JURI": "esriFieldTypeString",
      "EFFECTDATE": "esriFieldTypeDate",
      "BYLAW_NO": "esriFieldTypeString"
    },
    "note": "Published catalogue zoning labels, bylaw number and effect-date observation only. Current governing instrument, written rules, exceptions/holds, amendments/appeals and draft-review adoption are unverified; no permission is established.",
    "source": {
      "id": "sarnia:catalogueZoningReference",
      "name": "Sarnia — Zoning Open Data",
      "url": "https://www.arcgis.com/home/item.html?id=6a10a84c460e4ea3814ffce7bf0faa1a",
      "licence": "Open Government Licence – City of Sarnia",
      "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Sarnia. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "buildingFootprintReference",
    "item": "06d19190ebe24188afe310c94a05fbcc",
    "itemUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Buildings_Open_Data_AGOL/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Buildings_Open_Data_AGOL/FeatureServer",
    "url": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Buildings_Open_Data_AGOL/FeatureServer/2",
    "child": 2,
    "expectedItemTitle": "Buildings Open Data",
    "expectedLayerName": "Buildings Open Data",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID_12",
    "expectedRootServiceItem": "06d19190ebe24188afe310c94a05fbcc",
    "expectedServiceItem": "06d19190ebe24188afe310c94a05fbcc",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "bfae198c36333ae4d449dbf47b3ec6715d537d1d74edcddc7d26329a2edf335c",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "bfae198c36333ae4d449dbf47b3ec6715d537d1d74edcddc7d26329a2edf335c",
    "termsHash": "86afdc3fc1e0ce38ef6f20d65d2aeb2c451140114772b9e9b7784a9846e8e1bf",
    "fields": {
      "OBJECTID_12": "recordId"
    },
    "fieldTypes": {
      "OBJECTID_12": "esriFieldTypeOID"
    },
    "note": "Published footprint reference identifier intersecting the independent point. Original observation vintage, current building identity, area, dimensions, height, construction year, condition and legal units are unverified. Geometry and generalized land-use labels are excluded.",
    "source": {
      "id": "sarnia:buildingFootprintReference",
      "name": "Sarnia — Buildings Open Data",
      "url": "https://www.arcgis.com/home/item.html?id=06d19190ebe24188afe310c94a05fbcc",
      "licence": "Open Government Licence – City of Sarnia",
      "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Sarnia. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "developmentChargeAreas",
    "item": "063155193efa4a019a4ad1996c735312",
    "itemUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Development_Charges_Open_Data_AGOL/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Development_Charges_Open_Data_AGOL/FeatureServer",
    "url": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Development_Charges_Open_Data_AGOL/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "Development Charges Open Data",
    "expectedLayerName": "Development Charges Open Data",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "063155193efa4a019a4ad1996c735312",
    "expectedServiceItem": "063155193efa4a019a4ad1996c735312",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "0216dda5ee46e7a38d8704440054535d219c724db7b59de4a5f47e99dab79138",
    "descriptionHash": "57fa3b8214539cc4e505afefe03b39125df70d5af138bdecf11ac3adddd35dbd",
    "itemDescriptionHash": "a1dd29c575accbd0bc82b71ffe4f16e1413c5984f3251ffe2062cf109ac79039",
    "termsHash": "86afdc3fc1e0ce38ef6f20d65d2aeb2c451140114772b9e9b7784a9846e8e1bf",
    "fields": {
      "OBJECTID": "recordId",
      "DEV_CHARGE_TYPE": "publishedChargeAreaType"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "DEV_CHARGE_TYPE": "esriFieldTypeString"
    },
    "note": "Published development-charge area type intersecting the independent point. Current fees/rates, exemptions, payment, eligibility, servicing and governing bylaw applicability remain unverified.",
    "source": {
      "id": "sarnia:developmentChargeAreas",
      "name": "Sarnia — Development Charges Open Data",
      "url": "https://www.arcgis.com/home/item.html?id=063155193efa4a019a4ad1996c735312",
      "licence": "Open Government Licence – City of Sarnia",
      "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Sarnia. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "parkReference",
    "item": "42d6cf7eb6224579b1c6f3a16c810636",
    "itemUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Parks_Open_Data_AGOL/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Parks_Open_Data_AGOL/FeatureServer",
    "url": "https://services1.arcgis.com/ICybsLmBXrZCZV3x/arcgis/rest/services/Parks_Open_Data_AGOL/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "Parks Open Data",
    "expectedLayerName": "Parks Open Data",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "42d6cf7eb6224579b1c6f3a16c810636",
    "expectedServiceItem": "42d6cf7eb6224579b1c6f3a16c810636",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "f4d64a8a59ce8c389c05535243509269eab992b31537b39b37c1eb2c4927c622",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "06a614e5c903438db0e2fad69403a5de923dc23adabbaedc57754c23ecbc1b5e",
    "termsHash": "86afdc3fc1e0ce38ef6f20d65d2aeb2c451140114772b9e9b7784a9846e8e1bf",
    "fields": {
      "OBJECTID": "recordId",
      "Park_Name": "publishedParkName",
      "Classification": "publishedClassification",
      "Park_Type": "publishedParkType",
      "Lifecycle_Status": "publishedLifecycleStatus"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Park_Name": "esriFieldTypeString",
      "Classification": "esriFieldTypeString",
      "Park_Type": "esriFieldTypeString",
      "Lifecycle_Status": "esriFieldTypeString"
    },
    "radiusMeters": 1000,
    "note": "Published park polygons intersecting a 1,000-metre search buffer. Nearby references are not subject-property records, nearest-feature rankings, verified walking access, current amenities or parcel-wide constraints.",
    "source": {
      "id": "sarnia:parkReference",
      "name": "Sarnia — Parks Open Data",
      "url": "https://www.arcgis.com/home/item.html?id=42d6cf7eb6224579b1c6f3a16c810636",
      "licence": "Open Government Licence – City of Sarnia",
      "licenceUrl": "https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Sarnia. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  }
];
export const SARNIA_WITHHELD=[
  {
    "layer": "permits",
    "url": "https://www.sarnia.ca/construction-projects-and-renovations/building-permits/",
    "reason": "Complete property permit history, inspections, final completion and occupancy are not provided by a licensed property-level feed. City guidance directs permit copies to the individual issued and building history/surveys/blueprints through the Clerk’s freedom-of-information process. Applications and statistics are not evidence of completion."
  },
  {
    "layer": "planningApplications",
    "url": "https://www.sarnia.ca/business-planning-and-development/residential-development-pipeline/",
    "reason": "The official residential pipeline dashboard and its separate tracker dataset have blank grants outside the inspected 14-item open catalogue. No property record, geometry or count reads are performed. Council-approved pipeline entries do not establish remaining approvals, issued permits or current permission."
  },
  {
    "layer": "variance",
    "url": "https://www.sarnia.ca/business-planning-and-development/",
    "reason": "No complete attributed property-level minor-variance/consent decision, conditions and appeal feed has been verified."
  },
  {
    "layer": "zoning",
    "url": "https://www.sarnia.ca/planning-zoning-by-law-document/",
    "reason": "Separate catalogue labels do not establish current bylaw 85 of 2002 provisions, exceptions/holds, amendments, appeals or parcel-wide permission. The City’s 2026 review and May public meeting concern a draft replacement; adoption/repeal and current applicability require City instruments."
  },
  {
    "layer": "currentPlanningInstruments",
    "url": "https://www.sarnia.ca/official-plan-document/",
    "reason": "The City links a December 4, 2025 Official Plan consolidation. Complete current policies/schedules, subsequent amendments, appeals and applicable draft-review adoption have not been verified. No Hub grant is extended to separate City website files."
  },
  {
    "layer": "heritage",
    "url": "https://www.sarnia.ca/doing-business/cultural-heritage/",
    "reason": "The current complete Part IV, Part V and listed-property register and legal instruments are not machine-verified. Separate City website PDF/tour content is not granted by this exact Hub dataset offer; no record/count/geometry queries are performed."
  },
  {
    "layer": "additionalUnits",
    "url": "https://www.sarnia.ca/living-here/my-property/additional-dwelling-units/",
    "reason": "ADU application guidance and conditional charge exemptions do not identify registered/legal units or establish inspection, occupancy, current permission or funding eligibility."
  },
  {
    "layer": "parcel",
    "url": "https://city-of-sarnia.hub.arcgis.com/",
    "reason": "No original licensed typed cadastral fabric/title/PIN/measurement source has been verified. City civic and footprint references do not establish surveyed parcel or ownership identity."
  },
  {
    "layer": "sarniaConservationRegulation",
    "url": "https://www.scrca.on.ca/planning-and-regulations/map-your-property/",
    "reason": "SCRCA Regulation 41/24 mapping can omit regulated areas. Current original authority rights, typed lineage, complete parcel-wide boundaries and proposed-work requirements remain unverified; the separate viewer agreement was not accepted and no authority records/counts/geometry were queried."
  },
  {
    "layer": "floodplainOverlay",
    "url": "https://www.arcgis.com/home/item.html?id=6a10a84c460e4ea3814ffce7bf0faa1a",
    "reason": "The City zoning service Natural Hazards child is withheld pending original authority rights, observation vintage and current governing-instrument lineage. Catalogue zoning does not screen floodplain or establish clearance."
  },
  {
    "layer": "airportConstraints",
    "url": "https://www.arcgis.com/home/item.html?id=6a10a84c460e4ea3814ffce7bf0faa1a",
    "reason": "Airport Height Limitations and Noise Exposure Forecast children are withheld pending original airport/federal/third-party rights and current legal lineage; no records/counts/geometry queried."
  },
  {
    "layer": "shorelineManagementReference",
    "url": "https://www.arcgis.com/home/item.html?id=6a10a84c460e4ea3814ffce7bf0faa1a",
    "reason": "The shoreline-management polyline is withheld pending originating authority rights, dates, current instruments and parcel-wide interpretation. No record/count/geometry query is performed."
  },
  {
    "layer": "wellheadProtection",
    "url": "https://www.scrca.on.ca/",
    "reason": "Current source-protection original rights, typed mapping and activity-specific requirements are unverified. No drinking-water safety, contamination or clearance inference is made."
  }
];
