import type { Source } from "./model";
export interface NiagaraFeed { publisher:"falls"|"region"; market:string; key:string; group:string; item:string; url:string; rootUrl:string; owner:string; org:string; expectedItemTitle:string; expectedLayerName:string; expectedCopyright:string; termsHash:string; oid:string; geometry:string; fields:Record<string,string>; fieldTypes:Record<string,string>; dates:string[]; matchField?:string; catalogue:{name:string;id:string;title:string;organizationId:string;organizationName:string;licenceId:string;licenceUrl:string;guid:string}; note:string; source:Source; }
export const NIAGARA_MUNICIPALITIES=["Fort Erie","Grimsby","Lincoln","Niagara Falls","Niagara-on-the-Lake","Pelham","Port Colborne","St. Catharines","Thorold","Wainfleet","Welland","West Lincoln"] as const;
export const NIAGARA_GRANTS={
  "region": {
    "url": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
    "selector": ".ckanext-pages-content",
    "hash": "662ba93a6d9e93719a6386323095c6903099fbcc1d61fbb999d3eb011c69536e"
  },
  "falls": {
    "site": "a79ec84a63834831a8a294e6d7153da7",
    "siteTitle": "City of Niagara Falls - Ontario - Canada Open Data Hub",
    "page": "62ef94db9f584cd19d9822a621dcd2c0",
    "pageTitle": "Niagara Falls Open Data - Terms of Use",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "hash": "a18b3f455152d06679b408552c0a59c867edfa6a8bac9d8ecd1e4973b4c5f072"
  },
  "ontario": {
    "url": "https://www.ontario.ca/page/open-government-licence-ontario",
    "selector": "#main-content .body-field",
    "hash": "87588763e2552bbb40ce62f9f3ae255c8dc7058ac8601c56d1edfd081adf6bb8",
    "catalogue": "https://data.ontario.ca/api/3/action/package_show?id=municipal-boundaries",
    "catalogueId": "2bee144c-4c52-4ce3-bd9a-e7c1166f2402"
  }
};
export const NIAGARA_FEEDS:NiagaraFeed[]=[
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "addresses",
    "group": "addresses",
    "item": "574a111cfe26426a90f1266cb5803d53",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Address_Points/FeatureServer/43",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Address_Points/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Address Points",
    "expectedLayerName": "Address Points",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "Full_StreetNo": "publishedFullStreetNo",
      "Qualifier": "publishedQualifier",
      "StreetName": "publishedStreetName",
      "StreetType": "publishedStreetType",
      "StreetDir": "publishedStreetDir",
      "Unit": "publishedUnit",
      "Municipality": "publishedMunicipality",
      "StreetNo": "publishedStreetNo",
      "LifeCycleStatus": "publishedLifeCycleStatus"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Full_StreetNo": "esriFieldTypeString",
      "Qualifier": "esriFieldTypeString",
      "StreetName": "esriFieldTypeString",
      "StreetType": "esriFieldTypeString",
      "StreetDir": "esriFieldTypeString",
      "Unit": "esriFieldTypeString",
      "Municipality": "esriFieldTypeString",
      "StreetNo": "esriFieldTypeInteger",
      "LifeCycleStatus": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "address-points",
      "id": "8a784550-002f-416f-8b56-2c339f257a23",
      "title": "Address Points",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=574a111cfe26426a90f1266cb5803d53&sublayer=43"
    },
    "note": "Regional civic points generated at a parcel centroid or building footprint. Lifecycle/unit/qualifier text is retained; no surveyed position, dwelling count, unit legality, owner or roll fields.",
    "source": {
      "id": "niagara:niagara-region:addresses",
      "name": "Address Points",
      "url": "https://niagaraopendata.ca/dataset/address-points",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "municipality",
    "group": "municipality",
    "item": "1738c31501b04346bfc55fa0b748b96d",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Municipal_Boundaries/FeatureServer/26",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Municipal_Boundaries/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Municipal Boundaries",
    "expectedLayerName": "Municipal Boundaries",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedName",
      "Type": "publishedType",
      "Label": "publishedLabel"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString",
      "Type": "esriFieldTypeString",
      "Label": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "municipal-boundaries",
      "id": "3a39381e-61d6-4978-8581-5d49d947b4f7",
      "title": "Municipal Boundaries",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=1738c31501b04346bfc55fa0b748b96d&sublayer=26"
    },
    "note": "Region-modified municipal boundary references originating with the Ontario Ministry of Municipal Affairs; preliminary identity gate, not a surveyed/legal boundary opinion. Contains information licensed under the Open Government Licence – Ontario.",
    "source": {
      "id": "niagara:niagara-region:municipality",
      "name": "Municipal Boundaries",
      "url": "https://niagaraopendata.ca/dataset/municipal-boundaries",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region. Contains information licensed under the Open Government Licence – Ontario."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "regionalHeritageProperties",
    "group": "heritage",
    "item": "a1072adf622e42bd8bd72805458e18eb",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Designated_Heritage_Properties/FeatureServer/35",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Designated_Heritage_Properties/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Designated Heritage Properties",
    "expectedLayerName": "Designated Heritage Properties",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "SITE_NAME": "publishedSITENAME",
      "ADDRESS": "publishedADDRESS",
      "MUNICIPALITY": "publishedMUNICIPALITY"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "SITE_NAME": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "MUNICIPALITY": "esriFieldTypeString"
    },
    "dates": [],
    "matchField": "ADDRESS",
    "catalogue": {
      "name": "designated-heritage-properties",
      "id": "6157fd22-c649-41c3-8d3d-44e854aca808",
      "title": "Designated Heritage Properties",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=a1072adf622e42bd8bd72805458e18eb&sublayer=35"
    },
    "note": "Exact civic and published municipality heritage point references; listed/non-designated properties, districts, full register and current designation instruments remain unsearched.",
    "source": {
      "id": "niagara:niagara-region:regionalHeritageProperties",
      "name": "Designated Heritage Properties",
      "url": "https://niagaraopendata.ca/dataset/designated-heritage-properties",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "urbanAreaReference",
    "group": "settlementReference",
    "item": "ac46f79dc0764877a7d251cf9b646018",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Urban_Area_Boundaries/FeatureServer/8",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Urban_Area_Boundaries/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Urban Area Boundaries",
    "expectedLayerName": "Urban Area Boundaries",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedNAME",
      "TYPE": "publishedTYPE",
      "Hectares": "publishedHectares"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "TYPE": "esriFieldTypeString",
      "Hectares": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "catalogue": {
      "name": "urban-area-boundaries",
      "id": "77208a98-bf5d-4ab4-a243-098046c26325",
      "title": "Urban Area Boundaries",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=ac46f79dc0764877a7d251cf9b646018&sublayer=8"
    },
    "note": "Published urban-area reference polygons; current local amendments, expansion decisions, services and development rights are unverified.",
    "source": {
      "id": "niagara:niagara-region:urbanAreaReference",
      "name": "Urban Area Boundaries",
      "url": "https://niagaraopendata.ca/dataset/urban-area-boundaries",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "ruralSettlementReference",
    "group": "settlementReference",
    "item": "49cab3dc8c04410e9bddd761f05802af",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Rural_Settlements/FeatureServer/12",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Rural_Settlements/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Rural Settlements",
    "expectedLayerName": "Rural Settlements",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Hamlet_Name": "publishedHamletName",
      "Hec": "publishedHec"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Hamlet_Name": "esriFieldTypeString",
      "Hec": "esriFieldTypeDouble"
    },
    "dates": [],
    "catalogue": {
      "name": "rural-settlements",
      "id": "be33d940-9bb7-44df-b2d2-5088bb127380",
      "title": "Rural Settlements",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=49cab3dc8c04410e9bddd761f05802af&sublayer=12"
    },
    "note": "Published rural-settlement reference polygons; mapping does not prove servicing, septic feasibility or buildability.",
    "source": {
      "id": "niagara:niagara-region:ruralSettlementReference",
      "name": "Rural Settlements",
      "url": "https://niagaraopendata.ca/dataset/rural-settlements",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "growthCentreReference",
    "group": "settlementReference",
    "item": "0fa1a58f46524951afa33d6691353403",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Regional_Growth_Centre/FeatureServer/15",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Regional_Growth_Centre/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Regional Growth Centre",
    "expectedLayerName": "Regional Growth Centre",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "PlanType": "publishedPlanType",
      "Municipality": "publishedMunicipality",
      "HECTARES": "publishedHECTARES"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PlanType": "esriFieldTypeString",
      "Municipality": "esriFieldTypeString",
      "HECTARES": "esriFieldTypeDouble"
    },
    "dates": [],
    "catalogue": {
      "name": "regional-growth-centre",
      "id": "2a28b390-9f4f-4e06-bd69-b2540f97baa3",
      "title": "Regional Growth Centre",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=0fa1a58f46524951afa33d6691353403&sublayer=15"
    },
    "note": "Published growth-centre references; no density entitlement or current local permission established.",
    "source": {
      "id": "niagara:niagara-region:growthCentreReference",
      "name": "Regional Growth Centre",
      "url": "https://niagaraopendata.ca/dataset/regional-growth-centre",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "wastewaterCatchment",
    "group": "wastewaterCatchment",
    "item": "adcd5f24d5f445cf8122cf542fc85c5c",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_RMoN_San_SPS_Catchments/FeatureServer/14",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_RMoN_San_SPS_Catchments/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "RMoN San SPS Catchments",
    "expectedLayerName": "RMoN San SPS Catchments",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "MUNICIPALITY": "publishedMUNICIPALITY",
      "STATUS": "publishedSTATUS",
      "ADMINISTRATIVE_AREA": "publishedADMINISTRATIVEAREA",
      "NAME": "publishedNAME",
      "CATCHMENT_ORDER": "publishedCATCHMENTORDER"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "MUNICIPALITY": "esriFieldTypeString",
      "STATUS": "esriFieldTypeString",
      "ADMINISTRATIVE_AREA": "esriFieldTypeString",
      "NAME": "esriFieldTypeString",
      "CATCHMENT_ORDER": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "catalogue": {
      "name": "rmon-san-sps-catchments",
      "id": "19d02307-ff64-4670-a19e-ff7c2dc4f22d",
      "title": "RMoN San SPS Catchments",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=adcd5f24d5f445cf8122cf542fc85c5c&sublayer=14"
    },
    "note": "Rough regional sanitary-catchment boundaries. Raw status is a source label; actual connection, servicing eligibility and available capacity are unverified.",
    "source": {
      "id": "niagara:niagara-region:wastewaterCatchment",
      "name": "RMoN San SPS Catchments",
      "url": "https://niagaraopendata.ca/dataset/rmon-san-sps-catchments",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "quaternaryWatershed",
    "group": "watersheds",
    "item": "34cafbf0d22340c68083db17221a6642",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Quaternary_Watersheds/FeatureServer/16",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Quaternary_Watersheds/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Quaternary Watersheds",
    "expectedLayerName": "Quaternary Watersheds",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "QuartName": "publishedQuartName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "QuartName": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "quaternary-watersheds",
      "id": "bea7d3af-d80e-4706-bc71-97cd8670da0a",
      "title": "Quaternary Watersheds",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=34cafbf0d22340c68083db17221a6642&sublayer=16"
    },
    "note": "Published quaternary watershed references; not a flood, water-quality or conservation-authority regulatory screen.",
    "source": {
      "id": "niagara:niagara-region:quaternaryWatershed",
      "name": "Quaternary Watersheds",
      "url": "https://niagaraopendata.ca/dataset/quaternary-watersheds",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "tertiaryWatershed",
    "group": "watersheds",
    "item": "88c5bad5b14145a18e310c89d0d544ca",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Tertiary_Watersheds/FeatureServer/9",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Tertiary_Watersheds/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Tertiary Watersheds",
    "expectedLayerName": "Tertiary Watersheds",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NAME1": "publishedNAME1",
      "AREA_HA": "publishedAREAHA",
      "Drainage_D": "publishedDrainageD"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME1": "esriFieldTypeString",
      "AREA_HA": "esriFieldTypeDouble",
      "Drainage_D": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "tertiary-watersheds",
      "id": "ec67e948-b168-4904-aee3-28a2c6908a23",
      "title": "Tertiary Watersheds",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=88c5bad5b14145a18e310c89d0d544ca&sublayer=9"
    },
    "note": "Published tertiary watershed references; raw drainage text is not a parcel risk assessment.",
    "source": {
      "id": "niagara:niagara-region:tertiaryWatershed",
      "name": "Tertiary Watersheds",
      "url": "https://niagaraopendata.ca/dataset/tertiary-watersheds",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "woodlandReference",
    "group": "naturalEnvironmentReference",
    "item": "5704b9455f694100a0ab3ddada32517c",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Significant_Woodlands/FeatureServer/44",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_Significant_Woodlands/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "Significant Woodlands",
    "expectedLayerName": "Significant Woodlands",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "layername": "publishedLayername",
      "hectares": "publishedHectares"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "layername": "esriFieldTypeString",
      "hectares": "esriFieldTypeDouble"
    },
    "dates": [],
    "catalogue": {
      "name": "significant-woodlands1",
      "id": "d32a5d62-ced4-4717-8f6b-76ac5d2dcb34",
      "title": "Significant Woodlands",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=5704b9455f694100a0ab3ddada32517c&sublayer=44"
    },
    "note": "Published woodland reference polygons; current legal natural-heritage policies, parcel-wide constraints and NPCA regulation are unverified.",
    "source": {
      "id": "niagara:niagara-region:woodlandReference",
      "name": "Significant Woodlands",
      "url": "https://niagaraopendata.ca/dataset/significant-woodlands1",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "region",
    "market": "Niagara Region",
    "key": "draftWetlandReference",
    "group": "naturalEnvironmentReference",
    "item": "5218826f9b6b4bf090632d9499aeb7b6",
    "url": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_NES_Other_Wetlands_Non_PSW/FeatureServer/24",
    "rootUrl": "https://services1.arcgis.com/WxiLK82TWf8W3O3f/arcgis/rest/services/OpenData_NES_Other_Wetlands_Non_PSW/FeatureServer",
    "owner": "niagararegion",
    "org": "WxiLK82TWf8W3O3f",
    "expectedItemTitle": "NES Other Wetlands Non PSW",
    "expectedLayerName": "NES Other Wetlands Non PSW",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "series_cod": "publishedSeriesCod",
      "hectares": "publishedHectares",
      "layername": "publishedLayername"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "series_cod": "esriFieldTypeString",
      "hectares": "esriFieldTypeDouble",
      "layername": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "nes-other-wetlands-non-psw",
      "id": "a1611569-7f04-4ad8-9cdb-6af8fefa20b2",
      "title": "NES Other Wetlands Non PSW",
      "organizationId": "6f4a3505-772b-436d-9974-7e419b920f48",
      "organizationName": "niagara-region",
      "licenceId": "open-government-license-2-0-niagara-region",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "guid": "https://www.arcgis.com/home/item.html?id=5218826f9b6b4bf090632d9499aeb7b6&sublayer=24"
    },
    "note": "The provider still describes this other-wetlands inventory as DRAFT. Historical/reference evidence only; it does not establish in-force policy, current wetland boundaries, flood safety or environmental clearance.",
    "source": {
      "id": "niagara:niagara-region:draftWetlandReference",
      "name": "NES Other Wetlands Non PSW",
      "url": "https://niagaraopendata.ca/dataset/nes-other-wetlands-non-psw",
      "licence": "Open Government Licence – Niagara Region 2.0",
      "licenceUrl": "https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Region."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "municipalAddresses",
    "group": "addresses",
    "item": "674a3da8e59744a3a9dc89e4d5b3837e",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Address_Points/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Address_Points/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Address Points",
    "expectedLayerName": "OD_ADDRESSPOINTS",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedADDRESS",
      "Street_No": "publishedStreetNo",
      "StreetName": "publishedStreetName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "Street_No": "esriFieldTypeString",
      "StreetName": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-address-points",
      "id": "b30af164-d0e4-4b83-9e5c-ea11cf616fe6",
      "title": "Niagara Falls Address Points",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=674a3da8e59744a3a9dc89e4d5b3837e&sublayer=0"
    },
    "note": "City civic points include secondary and range addresses coincident with a primary parcel point. No individual unit, actual building footprint, surveyed parcel, owner or roll verification.",
    "source": {
      "id": "niagara:niagara-falls:municipalAddresses",
      "name": "Niagara Falls Address Points",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-address-points",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "permits",
    "group": "permits",
    "item": "28f147b68c9447b8bb8e313f82ad5e61",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Completed_Building_Permits/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Completed_Building_Permits/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Completed Building Permits",
    "expectedLayerName": "OD_vw_LM_BuildingPermits_Completed_Public",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "Doc_ID": "publishedDocID",
      "PermitDate": "publishedPermitDate",
      "Address": "publishedAddress",
      "Status": "publishedStatus",
      "PermitType": "publishedPermitType",
      "WorkDesc": "publishedWorkDesc",
      "Year": "publishedYear"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Doc_ID": "esriFieldTypeString",
      "PermitDate": "esriFieldTypeDate",
      "Address": "esriFieldTypeString",
      "Status": "esriFieldTypeString",
      "PermitType": "esriFieldTypeString",
      "WorkDesc": "esriFieldTypeString",
      "Year": "esriFieldTypeSmallInteger"
    },
    "dates": [
      "PermitDate"
    ],
    "matchField": "Address",
    "catalogue": {
      "name": "niagara-falls-completed-building-permits",
      "id": "6c2eb645-1358-4fe1-aa06-874e235306ca",
      "title": "Niagara Falls Completed Building Permits",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=28f147b68c9447b8bb8e313f82ad5e61&sublayer=0"
    },
    "note": "Published completed-permit observations; retain source status, permit date and year separately. Full history, final inspections, occupancy approval and unit legality are unverified. This feed is separate from neighbourhood/year aggregates.",
    "source": {
      "id": "niagara:niagara-falls:permits",
      "name": "Niagara Falls Completed Building Permits",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-completed-building-permits",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "planningApplications",
    "group": "planningApplications",
    "item": "75afadae17774af982d40b65c850659a",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Current_Development_Applications/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Current_Development_Applications/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Current Development Applications",
    "expectedLayerName": "Niagara Falls Current Development Applications",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Address": "publishedAddress",
      "FileNumber": "publishedFileNumber",
      "TypeDesc": "publishedTypeDesc",
      "ApplDesc": "publishedApplDesc",
      "weblink": "publishedWeblink"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Address": "esriFieldTypeString",
      "FileNumber": "esriFieldTypeString",
      "TypeDesc": "esriFieldTypeString",
      "ApplDesc": "esriFieldTypeString",
      "weblink": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-current-development-applications",
      "id": "0b8e0f74-1a2d-44e2-99b7-931671b9c70c",
      "title": "Niagara Falls Current Development Applications",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=75afadae17774af982d40b65c850659a&sublayer=0"
    },
    "note": "Published current-development subject-point polygons; source title does not verify current file activity, decision, conditions or approval. Nearby proposals and closed-file history are unsearched; contact fields excluded.",
    "source": {
      "id": "niagara:niagara-falls:planningApplications",
      "name": "Niagara Falls Current Development Applications",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-current-development-applications",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "municipalHeritageProperties",
    "group": "heritage",
    "item": "99079f954b294c88a615fad33a716253",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Heritage_Properties/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Heritage_Properties/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Heritage Properties",
    "expectedLayerName": "OD_HERITAGEPROPERTIES",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedName",
      "ADDRESS": "publishedADDRESS",
      "Type": "publishedType",
      "DesigBody": "publishedDesigBody",
      "DesigBylaw": "publishedDesigBylaw",
      "Statement": "publishedStatement",
      "Attributes": "publishedAttributes"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "Type": "esriFieldTypeString",
      "DesigBody": "esriFieldTypeString",
      "DesigBylaw": "esriFieldTypeString",
      "Statement": "esriFieldTypeString",
      "Attributes": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-heritage-properties",
      "id": "1895e062-a544-4240-b5a9-a09cb3fcf7f4",
      "title": "Niagara Falls Heritage Properties",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=99079f954b294c88a615fad33a716253&sublayer=0"
    },
    "note": "City listed/designated heritage polygons. Raw Type and bylaw text stay separate; current register, legal instrument, title and alteration permissions require City confirmation.",
    "source": {
      "id": "niagara:niagara-falls:municipalHeritageProperties",
      "name": "Niagara Falls Heritage Properties",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-heritage-properties",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "zoning79200",
    "group": "zoning",
    "item": "7f204d4d8a724032a1e6c8a4a5c4619b",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_79200/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_79200/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Zoning Bylaw 79200",
    "expectedLayerName": "OD_ZONING_B79200",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "BYLAW": "publishedBYLAW",
      "ZONE_ABR": "publishedZONEABR",
      "ZONE_TYPE": "publishedZONETYPE",
      "ZONE_TTL": "publishedZONETTL",
      "BYLAW_NO1": "publishedBYLAWNO1",
      "SPEC_PROV1": "publishedSPECPROV1",
      "SP1": "publishedSP1",
      "AMEND_NO1": "publishedAMENDNO1",
      "BYLAW_NO2": "publishedBYLAWNO2",
      "SPEC_PROV2": "publishedSPECPROV2",
      "SP2": "publishedSP2",
      "AMEND_NO2": "publishedAMENDNO2",
      "BYLAW_NO3": "publishedBYLAWNO3",
      "AMEND_NO3": "publishedAMENDNO3",
      "Spec_Prov3": "publishedSpecProv3",
      "ZONE2_ABR": "publishedZONE2ABR",
      "EXPIRATION": "publishedEXPIRATION",
      "BYLAW_NO4": "publishedBYLAWNO4"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BYLAW": "esriFieldTypeString",
      "ZONE_ABR": "esriFieldTypeString",
      "ZONE_TYPE": "esriFieldTypeString",
      "ZONE_TTL": "esriFieldTypeString",
      "BYLAW_NO1": "esriFieldTypeString",
      "SPEC_PROV1": "esriFieldTypeString",
      "SP1": "esriFieldTypeString",
      "AMEND_NO1": "esriFieldTypeString",
      "BYLAW_NO2": "esriFieldTypeString",
      "SPEC_PROV2": "esriFieldTypeString",
      "SP2": "esriFieldTypeString",
      "AMEND_NO2": "esriFieldTypeString",
      "BYLAW_NO3": "esriFieldTypeString",
      "AMEND_NO3": "esriFieldTypeString",
      "Spec_Prov3": "esriFieldTypeString",
      "ZONE2_ABR": "esriFieldTypeString",
      "EXPIRATION": "esriFieldTypeString",
      "BYLAW_NO4": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-zoning-bylaw-79200",
      "id": "c6f1da75-36bf-40fb-8163-e89c22e5ceea",
      "title": "Niagara Falls Zoning Bylaw 79200",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=7f204d4d8a724032a1e6c8a4a5c4619b&sublayer=0"
    },
    "note": "Published 79-200/Stamford zone and amendment/special-provision references; expiration is raw text, not verified legal currency. Current written rules, holds, exceptions, amendments and appeals are unverified.",
    "source": {
      "id": "niagara:niagara-falls:zoning79200",
      "name": "Niagara Falls Zoning Bylaw 79200",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-zoning-bylaw-79200",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "zoning1538Crowland",
    "group": "legacyZoning",
    "item": "0106e8ac1dc2476b9bc51119e3845320",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_1538_Crowland/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_1538_Crowland/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Zoning Bylaw 1538 Crowland",
    "expectedLayerName": "OD_ZONING_B1538",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "BYLAW": "publishedBYLAW",
      "ZONE_ABR": "publishedZONEABR",
      "ZONE_TTL": "publishedZONETTL",
      "BYLAW_NO1": "publishedBYLAWNO1",
      "AMEND_NO1": "publishedAMENDNO1",
      "SPEC_PROV1": "publishedSPECPROV1",
      "BYLAW_NO2": "publishedBYLAWNO2",
      "AMEND_NO2": "publishedAMENDNO2",
      "SPEC_PROV2": "publishedSPECPROV2",
      "BYLAW_NO3": "publishedBYLAWNO3",
      "AMEND_NO3": "publishedAMENDNO3"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BYLAW": "esriFieldTypeString",
      "ZONE_ABR": "esriFieldTypeString",
      "ZONE_TTL": "esriFieldTypeString",
      "BYLAW_NO1": "esriFieldTypeString",
      "AMEND_NO1": "esriFieldTypeString",
      "SPEC_PROV1": "esriFieldTypeString",
      "BYLAW_NO2": "esriFieldTypeString",
      "AMEND_NO2": "esriFieldTypeString",
      "SPEC_PROV2": "esriFieldTypeString",
      "BYLAW_NO3": "esriFieldTypeString",
      "AMEND_NO3": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-zoning-bylaw-1538-crowland",
      "id": "8a97ccd3-c180-4864-9eb3-b27238109c83",
      "title": "Niagara Falls Zoning Bylaw 1538 Crowland",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=0106e8ac1dc2476b9bc51119e3845320&sublayer=0"
    },
    "note": "Published former-Crowland By-law 1538 zone/amendment references; Historical source reference. A City-hosted November 2025 planning submission describes consolidation under By-law 2025-102 and repeal of Willoughby 395 (1966). Current enacted instruments, applicability and legal permissions remain unverified.",
    "source": {
      "id": "niagara:niagara-falls:zoning1538Crowland",
      "name": "Niagara Falls Zoning Bylaw 1538 Crowland",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-zoning-bylaw-1538-crowland",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "zoning7069Humberstone",
    "group": "legacyZoning",
    "item": "b86cbb3e57fe4c96b08888ed6ecd426d",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_7069_Humberstone/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_7069_Humberstone/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Zoning Bylaw 7069 Humberstone",
    "expectedLayerName": "OD_ZONING_B7069",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "BYLAW": "publishedBYLAW",
      "ZONE_TTL": "publishedZONETTL",
      "BYLAW_NO1": "publishedBYLAWNO1",
      "AMEND_NO1": "publishedAMENDNO1",
      "SPEC_PROV1": "publishedSPECPROV1",
      "BYLAW_NO2": "publishedBYLAWNO2",
      "AMEND_NO2": "publishedAMENDNO2",
      "SPEC_PROV2": "publishedSPECPROV2",
      "BYLAW_NO3": "publishedBYLAWNO3",
      "AMEND_NO3": "publishedAMENDNO3",
      "LABELS": "publishedLABELS"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BYLAW": "esriFieldTypeString",
      "ZONE_TTL": "esriFieldTypeString",
      "BYLAW_NO1": "esriFieldTypeString",
      "AMEND_NO1": "esriFieldTypeString",
      "SPEC_PROV1": "esriFieldTypeString",
      "BYLAW_NO2": "esriFieldTypeString",
      "AMEND_NO2": "esriFieldTypeString",
      "SPEC_PROV2": "esriFieldTypeString",
      "BYLAW_NO3": "esriFieldTypeString",
      "AMEND_NO3": "esriFieldTypeString",
      "LABELS": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-zoning-bylaw-7069-humberstone",
      "id": "3c5ffe25-1db9-477a-804c-cb56e11c4792",
      "title": "Niagara Falls Zoning Bylaw 7069 Humberstone",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=b86cbb3e57fe4c96b08888ed6ecd426d&sublayer=0"
    },
    "note": "Published former-Humberstone By-law 70-69 zone/amendment references; Historical source reference. A City-hosted November 2025 planning submission describes consolidation under By-law 2025-102 and repeal of Willoughby 395 (1966). Current enacted instruments, applicability and legal permissions remain unverified.",
    "source": {
      "id": "niagara:niagara-falls:zoning7069Humberstone",
      "name": "Niagara Falls Zoning Bylaw 7069 Humberstone",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-zoning-bylaw-7069-humberstone",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "zoningB0395Willoughby",
    "group": "legacyZoning",
    "item": "80d5822736ef41b5957b2e163ec76677",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_B0395_Willoughby/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Zoning_Bylaw_B0395_Willoughby/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Zoning Bylaw B0395 Willoughby",
    "expectedLayerName": "OD_ZONING_B0395",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "BYLAW": "publishedBYLAW",
      "ZONE_ABR": "publishedZONEABR",
      "ZONE_TTL": "publishedZONETTL",
      "BYLAW_NO1": "publishedBYLAWNO1",
      "AMEND_NO1": "publishedAMENDNO1",
      "SPEC_PROV1": "publishedSPECPROV1",
      "BYLAW_NO2": "publishedBYLAWNO2",
      "AMEND_NO2": "publishedAMENDNO2",
      "SPEC_PROV2": "publishedSPECPROV2",
      "BYLAW_NO3": "publishedBYLAWNO3",
      "AMEND_NO3": "publishedAMENDNO3",
      "LABELS": "publishedLABELS",
      "TEMPEXPDAT": "publishedTEMPEXPDAT"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BYLAW": "esriFieldTypeString",
      "ZONE_ABR": "esriFieldTypeString",
      "ZONE_TTL": "esriFieldTypeString",
      "BYLAW_NO1": "esriFieldTypeString",
      "AMEND_NO1": "esriFieldTypeString",
      "SPEC_PROV1": "esriFieldTypeString",
      "BYLAW_NO2": "esriFieldTypeString",
      "AMEND_NO2": "esriFieldTypeString",
      "SPEC_PROV2": "esriFieldTypeString",
      "BYLAW_NO3": "esriFieldTypeString",
      "AMEND_NO3": "esriFieldTypeString",
      "LABELS": "esriFieldTypeString",
      "TEMPEXPDAT": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-zoning-bylaw-b0395-willoughby",
      "id": "508a11c6-b244-4d43-a555-b72da4fb026e",
      "title": "Niagara Falls Zoning Bylaw B0395 Willoughby",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=80d5822736ef41b5957b2e163ec76677&sublayer=0"
    },
    "note": "Published former-Willoughby By-law 395 (1966) zone/amendment references; Historical source reference. A City-hosted November 2025 planning submission describes consolidation under By-law 2025-102 and repeal of Willoughby 395 (1966). Current enacted instruments, applicability and legal permissions remain unverified.",
    "source": {
      "id": "niagara:niagara-falls:zoningB0395Willoughby",
      "name": "Niagara Falls Zoning Bylaw B0395 Willoughby",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-zoning-bylaw-b0395-willoughby",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "officialPlanLandUse",
    "group": "officialPlan",
    "item": "52f60b14c49847a5bbf1eaa52261eff7",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Official_Plan_Schedule_A_Land_Use/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Official_Plan_Schedule_A_Land_Use/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Official Plan Schedule A Land Use",
    "expectedLayerName": "OD_OFFICIALPLAN_LANDUSE",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "DESIGNAT": "publishedDESIGNAT"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "DESIGNAT": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-official-plan-schedule-a-land-use",
      "id": "74d51878-33a6-4ae0-b00b-13e9b476ef86",
      "title": "Niagara Falls Official Plan Schedule A Land Use",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=52f60b14c49847a5bbf1eaa52261eff7&sublayer=0"
    },
    "note": "Published City Official Plan Schedule A reference mapping; verify current legal schedules, written policies, amendments and appeals separately from the Niagara Official Plan now belonging to local municipalities.",
    "source": {
      "id": "niagara:niagara-falls:officialPlanLandUse",
      "name": "Niagara Falls Official Plan Schedule A Land Use",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-official-plan-schedule-a-land-use",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "specialPolicyAreas",
    "group": "officialPlan",
    "item": "a27edf2ae6964e9da24057a7e08fc8d7",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Official_Plan_Special_Policy_Areas/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Official_Plan_Special_Policy_Areas/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Official Plan Special Policy Areas",
    "expectedLayerName": "OD_OFFICIALPLAN_SPECIALPOLICYAREA",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Number": "publishedNumber"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Number": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-official-plan-special-policy-areas",
      "id": "5a0ba6df-158b-48d9-87d3-f711482791ed",
      "title": "Niagara Falls Official Plan Special Policy Areas",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=a27edf2ae6964e9da24057a7e08fc8d7&sublayer=0"
    },
    "note": "Published City special-policy area numbers; policy text, boundaries and current applicability remain unverified.",
    "source": {
      "id": "niagara:niagara-falls:specialPolicyAreas",
      "name": "Niagara Falls Official Plan Special Policy Areas",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-official-plan-special-policy-areas",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  },
  {
    "publisher": "falls",
    "market": "Niagara Falls",
    "key": "brownfieldCIP",
    "group": "communityImprovement",
    "item": "f92c4d987c324b74b73bc3882d83a215",
    "url": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Brownfield_CIP_Area_2026/FeatureServer/0",
    "rootUrl": "https://services9.arcgis.com/oMFQlUUrLd1Uh1bd/arcgis/rest/services/Niagara_Falls_Brownfield_CIP_Area_2026/FeatureServer",
    "owner": "opendata@niagarafalls.ca",
    "org": "oMFQlUUrLd1Uh1bd",
    "expectedItemTitle": "Niagara Falls Brownfield CIP Area 2026",
    "expectedLayerName": "Niagara Falls Brownfield CIP Area 2026",
    "expectedCopyright": "City of Niagara Falls",
    "termsHash": "12a0015fa32217778863154566bce500732726db6ea596518712c12955d9a225",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "Descrip": "publishedDescrip"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Descrip": "esriFieldTypeString"
    },
    "dates": [],
    "catalogue": {
      "name": "niagara-falls-brownfield-cip-area-2026",
      "id": "cab5a33f-ea13-442f-a11d-13ba89e8956c",
      "title": "Niagara Falls Brownfield CIP Area 2026",
      "organizationId": "38a4e2bc-b8c3-4b88-ab3b-1a17caffa78c",
      "organizationName": "city-of-niagara-falls",
      "licenceId": "open-government-license-2-0-niagara-falls",
      "licenceUrl": "https://niagara.oggtestbed.com/pages/open-government-license-2-0-niagara-falls",
      "guid": "https://www.arcgis.com/home/item.html?id=f92c4d987c324b74b73bc3882d83a215&sublayer=0"
    },
    "note": "Published brownfield community-improvement area described by the City as By-law 2026-005. Mapping does not establish contamination, clean-up, current funding, eligibility, an approved grant or development rights.",
    "source": {
      "id": "niagara:niagara-falls:brownfieldCIP",
      "name": "Niagara Falls Brownfield CIP Area 2026",
      "url": "https://niagaraopendata.ca/dataset/niagara-falls-brownfield-cip-area-2026",
      "licence": "Open Government Licence – Niagara Falls 1.0",
      "licenceUrl": "https://open.niagarafalls.ca/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – Niagara Falls."
    }
  }
];
export const NIAGARA_WITHHELD=[
  {
    "market": "St. Catharines",
    "layer": "permits",
    "item": "83f3b80be17a4fd29c58529dc945f371",
    "url": "https://niagaraopendata.ca/dataset/building-permits-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "St. Catharines",
    "layer": "municipalBoundary",
    "item": "3b49f075ac254bf4baa70c87bf013190",
    "url": "https://niagaraopendata.ca/dataset/city-limits-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "St. Catharines",
    "layer": "officialPlan",
    "item": "f8807601fd6f48f584926fc3cc97d155",
    "url": "https://niagaraopendata.ca/dataset/city-parcel-landuse-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "St. Catharines",
    "layer": "zoning",
    "item": "14be47564b394e06b089e03f195e4e6e",
    "url": "https://niagaraopendata.ca/dataset/city-parcel-zoning-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "St. Catharines",
    "layer": "heritage",
    "item": "d36ddf7e0616429581c01c81d14d9dc3",
    "url": "https://niagaraopendata.ca/dataset/heritage-properties-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "St. Catharines",
    "layer": "parcelReference",
    "item": "3ad4b809f2a64d4eada53b63e3ac2901",
    "url": "https://niagaraopendata.ca/dataset/parcel-fabric-public",
    "reason": "The City catalogue names a licence, but its exact linked page currently returns a Pages index without the full grant. Underlying item terms are blank; no source records or counts are queried."
  },
  {
    "market": "Niagara Falls",
    "layer": "municipalBoundary",
    "item": "01626ef413db459ea27d9f6eeb9ba360",
    "reason": "Licensed City municipal boundary is a partial polyline and omits the international boundary. It is unsuitable for a unique interior municipality gate and is not queried or counted; the licensed regional polygon is used instead."
  },
  {
    "market": "Niagara Region",
    "layer": "conservation",
    "url": "https://npca.ca/services/permits",
    "reason": "Current NPCA regulatory boundaries and property-level permit requirements have not been verified as reusable machine-readable data. Regional inventories and watersheds are separate reference evidence."
  },
  {
    "market": "Niagara Region",
    "layer": "provincialNaturalHeritageProxy",
    "item": "38a75fcf255e4f9ab7cbf0c9e1626ab6",
    "reason": "Province-origin natural-heritage proxy grant/current lineage requires a separate audit; it is not queried or counted. Existing direct provincial planning screens remain separate."
  },
  {
    "market": "Niagara Region",
    "layer": "draftWatercourseReference",
    "item": "5aa28591e719407a844e3c571575628d",
    "reason": "Provider still labels this line inventory DRAFT; current policy and exact parcel-watercourse relation remain unverified. It is excluded from this batch pending a separate proximity and source-lineage audit."
  }
];
