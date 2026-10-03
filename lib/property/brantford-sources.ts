import type { Source } from "./model";
export interface BrantfordFeed { key:string; item:string; itemUrl:string; expectedItemType:string; expectedAccessInformation:string|null; rootUrl:string; url:string; child:number; expectedItemTitle:string; expectedLayerName:string; geometry:string; oid:string; expectedRootServiceItem:string|null; expectedServiceItem:string|null; expectedRootCopyright:string; expectedCopyright:string; rootDescriptionHash:string; descriptionHash:string; itemDescriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; matchField?:string; note:string; source:Source; }
export const BRANTFORD_GRANT={
  "site": "eadaa720fa834985b601a6d013d6fc20",
  "siteTitle": "City of Brantford Open Data",
  "siteOwner": "YWang@brantford.ca_Brantford",
  "org": null,
  "siteUrl": "https://brantfordopendata-brantford.hub.arcgis.com",
  "defaultHostname": "brantfordopendata-brantford.hub.arcgis.com",
  "group": "8fd4b7dc6a5848aca4d2e3b0a431894c",
  "groupTitle": "City of Brantford Open Data",
  "groupOwner": "sj_hall",
  "page": "c3382064290946129d12fe7de7adaf64",
  "pageTitle": "Open Data License",
  "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
  "fullGrantHash": "9287db2978651ab29339a8b049507cba0491f2e238dcc23666e0ee13e2ed3842",
  "officialOffer": "https://www.brantford.ca/your-government/open-data/",
  "officialLicence": "https://www.brantford.ca/your-government/open-data/open-data-licence/",
  "publisher": "CoBOpenData",
  "serviceOrg": "aji2lCmjXt0KpGzI"
};
export const BRANTFORD_FEEDS:BrantfordFeed[]=[
  {
    "key": "municipality",
    "item": "ef2ef67a61e34a6ca5a5e5ad2ed57cc9",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Municipal_Boundaries/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Municipal_Boundaries/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Municipal_Boundaries/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Municipal Boundary",
    "expectedLayerName": "OP_Municipal_Boundaries",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "ef2ef67a61e34a6ca5a5e5ad2ed57cc9",
    "expectedServiceItem": "ef2ef67a61e34a6ca5a5e5ad2ed57cc9",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "3966ea22e46b554b9187a3483a861733ef22c53f05bd7b0dc05005a91205bdeb",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "3966ea22e46b554b9187a3483a861733ef22c53f05bd7b0dc05005a91205bdeb",
    "termsHash": "2c9ec0a33b4c8260d12965a048034ab5479b13bc4566590dbc36a099b7baaa13",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedMunicipality"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString"
    },
    "note": "Published municipal boundary reference. Current legal boundary and expansion-land coverage are unverified.",
    "source": {
      "id": "brantford:municipality",
      "name": "Brantford — Municipal Boundary",
      "url": "https://www.arcgis.com/home/item.html?id=ef2ef67a61e34a6ca5a5e5ad2ed57cc9",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "municipalAddresses",
    "item": "8fa270cb0c174bd99b52a11260f60f15",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Site_Addresses2/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": " ",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Site_Addresses2/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Site_Addresses2/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Site Addresses 2",
    "expectedLayerName": "OP_Site_Addresses2",
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "8fa270cb0c174bd99b52a11260f60f15",
    "expectedServiceItem": "8fa270cb0c174bd99b52a11260f60f15",
    "expectedRootCopyright": "Credit to Dave",
    "expectedCopyright": "",
    "rootDescriptionHash": "3045b9ed4d74f68e64b981951976888650286e70f8fb9cb9ba752a1a1027e46c",
    "descriptionHash": "e19db200ec9581294f4b81c5c1083a4ec01651dbef6942bc0c277b01996098ba",
    "itemDescriptionHash": "c922df9a7e9860b06c5c6632ef1b11ac3ffb1224df50a20d924a460e643ecc9e",
    "termsHash": "e017713118f5bb58c005a7203b9f80c61543358fcc5210924c14ec572074778e",
    "fields": {
      "OBJECTID": "recordId",
      "FULLADDRESS": "publishedAddress",
      "STREETNUM": "publishedStreetNumber",
      "STNUMSUFF": "publishedNumberSuffix",
      "STREETNAME": "publishedStreetName",
      "STREETTYPE": "publishedStreetType",
      "POSTALCODE": "publishedPostalCode"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "FULLADDRESS": "esriFieldTypeString",
      "STREETNUM": "esriFieldTypeString",
      "STNUMSUFF": "esriFieldTypeString",
      "STREETNAME": "esriFieldTypeString",
      "STREETTYPE": "esriFieldTypeString",
      "POSTALCODE": "esriFieldTypeString"
    },
    "matchField": "FULLADDRESS",
    "note": "Unique strict City civic attribute match only. Published full civic address and components must agree. Generic source point geometry is not reused as building/GPS, unit or cadastral identity.",
    "source": {
      "id": "brantford:municipalAddresses",
      "name": "Brantford — Site Addresses 2",
      "url": "https://www.arcgis.com/home/item.html?id=8fa270cb0c174bd99b52a11260f60f15",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "catalogueZoningReference",
    "item": "9109012f6418496682621b59e1f6f177",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Zoning_District/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Zoning_District/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Zoning_District/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Zoning Districts",
    "expectedLayerName": "OP_Zoning_District",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "9109012f6418496682621b59e1f6f177",
    "expectedServiceItem": "9109012f6418496682621b59e1f6f177",
    "expectedRootCopyright": "Credit to Dave",
    "expectedCopyright": "",
    "rootDescriptionHash": "3045b9ed4d74f68e64b981951976888650286e70f8fb9cb9ba752a1a1027e46c",
    "descriptionHash": "8bdeda988d79bfed98c7f49ed9cd7d8aaa1377b2e322e91e8e5dc65a5075cdff",
    "itemDescriptionHash": "77f639135ddec8a92d832c7b1644d49a412379f52cde03b172151d5298e5d15d",
    "termsHash": "2c9ec0a33b4c8260d12965a048034ab5479b13bc4566590dbc36a099b7baaa13",
    "fields": {
      "OBJECTID": "recordId",
      "ZONECLASS": "publishedZoneClass",
      "ZONEDESC": "publishedZoneDescription"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZONECLASS": "esriFieldTypeString",
      "ZONEDESC": "esriFieldTypeString"
    },
    "note": "Open-catalogue zoning district reference with a 2023 data observation date, separate from the September 2026 item/schema edit. The governing bylaw and current applicability of this separate catalogue feed are unverified. Do not substitute it for the current 124-2024 map, remaining site-specific appeals or 56-2026 interim control area. Published labels do not establish permitted use, numeric limits or development permission.",
    "source": {
      "id": "brantford:catalogueZoningReference",
      "name": "Brantford — Zoning Districts",
      "url": "https://www.arcgis.com/home/item.html?id=9109012f6418496682621b59e1f6f177",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "ward",
    "item": "bd2baf69507b46479683fae5946f4f2c",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Voting_District/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Voting_District/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Voting_District/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Ward Boundaries",
    "expectedLayerName": "OP_Voting_District",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "bd2baf69507b46479683fae5946f4f2c",
    "expectedServiceItem": "bd2baf69507b46479683fae5946f4f2c",
    "expectedRootCopyright": "Credit to Dave",
    "expectedCopyright": "",
    "rootDescriptionHash": "3045b9ed4d74f68e64b981951976888650286e70f8fb9cb9ba752a1a1027e46c",
    "descriptionHash": "f637ccc7edbe9ac1ae4ad2d6b6115473534df3480d39fce903ed418f31a77725",
    "itemDescriptionHash": "f99fffeb5d1dedfc5b85f1122b234ed7d21680687c5a70cae2f3cd7fb873a459",
    "termsHash": "2c9ec0a33b4c8260d12965a048034ab5479b13bc4566590dbc36a099b7baaa13",
    "fields": {
      "OBJECTID": "recordId",
      "WARD": "publishedWard",
      "WARD_NAME": "publishedWardName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "WARD": "esriFieldTypeSmallInteger",
      "WARD_NAME": "esriFieldTypeString"
    },
    "note": "Published catalogue ward reference only. Current electoral boundaries and councillor identity are unverified.",
    "source": {
      "id": "brantford:ward",
      "name": "Brantford — Ward Boundaries",
      "url": "https://www.arcgis.com/home/item.html?id=bd2baf69507b46479683fae5946f4f2c",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "buildingFootprintReference",
    "item": "51c33215a26740f79c69d35e7368ce01",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Building_Footprints/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Building_Footprints/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Building_Footprints/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Building Footprints",
    "expectedLayerName": "OP_Building_Footprints",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "51c33215a26740f79c69d35e7368ce01",
    "expectedServiceItem": "51c33215a26740f79c69d35e7368ce01",
    "expectedRootCopyright": "Credit to Dave",
    "expectedCopyright": "",
    "rootDescriptionHash": "3045b9ed4d74f68e64b981951976888650286e70f8fb9cb9ba752a1a1027e46c",
    "descriptionHash": "bffdad0745be0bcd0e1a0df290b0bb0ca87c531af30af0a03ebd71b8f915bafc",
    "itemDescriptionHash": "18db028e9e784034632953d1af0e08ffeef80e2ef7942ec76dbd009d5b620408",
    "termsHash": "2c9ec0a33b4c8260d12965a048034ab5479b13bc4566590dbc36a099b7baaa13",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "note": "Published catalogue footprint polygons with a 2023 data observation date intersecting the independently supplied point. No area, perimeter, geometry, building identity, construction year, storeys, current building condition or surveyed property measurements are returned. This reference is not cadastral identity or proof of the present-day building footprint.",
    "source": {
      "id": "brantford:buildingFootprintReference",
      "name": "Brantford — Building Footprints",
      "url": "https://www.arcgis.com/home/item.html?id=51c33215a26740f79c69d35e7368ce01",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "waterBodyReference",
    "item": "7eee0a7b51004d509920c3014e7322fc",
    "itemUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Water_Bodies/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedAccessInformation": "",
    "rootUrl": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Water_Bodies/FeatureServer",
    "url": "https://services.arcgis.com/aji2lCmjXt0KpGzI/arcgis/rest/services/OP_Water_Bodies/FeatureServer/0",
    "child": 0,
    "expectedItemTitle": "City of Brantford Water Bodies",
    "expectedLayerName": "OP_Water_Bodies",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootServiceItem": "7eee0a7b51004d509920c3014e7322fc",
    "expectedServiceItem": "7eee0a7b51004d509920c3014e7322fc",
    "expectedRootCopyright": "Credit to Dave",
    "expectedCopyright": "",
    "rootDescriptionHash": "3045b9ed4d74f68e64b981951976888650286e70f8fb9cb9ba752a1a1027e46c",
    "descriptionHash": "1d19bc3b290e0bbc2bc0c02704a9689e98f64e3feb89b49e8b6f0192f598c566",
    "itemDescriptionHash": "0fb2c8bf1d6a056b03edeeb52065dcf3bdcae2dd8cfdb9c7bdea30ffb9992cd9",
    "termsHash": "2c9ec0a33b4c8260d12965a048034ab5479b13bc4566590dbc36a099b7baaa13",
    "fields": {
      "OBJECTID": "recordId",
      "TYPE": "publishedWaterBodyType"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "TYPE": "esriFieldTypeString"
    },
    "note": "Published catalogue water-body polygon reference with a 2023 data observation date at the subject point. This is not floodplain, conservation-regulation, erosion, drinking-water, shoreline setback, insurance or safety screening. No parcel-wide clearance or absence is established.",
    "source": {
      "id": "brantford:waterBodyReference",
      "name": "Brantford — Water Bodies",
      "url": "https://www.arcgis.com/home/item.html?id=7eee0a7b51004d509920c3014e7322fc",
      "licence": "Open Data License – Brantford 1.0",
      "licenceUrl": "https://brantfordopendata-brantford.hub.arcgis.com/pages/c3382064290946129d12fe7de7adaf64",
      "attribution": "Contains information licensed under the Open Data License – Brantford. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  }
];
export const BRANTFORD_WITHHELD=[
  {
    "layer": "permits",
    "url": "https://www.buildbrantford.ca/building-and-construction/building-permits-map/",
    "item": "9bff1f19c4b34f2688566fee7d85bb8f",
    "reason": "The official City dashboard references a separate public permit view with blank item grant/credits/description, outside the inspected City open catalogue. Anonymous reuse binding is unverified; no record or count query is performed. Full history, inspection and occupancy records remain unverified."
  },
  {
    "layer": "planningApplications",
    "url": "https://www.buildbrantford.ca/planning-and-development-services/planning-applications-data/",
    "item": "939767a48a194b6699554d08bfff8d2e",
    "reason": "The official planning dashboard references a separate public view with blank item grant/credits/description, outside the inspected open catalogue. No record/count query is performed; public dashboard access does not establish anonymous redistribution rights or complete current decisions."
  },
  {
    "layer": "zoning",
    "url": "https://www.buildbrantford.ca/planning-and-development-services/zoning/",
    "reason": "Current 124-2024 Schedule A, parking, railway/flood overlays, former regimes and 56-2026 interim-control map items have blank grants and are outside the inspected City open catalogue. The separate catalogue zoning labels do not establish current applicability, written rules, exceptions, site-specific appeals or permission."
  },
  {
    "layer": "currentPlanningInstruments",
    "url": "https://www.buildbrantford.ca/planning-and-development-services/official-plan/",
    "reason": "Current Official Plan schedules, amendments/appeals, 2026 review and current 56-2026 interim-control applicability are not machine-verified. Current legal instruments must be confirmed separately from catalogue GIS labels."
  },
  {
    "layer": "heritage",
    "url": "https://www.buildbrantford.ca/planning-and-development-services/heritage-planning/heritage-register-project/",
    "reason": "Part IV, Part V district and six listed-property documents are published separately on the City website; a complete attributed property-level reuse adapter and current register/instrument audit are not established. No blanket open-catalogue grant is applied to those files."
  },
  {
    "layer": "parcel",
    "url": "https://www.arcgis.com/home/item.html?id=32bd4ebc8b334962a93e4c598d8dc158",
    "reason": "The City-curated fabric has a generic See Licence reference and placeholder originating credit. Current cadastral identity, third-party origin, survey accuracy and legal parcel/measurement reuse are unverified; no fabric record, geometry or count query is performed."
  },
  {
    "layer": "additionalUnits",
    "url": "https://www.buildbrantford.ca/planning-and-development-services/accessory-dwelling-unit/",
    "reason": "General accessory-dwelling guidance is separate from an exact property registration, final inspection, occupancy and current legal-unit record; no licensed property register was found in the inspected catalogue."
  },
  {
    "layer": "brantfordConservationRegulation",
    "url": "https://www.grandriver.ca/planning-development/map-your-property/",
    "reason": "City catalogue water bodies are not GRCA regulatory mapping. Current originating conservation-authority rights, parcel-wide regulation and planned-work permissions require a separate audit."
  }
];
