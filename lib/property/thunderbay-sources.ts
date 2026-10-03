import type { Source } from "./model";
export interface ThunderBayFeed { key:string; item:string; itemUrl:string; owner:string; rootUrl:string; url:string; child:number; title:string; layerName:string; geometry:string; oid:string; accessInformation:string|null; rootCopyright:string; copyright:string; rootDescriptionHash:string; descriptionHash:string; itemDescriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; note:string; source:Source; }
export const THUNDERBAY_GRANT={
  "site": "0c64648ebf51412b99732c13b81c3979",
  "siteTitle": "City of Thunder Bay's Open Data Portal",
  "siteType": "Hub Site Application",
  "siteOwner": "ChrisDoyle1",
  "siteUrl": "https://opendata.thunderbay.ca",
  "siteTermsHash": "22b6ac3bfb032390291228f5cbe07bf2bda9e117af5233d1b97fb1d66d0d49af",
  "group": "169818a570a44bcfae6afd78d055f37a",
  "groupTitle": "City of Thunder Bay's Open Data Portal Content",
  "groupOwner": "ChrisDoyle1",
  "serviceOrg": "h9xShea49ZANgOtx",
  "officialOffer": "https://www.thunderbay.ca/city-hall/thunder-bay-open-data/",
  "offerHash": "f583a989ecbc9a42e1246a87d439354e5f7f70b02a8799149e8095139d59833a",
  "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
  "licenceHash": "dbb70ac323a4aae50a57fee87a3b1b60b1b34aefda9189a92b57df4c3ea743dc"
};
export const THUNDERBAY_FEEDS:ThunderBayFeed[]=[
  {
    "key": "municipalAddresses",
    "item": "edd16d2e45804345a9f3189a2b52f453",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Municipal_Address_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Municipal_Address_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Municipal_Address_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Municipal Address Feature Layer",
    "layerName": "MunicipalAddress",
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "Development & Emergency Services - Mapping Section",
    "rootDescriptionHash": "f16daf202d6e717dfd57d1dce40a37e0d5bf0bc3dd98015e8fd68e1075c2cf4d",
    "descriptionHash": "0da4e965cbe74c3b5f52d68cf329d8ef94f5de6014966f98b554599c8eacd84f",
    "itemDescriptionHash": "65579714de567286a22c865714d9fe5d6e13d060edc02c3206d3757d0ef0f5ab",
    "termsHash": "6de87de0efcfc7e569eb6dedada5209b9cf775a8b8bd413e30d6c4745ef6914a",
    "fields": {
      "OBJECTID": "recordId",
      "REFNAME": "publishedAddressType",
      "ADDRESS": "publishedNumber",
      "STREET": "publishedStreetName",
      "ROWTYPE": "publishedStreetType",
      "SPLITLOC": "publishedDirection",
      "COMPLETE": "publishedAddress",
      "ROOT": "publishedStreet",
      "CITY": "publishedCity",
      "PROVINCE": "publishedProvince",
      "ADDRESS_NUMBER": "number",
      "ADDRESS_QUALIFIER": "numberSuffix"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "REFNAME": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "STREET": "esriFieldTypeString",
      "ROWTYPE": "esriFieldTypeString",
      "SPLITLOC": "esriFieldTypeString",
      "COMPLETE": "esriFieldTypeString",
      "ROOT": "esriFieldTypeString",
      "CITY": "esriFieldTypeString",
      "PROVINCE": "esriFieldTypeString",
      "ADDRESS_NUMBER": "esriFieldTypeInteger",
      "ADDRESS_QUALIFIER": "esriFieldTypeString"
    },
    "note": "Strict civic attributes only. The City says the point source originated in CAD centroid address layers; no geometry or precise building identity is reused. Preserve suffix, direction, municipality and address-type distinctions.",
    "source": {
      "id": "thunderbay:municipalAddresses",
      "name": "Thunder Bay — Municipal Address Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=edd16d2e45804345a9f3189a2b52f453",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "parcelReference",
    "item": "e666aebadebd4130992d7fde43fbb857",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Property_Parcel_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Property_Parcel_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Property_Parcel_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Property Parcel Feature Layer",
    "layerName": "PropertyParcel",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "Development & Emergency Services - Mapping Section",
    "rootDescriptionHash": "9ee5b5a32cc6a4868fca2d437bc8c2a82aafa32592179e5dcb1518a91bab60ba",
    "descriptionHash": "a159177201609930e71f7ae725ef832fd0e51cf439f4691d433b4a7319b4c573",
    "itemDescriptionHash": "1b27e7f813f3ba2dbb88da96d56cdaaff09259591cc3acb4539e2ee1ea9c086b",
    "termsHash": "af0c688650a4628d4c3133df65e6dd3bbe781b19355635323954d544a28199a6",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "note": "City-curated parcel-fabric reference identifier only. Municipal mapping derives legal/reference plans and original PIX layers; no PIN, ownership, area, title, surveyed boundary or legal parcel identity is returned.",
    "source": {
      "id": "thunderbay:parcelReference",
      "name": "Thunder Bay — Property Parcel Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=e666aebadebd4130992d7fde43fbb857",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "buildingFootprintReference",
    "item": "cc7cb51753384ca99e566834cd48924b",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Building_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Building_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Building_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Building Feature Layer",
    "layerName": "Building",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "City of Thunder Bay",
    "rootCopyright": "City of Thunder Bay",
    "copyright": "City of Thunder Bay",
    "rootDescriptionHash": "06d0d7eca99f7d3a246212912d83a6e0050d951c8b93ce25bdbbe13f5c3e6f91",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "1305de53587fc587e95c7047e502ff7d00195f1398b070b0fbcc1e95436c3f7b",
    "termsHash": "6de87de0efcfc7e569eb6dedada5209b9cf775a8b8bd413e30d6c4745ef6914a",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "note": "City-curated footprint reference identifier only. Aerial photography, LiDAR and legal-plan observation vintages are not established. No geometry, area, elevation, construction age, condition, floors or legal/current units are returned.",
    "source": {
      "id": "thunderbay:buildingFootprintReference",
      "name": "Thunder Bay — Building Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=cc7cb51753384ca99e566834cd48924b",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "heritageDistrict",
    "item": "6b6c6c1123344b8892f44359151ae675",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Heritage_Conservation_District_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Heritage_Conservation_District_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Heritage_Conservation_District_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Heritage Conservation District Feature Layer",
    "layerName": "HeritageConservationDistrict",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "",
    "rootDescriptionHash": "178f6a6a8c938fda38b807a802b50726cd2bb4bc177f8d1d55b2b0b3ff8a1309",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "c91e6dceb341af83c618c41aa6260be97be2e7c657218473c282d15a3a988df7",
    "termsHash": "6de87de0efcfc7e569eb6dedada5209b9cf775a8b8bd413e30d6c4745ef6914a",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedDistrictName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString"
    },
    "note": "Published Waverley Park district reference derives the study and bylaw 65-1988. Current City guidance still identifies this district, but current instruments, amendments, boundaries, individual designation/listing and parcel-wide applicability require confirmation.",
    "source": {
      "id": "thunderbay:heritageDistrict",
      "name": "Thunder Bay — Heritage Conservation District Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=6b6c6c1123344b8892f44359151ae675",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "officialPlanReference",
    "item": "b387091ec5c64347b7d877df28c6d92b",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_General_Land_Use_Designations_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_General_Land_Use_Designations_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_General_Land_Use_Designations_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Official Plan 2019 General Land Use Designations Feature Layer",
    "layerName": "OP2019_GeneralLandUseDesignations",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "",
    "rootDescriptionHash": "642df0c8da8962896ba2b3bee72bae4e7bf93a640bdd5bd5e33019252481f486",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "81d0984f015f5db526cc0ec05843df219726f08877b96aeba99270a6a032a017",
    "termsHash": "af0c688650a4628d4c3133df65e6dd3bbe781b19355635323954d544a28199a6",
    "fields": {
      "OBJECTID": "recordId",
      "Area_Type": "publishedAreaType",
      "Schedule": "publishedSchedule",
      "LANDUSE": "publishedLandUse",
      "Source": "publishedSource",
      "AreaType_Desc": "publishedAreaDescription"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Area_Type": "esriFieldTypeString",
      "Schedule": "esriFieldTypeString",
      "LANDUSE": "esriFieldTypeString",
      "Source": "esriFieldTypeString",
      "AreaType_Desc": "esriFieldTypeString"
    },
    "note": "Published 2019 Official Plan Schedule A reference. This is a separate licensed Feature Layer from the current official map service. A 2026 edit is not proof of the August 26, 2024 consolidation, later amendments, appeals or current development permission.",
    "source": {
      "id": "thunderbay:officialPlanReference",
      "name": "Thunder Bay — Official Plan 2019 General Land Use Designations Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=b387091ec5c64347b7d877df28c6d92b",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "siteSpecificPolicyReference",
    "item": "eb3693dd25f44aa88c3884236f2789b7",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_Site_Specific_Policy_Area_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_Site_Specific_Policy_Area_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/Official_Plan_2019_Site_Specific_Policy_Area_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "Official Plan 2019 Site Specific Policy Area Feature Layer",
    "layerName": "OP2019_SiteSpecificPolicyArea",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "",
    "rootDescriptionHash": "b5e1f02cb55290c63578a4ebd910046aa1030e154cd499ab9d1122931f1d28aa",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "9946db3ed37d90afce7b6eae54659f97fad53ffad6d4451f602135b6c53798eb",
    "termsHash": "af0c688650a4628d4c3133df65e6dd3bbe781b19355635323954d544a28199a6",
    "fields": {
      "OBJECTID": "recordId",
      "Name": "publishedPolicyAreaName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Name": "esriFieldTypeString"
    },
    "note": "Published Figure 9 reference of the 2019 Official Plan. Dataset guidance describes a City-approved development plan; verify applicable current policies, approvals, conditions and amendments without treating this historic reference as current permission.",
    "source": {
      "id": "thunderbay:siteSpecificPolicyReference",
      "name": "Thunder Bay — Official Plan 2019 Site Specific Policy Area Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=eb3693dd25f44aa88c3884236f2789b7",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  },
  {
    "key": "historicalMunicipalBoundary",
    "item": "ffe5eb8ea794430184b44498a0f0cac5",
    "itemUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/City_Limits_Feature_Layer/FeatureServer",
    "owner": "opendata_Thunderbay",
    "rootUrl": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/City_Limits_Feature_Layer/FeatureServer",
    "url": "https://services5.arcgis.com/h9xShea49ZANgOtx/arcgis/rest/services/City_Limits_Feature_Layer/FeatureServer/0",
    "child": 0,
    "title": "City Limits Feature Layer",
    "layerName": "CityLimits",
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "accessInformation": "",
    "rootCopyright": "",
    "copyright": "",
    "rootDescriptionHash": "8a03fd59d91b5e8364b3efba2ea96344ea272e530ea80ca6dd4ecb2bcc863823",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "itemDescriptionHash": "71138af881a01ac1bba56820fffcff6dfedd3a828a654254541a5cb9ce29bef8",
    "termsHash": "6de87de0efcfc7e569eb6dedada5209b9cf775a8b8bd413e30d6c4745ef6914a",
    "fields": {
      "OBJECTID": "recordId",
      "TOWNSHIP": "publishedTownship"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "TOWNSHIP": "esriFieldTypeString"
    },
    "note": "Published City boundary reference originates in the May 1969 Order in Council. It is not used as the current containment gate and does not establish present legal/property boundaries. One unique original Ontario municipality polygon independently gates spatial queries.",
    "source": {
      "id": "thunderbay:historicalMunicipalBoundary",
      "name": "Thunder Bay — City Limits Feature Layer",
      "url": "https://www.arcgis.com/home/item.html?id=ffe5eb8ea794430184b44498a0f0cac5",
      "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
      "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
    }
  }
];
export const THUNDERBAY_HERITAGE={
  "key": "historicalHeritageRegister",
  "item": "bd50ba0dc1534a13b4cb6f057646b049",
  "title": "Heritage Register CSV",
  "owner": "opendata_Thunderbay",
  "accessInformation": null,
  "itemDescriptionHash": "6b3d89a4db9e5f3f3b767f1c6d7c6c15a2fef0de653d9209078a3dc59a14c8c0",
  "termsHash": "6de87de0efcfc7e569eb6dedada5209b9cf775a8b8bd413e30d6c4745ef6914a",
  "url": "https://www.arcgis.com/sharing/rest/content/items/bd50ba0dc1534a13b4cb6f057646b049/data",
  "dataHash": "577424be72df8b2595b8ae75e7a3e0cd8d6a3915940989e36ee398f4eef9a98c",
  "publishedVintage": "2022-08-22",
  "source": {
    "id": "thunderbay:historicalHeritageRegister",
    "name": "Thunder Bay — 2022 heritage register reference",
    "url": "https://www.arcgis.com/home/item.html?id=bd50ba0dc1534a13b4cb6f057646b049",
    "licence": "Open Data Licence – The Corporation of the City of Thunder Bay 1.0 (March 12, 2020)",
    "licenceUrl": "https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf",
    "attribution": "Contains information licensed under the Open Data Licence – The Corporation of the City of Thunder Bay."
  },
  "note": "Historical August 22, 2022 register only; published Listed/Designated values and bylaw/report references are preserved without a present legal-status claim. The current City page announces five June 2026 designations that postdate this export. Exact street direction and number/suffix must match; range/unit ambiguity is not collapsed. Ownership and personal fields are omitted."
};
export const THUNDERBAY_GUIDANCE = {
  property: "https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/find-zoning-and-property-information/",
  permits: "https://permits-applications.thunderbay.ca/citizenportal/app/public-search",
  planning: "https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/find-development-proposals/",
  heritage: "https://www.thunderbay.ca/city-hall/history-heritage-and-records/heritage-in-thunder-bay/heritage-properties/",
  additionalUnits: "https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/housing-accelerator-fund/building-an-adu/",
  conservation: "https://lakeheadca.com/planning-permits/map-your-property/",
};
export const THUNDERBAY_WITHHELD = [
  { layer: "permits", url: THUNDERBAY_GUIDANCE.permits, reason: "The public anonymous search warns that files may be inaccurate and history incomplete. The City dashboard describes activity since 2014, but its Building_Permits item a00d2d4d7e964f368095a98a71de8976 has blank originating grant outside the 85-item curated open group. No permit records/counts/geometry are queried; complete history, current status, final inspections and occupancy require City confirmation." },
  { layer: "zoning", url: THUNDERBAY_GUIDANCE.property, reason: "Current City guidance identifies zoning 1-2022 effective April 11, 2022 and May 27, 2024 office consolidation. Its official app points to a separate 2022DRAFT_ZoningMap service with draft-proposal metadata and blank originating grant outside the curated open catalogue. Current adoption/lineage, written exceptions, holds, amendments and appeals remain unverified; no zoning records/counts/geometry are queried." },
  { layer: "planningApplications", url: THUNDERBAY_GUIDANCE.planning, reason: "The City publishes current application notices separately from final decisions, conditions and appeals. Public portal statuses may be out of date; a complete licensed property application/decision adapter is unverified. No application records/counts are queried." },
  { layer: "variance", url: THUNDERBAY_GUIDANCE.permits, reason: "Only zoning amendments and minor variances after April 11, 2022 are searchable under current City guidance. Complete decisions/conditions/appeals and originating reusable property adapter are unverified; no variance records/counts are queried." },
  { layer: "currentPlanningInstruments", url: THUNDERBAY_GUIDANCE.property, reason: "The City links the Official Plan office consolidation to August 26, 2024 and Appendix 3 amendments. Its current 2019 map uses separate services with Various copyright, outside the licensed selected Feature Layers. Historic Schedule A/Figure 9 references do not establish current adopted policies, amendments, appeals, development plans or permission." },
  { layer: "heritage", url: THUNDERBAY_GUIDANCE.heritage, reason: "The licensed register export is dated August 22, 2022; the current City page announces five June 2026 designations under bylaw 219-2026. Historical Listed/Designated observations and district reference do not establish the complete current register, individual instruments, appeals or current parcel-wide protection. No separate current-register records/counts are queried." },
  { layer: "additionalUnits", url: THUNDERBAY_GUIDANCE.additionalUnits, reason: "City ADU guidance and grant programs are separate from a property registration, final-inspection and occupancy register. Footprint NUMBER_OF_UNITS is excluded; advertised-unit legality, current count and grant eligibility/availability require confirmation. No unit-register records/counts are queried." },
  { layer: "airportConstraints", url: "https://www.arcgis.com/home/item.html?id=4e3245ec810b4133bbe17849fddaf47a", reason: "The height-restricted dataset combines Airport Authority obstacle-limitation surfaces with City bylaw 100-2010 view-shed mapping. Originating third-party rights, applicable current instruments, units/vertical datum and precise interpretation remain unverified. No height-constraint records/counts/geometry are queried." },
  { layer: "thunderbayConservationRegulation", url: THUNDERBAY_GUIDANCE.conservation, reason: "Lakehead Region Conservation Authority administers Ontario Regulation 41/24; its screening limit is conceptual and its current guidance warns that not all regulated areas are mapped. Originating commercial reuse grant/current property adapter is unverified. No regulatory records/counts/geometry or clearance, safety and insurance conclusions are returned; obtain parcel-wide LRCA confirmation." },
  { layer: "floodplainOverlay", url: THUNDERBAY_GUIDANCE.conservation, reason: "LRCA screening and flood hazard mapping require separate originating rights, source vintages and parcel-wide authority confirmation. A point no-match or historic land-use reference cannot establish flood absence or insurance/safety; no flood records/counts/geometry are queried." },
  { layer: "wellheadProtection", url: "https://lakeheadca.com/watershed-management/source-water-protection/", reason: "The authority identifies the Lakehead Source Protection Plan approved January 16, 2013 separately from assessment reports and subsequent annual reporting. Current property-level originating grant, amendments, policy applicability and typed wellhead adapter are unverified; no records/counts/geometry are queried." },
  { layer: "intakeProtection", url: "https://lakeheadca.com/watershed-management/source-water-protection/", reason: "Current intake-protection mapping, originating reuse rights, policies and amendments require the source-protection authority. No intake records/counts/geometry are queried; civic, parcel and footprint references do not establish drinking-water safety or clearance." },
];
