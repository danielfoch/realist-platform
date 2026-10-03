import type { Source } from "./model";
export const QUINTEWEST_WITHHELD = [
  { layer: "municipalAddresses", url: "https://quintewest.ca/quinte-west-maps/", reason: "The general public GIS includes 911 addresses but is explicitly personal/non-commercial. No civic-register feed in the inspected open portal establishes reusable precise building identity. National address evidence remains separate." },
  { layer: "permits", url: "https://quintewest.ca/building-renovating/building-permits/", reason: "The City publishes application/inspection guidance and an e-permit workflow. No complete licensed property permit, final-inspection or occupancy history was found in the inspected open portal; no permit records/counts are queried." },
  { layer: "zoning", url: "https://quintewest.ca/planning-development-business/zoning-bylaw/", reason: "Current zoning GIS is outside the inspected licensed open catalogue and general GIS has personal/non-commercial restrictions. Written provisions, exceptions, holds, amendments and appeals require separate confirmation. The fall 2026 comprehensive review is background work, not adopted new permissions." },
  { layer: "planningApplications", url: "https://quintewest.ca/quinte-west-maps/", reason: "The official page links a separate development-application map. Its exact originating reuse binding and complete current decisions/conditions are unverified; the topographic open-data licence is not extended to separate general-GIS apps." },
  { layer: "currentPlanningInstruments", url: "https://quintewest.ca/planning-development-business/official-plan/", reason: "The City identifies the 2024 Official Plan approved with modifications Oct. 9, 2024 and warns electronic documents may not be exact/current. Current schedules, amendments, appeals and draft ARU provisions require official instruments; no machine-verified property permission is returned." },
  { layer: "heritage", url: "https://quintewest.ca/planning-development-business/heritage-properties/", reason: "A separate City heritage page names designated properties. A complete current register, designation/district instruments and exact attributed reuse adapter are not established by the inspected topographic catalogue." },
  { layer: "parcel", url: "https://quintewest.ca/quinte-west-maps/", reason: "Public GIS property lines are illustrative and not a legal survey, with separate reuse restrictions. Exact cadastral origin/rights and legal parcel identity remain unverified; no parcel records/geometry/counts are queried." },
  { layer: "additionalUnits", url: "https://quintewest.ca/planning-development-business/official-plan/", reason: "The City links a draft ARU Official Plan amendment separately from current adopted instruments. No licensed property registration/final-inspection/occupancy register was found in the inspected open portal; advertised-unit legality is not established." },
  { layer: "quintewestConservationRegulation", url: "https://quintewest.ca/planning-development-business/official-plan/", reason: "Nearby pond/park references are not regulatory mapping. Current originating conservation-authority rights, parcel-wide floodplain/regulation and planned-work requirements need a separate audit." },
  { layer: "contourReference", url: "https://www.arcgis.com/home/item.html?id=caa0285ff37f43ad8f39cc6d5fa4ff44", reason: "City-curated 1-metre contours derive a 2022 DTM and expressly are not survey-grade. Originating NRCan grant, units, vertical datum and derivation coverage remain unverified; no contour record, geometry or count queries are performed." },
  { layer: "elevationReference", url: "https://www.arcgis.com/home/item.html?id=3a799491489f49a2b03861c188f5c41d", reason: "City-curated 10-metre grid points derive a 2022 DTM and expressly are not survey-grade. Originating source metadata access returned HTTP403; no bypass is attempted. Units, vertical datum and originating rights remain unverified; no elevation record, geometry or count queries are performed." },
];
export interface QuinteWestFeed { key:string; item:string; itemUrl:string; expectedItemType:string; expectedItemTitle:string; expectedOrg:string|null; expectedAccessInformation:string|null; rootUrl:string; url:string; child:number; expectedLayerName:string; geometry:string; oid:string; expectedRootServiceItem:string|null; expectedServiceItem:string|null; expectedRootCopyright:string; expectedCopyright:string; rootDescriptionHash:string; descriptionHash:string; itemDescriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; radiusMeters:number; note:string; source:Source; }
export const QUINTEWEST_GRANT={
  "site": "322171584bf84dcc947b4d39fe5a99b7",
  "siteTitle": "City of Quinte West Open GIS Data Portal",
  "siteType": "Web Mapping Application",
  "owner": "QW_GISAdmin",
  "org": "cpi3xYswHz1VWunb",
  "siteUrl": "https://geodata-quintewest.opendata.arcgis.com",
  "groups": [
    "1be07a41c439423daed55683afe044ef",
    "6a7b76671e844b758033481d6b4f4bf2"
  ],
  "group": "1be07a41c439423daed55683afe044ef",
  "groupTitle": "City of Quinte West Open Data",
  "siteTermsHash": "3a4bb98c7a1df7f3fa7b366cb2f6ac3b2b31bcdd167fe843b753da35954ebe64",
  "offerHash": "69d6f6c5ff63f1b26536f2d98d8cb102f121926d8791e9301da90ed23b188206",
  "licenceItem": "2d74bbcab91441209f5669908ec31ad6",
  "licenceUrl": "https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data",
  "licenceHash": "ef0176520306ff1ebbe3a3a716eb70f15fe5ae50a5df8463d4a1affb8c046141",
  "licenceFileRedirect": { "origin": "https://www.arcgis.com", "pathname": "/itemdata/92d347a7683b26a11dab76ccf9a5cac2/2d74bbcab91441209f5669908ec31ad6/City_of_Quinte_West_Open_Data_Licence_1.pdf" },
  "officialOffer": "https://quintewest.ca/quinte-west-maps/"
};
export const QUINTEWEST_FEEDS:QuinteWestFeed[]=[
  {
    "key": "buildingFootprintReference",
    "item": "59c6e1661961437e885f949a01f31bd6",
    "itemUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/large_buildings_2019/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedItemTitle": "Building Footprints in the City of Quinte West",
    "expectedOrg": "cpi3xYswHz1VWunb",
    "expectedAccessInformation": "City of Quinte West GIS Division",
    "rootUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/large_buildings_2019/FeatureServer",
    "url": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/large_buildings_2019/FeatureServer/0",
    "child": 0,
    "expectedLayerName": "Buildings",
    "geometry": "esriGeometryPolygon",
    "oid": "objectid",
    "expectedRootServiceItem": "59c6e1661961437e885f949a01f31bd6",
    "expectedServiceItem": "59c6e1661961437e885f949a01f31bd6",
    "expectedRootCopyright": "City of Quinte West GIS Division",
    "expectedCopyright": "",
    "rootDescriptionHash": "9a0ea6d48fb5e002b79eb858231cc66fa2cab4518e7c60d0070c3bd633063b56",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "9a0ea6d48fb5e002b79eb858231cc66fa2cab4518e7c60d0070c3bd633063b56",
    "termsHash": "8a97b4c19f2d7011e0e681e2322f6c9fc0bf63ef6e58bc5ff2e3fad4a40e1baa",
    "fields": {
      "objectid": "recordId"
    },
    "fieldTypes": {
      "objectid": "esriFieldTypeOID"
    },
    "radiusMeters": 0,
    "note": "Published footprint polygons intersecting the independent subject point. Source observation/imagery vintage, present-day footprint and address/building identity are unverified. No area, geometry, height, floors, age, condition or legal-unit facts are returned.",
    "source": {
      "id": "quintewest:buildingFootprintReference",
      "name": "Quinte West — Building Footprints in the City of Quinte West",
      "url": "https://www.arcgis.com/home/item.html?id=59c6e1661961437e885f949a01f31bd6",
      "licence": "City of Quinte West Open Data Licence 1.0",
      "licenceUrl": "https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data",
      "attribution": "Contains information licensed under the Open Data Licence – City of Quinte West. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "parkReference",
    "item": "2390b2941eda4a75822a41285217e3d3",
    "itemUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Parks__AM_public_view/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedItemTitle": "Parks_ AM_public_view",
    "expectedOrg": "cpi3xYswHz1VWunb",
    "expectedAccessInformation": null,
    "rootUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Parks__AM_public_view/FeatureServer",
    "url": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Parks__AM_public_view/FeatureServer/157",
    "child": 157,
    "expectedLayerName": "Parks",
    "geometry": "esriGeometryPolygon",
    "oid": "FID",
    "expectedRootServiceItem": "2390b2941eda4a75822a41285217e3d3",
    "expectedServiceItem": "2390b2941eda4a75822a41285217e3d3",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "22b6ac3bfb032390291228f5cbe07bf2bda9e117af5233d1b97fb1d66d0d49af",
    "fields": {
      "FID": "recordId",
      "park_name": "publishedParkName",
      "AssetID": "publishedAssetId",
      "Location": "publishedLocation",
      "Class": "publishedClass"
    },
    "fieldTypes": {
      "FID": "esriFieldTypeOID",
      "park_name": "esriFieldTypeString",
      "AssetID": "esriFieldTypeString",
      "Location": "esriFieldTypeString",
      "Class": "esriFieldTypeString"
    },
    "radiusMeters": 1000,
    "note": "Published park polygons intersecting a 1,000-metre search buffer. Not assigned to the subject property. The result is not a walking route, nearest-park ranking, access/amenity guarantee or neighbourhood recommendation.",
    "source": {
      "id": "quintewest:parkReference",
      "name": "Quinte West — Parks_ AM_public_view",
      "url": "https://www.arcgis.com/home/item.html?id=2390b2941eda4a75822a41285217e3d3",
      "licence": "City of Quinte West Open Data Licence 1.0",
      "licenceUrl": "https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data",
      "attribution": "Contains information licensed under the Open Data Licence – City of Quinte West. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "stormwaterReference",
    "item": "1e4014214ea149b29e86ff5f97bc199a",
    "itemUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Stormwater_Pond_AM_Public_view/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedItemTitle": "Stormwater_Pond_AM Public view",
    "expectedOrg": "cpi3xYswHz1VWunb",
    "expectedAccessInformation": null,
    "rootUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Stormwater_Pond_AM_Public_view/FeatureServer",
    "url": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/Stormwater_Pond_AM_Public_view/FeatureServer/1",
    "child": 1,
    "expectedLayerName": "Stormwater_Pond",
    "geometry": "esriGeometryPolygon",
    "oid": "FID",
    "expectedRootServiceItem": "1e4014214ea149b29e86ff5f97bc199a",
    "expectedServiceItem": "1e4014214ea149b29e86ff5f97bc199a",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "22b6ac3bfb032390291228f5cbe07bf2bda9e117af5233d1b97fb1d66d0d49af",
    "fields": {
      "FID": "recordId",
      "class": "publishedClass",
      "Asset_ID": "publishedAssetId"
    },
    "fieldTypes": {
      "FID": "esriFieldTypeOID",
      "class": "esriFieldTypeString",
      "Asset_ID": "esriFieldTypeString"
    },
    "radiusMeters": 1000,
    "note": "Published stormwater-pond polygons intersecting a 1,000-metre search buffer. Not assigned to the subject property. This is not drainage, floodplain, conservation regulation, property risk, insurance or clearance screening.",
    "source": {
      "id": "quintewest:stormwaterReference",
      "name": "Quinte West — Stormwater_Pond_AM Public view",
      "url": "https://www.arcgis.com/home/item.html?id=1e4014214ea149b29e86ff5f97bc199a",
      "licence": "City of Quinte West Open Data Licence 1.0",
      "licenceUrl": "https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data",
      "attribution": "Contains information licensed under the Open Data Licence – City of Quinte West. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  },
  {
    "key": "nearbySchools",
    "item": "abcb4687fae64adab23cfc35412414eb",
    "itemUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/schoolslayer/FeatureServer",
    "expectedItemType": "Feature Service",
    "expectedItemTitle": "Quinte West Schools",
    "expectedOrg": "cpi3xYswHz1VWunb",
    "expectedAccessInformation": "",
    "rootUrl": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/schoolslayer/FeatureServer",
    "url": "https://services3.arcgis.com/cpi3xYswHz1VWunb/arcgis/rest/services/schoolslayer/FeatureServer/0",
    "child": 0,
    "expectedLayerName": "Schools",
    "geometry": "esriGeometryPoint",
    "oid": "objectid",
    "expectedRootServiceItem": "abcb4687fae64adab23cfc35412414eb",
    "expectedServiceItem": "abcb4687fae64adab23cfc35412414eb",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "d8803ff8bb776fb0fd7984c7cc1fb0e0be798e8ca4ed089e7c598ad2f2695fba",
    "termsHash": "aa8d13d251dbe0040370eae16998bb8e40c311925d309371c618f87381f88963",
    "fields": {
      "objectid": "recordId",
      "school_nam": "publishedSchoolName"
    },
    "fieldTypes": {
      "objectid": "esriFieldTypeOID",
      "school_nam": "esriFieldTypeString"
    },
    "radiusMeters": 1000,
    "note": "Published school-location points within a 1,000-metre search buffer. Not assigned to the property. No catchment, enrolment, capacity, performance, walking route, nearest-school ranking or neighbourhood recommendation is established.",
    "source": {
      "id": "quintewest:nearbySchools",
      "name": "Quinte West — Quinte West Schools",
      "url": "https://www.arcgis.com/home/item.html?id=abcb4687fae64adab23cfc35412414eb",
      "licence": "City of Quinte West Open Data Licence 1.0",
      "licenceUrl": "https://quintewest.maps.arcgis.com/sharing/rest/content/items/2d74bbcab91441209f5669908ec31ad6/data",
      "attribution": "Contains information licensed under the Open Data Licence – City of Quinte West. Selected attributes are renamed by Homies / Realist; no City endorsement."
    }
  }
];
