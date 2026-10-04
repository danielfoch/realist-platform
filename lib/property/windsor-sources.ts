import type { Source } from "./model";
export interface WindsorFeed { key:string; item:string; url:string; rootUrl:string; child:number; expectedItemTitle:string; expectedLayerName:string; geometry:string; oid:string; expectedRootServiceItem:string|null; expectedServiceItem:string|null; expectedRootCopyright:string; expectedCopyright:string; rootDescriptionHash:string; descriptionHash:string; itemDescriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; dates:string[]; matchField:string|null; note:string; source:Source; }
export const WINDSOR_GRANT={
  "site": "5eb39d0df4994cdf88d73db3e4c18a1e",
  "siteTitle": "Open Data Portal",
  "page": "6e96c09c45714875b7f93cd35baae9a1",
  "pageTitle": "Open Data",
  "owner": "geomatics_citywindsor",
  "siteUrl": "https://open-data-portal-citywindsor.hub.arcgis.com",
  "defaultHostname": "open-data-portal-citywindsor.hub.arcgis.com",
  "group": "38109cd1467a478da480abbfb0e0ea96",
  "groupTitle": "Open Data Portal Content",
  "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
  "pdfHash": "ddc5b6ffe8392492197101eb3d12e80604e84496893f6fce67da927ac1fea05d"
};
export const WINDSOR_FEEDS:WindsorFeed[]=[
  {
    "key": "addresses",
    "item": "b6e438e857c74685af9ba793c5f19ead",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PropertyParcels/MapServer/0",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PropertyParcels/MapServer",
    "child": 0,
    "expectedItemTitle": "Address Point",
    "expectedLayerName": "AddressPoint",
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Data Steward / SoR Owner: [Insert Owner Department, e.g., Traffic Operations]\nGIS Infrastructure & ETL Maintenance: GIS Team\nSync Schedule: Weekly",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "61678d306da461a2f34f1d02c3030bd3cf8f192787562b6fb320792f7fa5c133",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "Address": "publishedAddress",
      "street_address": "publishedStreetNumber",
      "street_name": "publishedStreetName",
      "street_suffix": "publishedStreetSuffix",
      "street_direction": "publishedStreetDirection",
      "unit_number": "publishedUnit",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Address": "esriFieldTypeString",
      "street_address": "esriFieldTypeString",
      "street_name": "esriFieldTypeString",
      "street_suffix": "esriFieldTypeString",
      "street_direction": "esriFieldTypeString",
      "unit_number": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Municipal civic attributes only. Published point geometry is not reused because the metadata does not distinguish street-centreline, parcel-fabric and GPS positioning. Unit identity, parcel identity and surveyed position remain unverified.",
    "source": {
      "id": "windsor:addresses",
      "name": "Windsor \u2014 Address Point",
      "url": "https://www.arcgis.com/home/item.html?id=b6e438e857c74685af9ba793c5f19ead",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "municipality",
    "item": "699e993f3fd84510987fec856944c9cc",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/Boundaries/MapServer/0",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/Boundaries/MapServer",
    "child": 0,
    "expectedItemTitle": "City Boundary",
    "expectedLayerName": "CityBoundary",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString"
    },
    "dates": [],
    "matchField": null,
    "note": "City boundary reference; a unique Windsor polygon must contain the suitable point before other municipal property reads. Legal boundary and parcel-wide identity remain unverified.",
    "source": {
      "id": "windsor:municipality",
      "name": "Windsor \u2014 City Boundary",
      "url": "https://www.arcgis.com/home/item.html?id=699e993f3fd84510987fec856944c9cc",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "zoningExceptions",
    "item": "dfd6890123374218aca838ba1c022a45",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/12",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 12,
    "expectedItemTitle": "S20 Zoning",
    "expectedLayerName": "S20Zoning",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "ZONE_TYPE": "publishedZoneType",
      "ZONE_NUM": "publishedSection20Number",
      "LINK": "publishedDocumentLink",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZONE_TYPE": "esriFieldTypeString",
      "ZONE_NUM": "esriFieldTypeString",
      "LINK": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Section 20 specific zoning exception reference. This is separate from the base zoning designation and annex By-law 85-18 regime. Current provisions, amendments, appeals, holding conditions and legal permissions remain unverified.",
    "source": {
      "id": "windsor:zoningExceptions",
      "name": "Windsor \u2014 S20 Zoning",
      "url": "https://www.arcgis.com/home/item.html?id=dfd6890123374218aca838ba1c022a45",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "heritage",
    "item": "3e27a66aaee24c0cb59e592c7d69ee3d",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/10",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 10,
    "expectedItemTitle": "Heritage Site",
    "expectedLayerName": "HeritageSite",
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedAddress",
      "BUILDING_N": "publishedBuildingName",
      "HERITAGE_D": "publishedHeritageDesignation",
      "WARD": "publishedWardOrCustodianField",
      "DESCRIPTION": "publishedDescription",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "BUILDING_N": "esriFieldTypeString",
      "HERITAGE_D": "esriFieldTypeString",
      "WARD": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": "ADDRESS",
    "note": "Exact civic-address heritage attributes only; approximate heritage point geometry is not reused. The raw WARD field can contain Facilities/Parks custodial labels and is not a verified electoral ward. Current register, designation instruments, alteration requirements and parcel identity remain unverified.",
    "source": {
      "id": "windsor:heritage",
      "name": "Windsor \u2014 Heritage Site",
      "url": "https://www.arcgis.com/home/item.html?id=3e27a66aaee24c0cb59e592c7d69ee3d",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "heritageAreas",
    "item": "e187410969f84d078a09310d8a1a88ef",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/9",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 9,
    "expectedItemTitle": "HeritageArea",
    "expectedLayerName": "HeritageArea",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "TYPE": "publishedType",
      "NAME": "publishedName",
      "SITE_NUM": "publishedSiteNumber",
      "BY_LAW": "publishedBylaw",
      "WEBSITE": "publishedWebsite",
      "NOTE": "publishedNote",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "TYPE": "esriFieldTypeString",
      "NAME": "esriFieldTypeString",
      "SITE_NUM": "esriFieldTypeInteger",
      "BY_LAW": "esriFieldTypeString",
      "WEBSITE": "esriFieldTypeString",
      "NOTE": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Published heritage-area references. Preserve type without assuming every feature is a heritage conservation district; current designation instruments, district plans, register and parcel-wide constraints remain unverified.",
    "source": {
      "id": "windsor:heritageAreas",
      "name": "Windsor \u2014 HeritageArea",
      "url": "https://www.arcgis.com/home/item.html?id=e187410969f84d078a09310d8a1a88ef",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "businessImprovement",
    "item": "d71e44329b754cda93f7f2800cfa5c8e",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/8",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 8,
    "expectedItemTitle": "Business Improvement Area",
    "expectedLayerName": "BusinessImprovementArea",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "AREATYPE": "publishedAreaType",
      "NAME": "publishedName",
      "COMMENTS": "publishedComments",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "AREATYPE": "esriFieldTypeString",
      "NAME": "esriFieldTypeString",
      "COMMENTS": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Published business-improvement area reference. Current levies, benefits, funding, services and program eligibility remain unverified.",
    "source": {
      "id": "windsor:businessImprovement",
      "name": "Windsor \u2014 Business Improvement Area",
      "url": "https://www.arcgis.com/home/item.html?id=d71e44329b754cda93f7f2800cfa5c8e",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "planningDistrict",
    "item": "01f1ebf9159945bf8057f0bfdb18ba18",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/11",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 11,
    "expectedItemTitle": "Planning District",
    "expectedLayerName": "PlanningDistrict",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedName",
      "SITE_TYPE": "publishedSiteType",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "SITE_TYPE": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Published planning-district context. A district is separate from an Official Plan land-use designation, current adopted policy, secondary-plan requirements or development permission.",
    "source": {
      "id": "windsor:planningDistrict",
      "name": "Windsor \u2014 Planning District",
      "url": "https://www.arcgis.com/home/item.html?id=01f1ebf9159945bf8057f0bfdb18ba18",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "ward",
    "item": "1647e48e0be748e2ba7d023cb9872ca4",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/Boundaries/MapServer/5",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/Boundaries/MapServer",
    "child": 5,
    "expectedItemTitle": "Municipal Ward Boundary",
    "expectedLayerName": "MunicipalWardBoundary",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID_1",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "de9fb65ce9066354ed2442776220992dfd5d4bf59df9647cdbca45c6ecbfcc69",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID_1": "recordId",
      "WARD": "publishedWard",
      "NUMBER": "publishedNumber",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID_1": "esriFieldTypeOID",
      "WARD": "esriFieldTypeString",
      "NUMBER": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Published municipal ward reference; current election boundaries remain unverified. Councillor and editor identities are excluded.",
    "source": {
      "id": "windsor:ward",
      "name": "Windsor \u2014 Municipal Ward Boundary",
      "url": "https://www.arcgis.com/home/item.html?id=1647e48e0be748e2ba7d023cb9872ca4",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  },
  {
    "key": "archaeologicalReference",
    "item": "e982ff00898a42caabfe2cc185a379ca",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/7",
    "rootUrl": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer",
    "child": 7,
    "expectedItemTitle": "Archaeological Land",
    "expectedLayerName": "ArchaeologicalLand",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": null,
    "expectedServiceItem": null,
    "expectedRootCopyright": "",
    "expectedCopyright": "Engineering - Geomatics",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "d6b0c7eff0cfed85bef04a6874b51480377b7f0ac2f4a3ada618347e2ea92f81",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedName",
      "Website": "publishedWebsite",
      "CLASSIFICATION": "publishedClassification",
      "last_edited_date": "publishedRecordEditDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString",
      "Website": "esriFieldTypeString",
      "CLASSIFICATION": "esriFieldTypeString",
      "last_edited_date": "esriFieldTypeDate"
    },
    "dates": [
      "last_edited_date"
    ],
    "matchField": null,
    "note": "Published archaeological land classification reference. Current Official Plan Schedule C1, Ministry requirements, assessments, Indigenous consultation and parcel-wide applicability remain unverified; no archaeological-site inventory or clearance is established.",
    "source": {
      "id": "windsor:archaeologicalReference",
      "name": "Windsor \u2014 Archaeological Land",
      "url": "https://www.arcgis.com/home/item.html?id=e982ff00898a42caabfe2cc185a379ca",
      "licence": "Open Government Licence \u2013 The Corporation of the City of Windsor 1.0",
      "licenceUrl": "https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf",
      "attribution": "Contains information licensed under the Open Government Licence \u2013 The Corporation of the City of Windsor."
    }
  }
];
export const WINDSOR_WITHHELD=[
  {
    "layer": "parcel",
    "url": "https://opendata.citywindsor.ca/Details/204",
    "reason": "Old City metadata identifies Land Registry, MPAC and survey-plan lineage; the City grant excludes unauthorized third-party rights. Current cadastral geometry, legal/assessment identifiers, ownership and lot facts are not queried or counted pending actual rights verification."
  },
  {
    "layer": "municipalAddressGeometry",
    "url": "https://www.arcgis.com/home/item.html?id=b6e438e857c74685af9ba793c5f19ead",
    "reason": "City civic attributes are enabled separately. Generic point metadata lists centreline, parcel-fabric or GPS capture without identifying the actual method. Point coordinates are not used as precise property identity; use a uniquely matched National Address Register building point or caller-verified coordinates."
  },
  {
    "layer": "addressPolygon",
    "url": "https://www.arcgis.com/home/item.html?id=6793ba072d1b4103bf2a7b296ab8961c",
    "reason": "Parcel-derived address polygons have unresolved cadastral lineage. Duplicate civic attributes add no independent identity proof. Geometry and parcel/lot attributes are not queried or counted."
  },
  {
    "layer": "buildingFootprints",
    "url": "https://opendata.citywindsor.ca/Details/234",
    "reason": "Legacy City metadata describes 2015/2019 aerial outlines; the current generic metadata does not resolve supplier rights, acquisition/accuracy or building-height meanings/units. Footprints, heights and geometry measures are not queried or counted."
  },
  {
    "layer": "zoning",
    "url": "https://citywindsor.ca/residents/planning/plans-and-community-information/Zoning-By-law",
    "reason": "Licensed S20 exception mapping is enabled separately; complete base zoning, 8600/annex 85-18 applicability, current written provisions, amendments and appeals are not verified. Parcel-derived zoning is not reused."
  },
  {
    "layer": "officialPlan",
    "url": "https://www.citywindsor.ca/residents/planning/plans-and-community-information/windsor-official-plan",
    "reason": "Planning-district and archaeological reference mapping are separate context. Complete current adopted land-use schedules, written policies, secondary plans, OPA159 approval and appeal outcomes are not yet verified as a licensed property-query feed."
  },
  {
    "layer": "permits",
    "url": "https://publicpropertyinquiry.citywindsor.ca/?area=anon",
    "reason": "Public lookup access is separate from commercial record reuse. No property-level permit-history grant has been verified; do not scrape the inquiry portal or count aggregate construction statistics as property histories."
  },
  {
    "layer": "planningApplications",
    "url": "https://www.arcgis.com/home/item.html?id=1497da25ce774592ad66d6a11f43904f",
    "reason": "Committee of Adjustment map/application references have blank terms and an unbound child17, separate from licensed neighbouring layers. Complete planning/variance decisions, conditions, appeals and histories are not queried or counted."
  },
  {
    "layer": "variance",
    "url": "https://mappmycity.ca/arcgis/rest/services/OpenDataServices/PlanningDevelopment/MapServer/17",
    "reason": "An accessible Committee of Adjustment child with blank grant and no separately licensed item does not authorize reuse. No application/decision records or counts are fetched."
  },
  {
    "layer": "conservation",
    "url": "https://www.essexregionconservation.ca/development-services",
    "reason": "ERCA describes online mapping as visual reference and says unmapped regulation may still apply. Commercial feed reuse and current regulatory geometry are not verified. No regulatory/flood clearance, safety or parcel-wide absence is established."
  }
];
