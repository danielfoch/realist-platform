import type { Source } from "./model";
export interface WellandFeed { key:string; group:string; item:string; itemUrl:string; rootUrl:string; url:string; serviceItem:string; expectedItemTitle:string; expectedLayerName:string; child:number; geometry:string; oid:string; expectedRootCopyright:string; expectedCopyright:string; rootDescriptionHash:string; descriptionHash:string; termsHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; dates:string[]; matchField?:string; note:string; source:Source; }
export const WELLAND_GRANT={
  "site": "6a037520fb6c48d294d268ed03314d47",
  "siteTitle": "City of Welland Open Data Portal",
  "page": "751038db8be941e59fccb827c2d66c90",
  "pageTitle": "Terms of Use",
  "owner": "WellandGIS",
  "org": "2Pwm1XBIwHHnXDLH",
  "siteUrl": "https://open.welland.ca",
  "customHostname": "open.welland.ca",
  "defaultHostname": "open-welland.hub.arcgis.com",
  "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
  "hash": "f7245fbd73495801ef0d91535b97487e160f531ec20c71c7e17f0fef231b285c"
};
export const WELLAND_FEEDS:WellandFeed[]=[
  {
    "key": "addresses",
    "group": "addresses",
    "item": "64e302a8d9e54b1383641187fedd239f",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Civic_Addresses_Active/MapServer/0",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Civic_Addresses_Active/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Civic_Addresses_Active/MapServer/0",
    "serviceItem": "4b3eeef7eac9474c8656f28d20e8d952",
    "expectedItemTitle": "Welland Civic Address Points",
    "expectedLayerName": "OPENDATA_Civic_Addresses_Active",
    "child": 0,
    "geometry": "esriGeometryPoint",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "AddId": "publishedAddId",
      "Address": "publishedAddress",
      "Civic_No": "publishedCivicNumber",
      "Suffix": "publishedSuffix",
      "StName": "publishedStreetName",
      "CivicNoLbl": "publishedCivicNumberLabel"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "AddId": "esriFieldTypeInteger",
      "Address": "esriFieldTypeString",
      "Civic_No": "esriFieldTypeInteger",
      "Suffix": "esriFieldTypeString",
      "StName": "esriFieldTypeString",
      "CivicNoLbl": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Active-source civic references; civic number, suffix, label, street type and direction must agree. Unit identity and surveyed position remain unverified.",
    "source": {
      "id": "welland:addresses",
      "name": "Welland Civic Address Points — OPENDATA_Civic_Addresses_Active",
      "url": "https://www.arcgis.com/home/item.html?id=64e302a8d9e54b1383641187fedd239f",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "zoning",
    "group": "zoning",
    "item": "e0e30585066a4108b91def1509cbc87b",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer/2",
    "serviceItem": "e12104a564aa4986bf232ecc0234b1e6",
    "expectedItemTitle": "Welland Consolidated Zoning",
    "expectedLayerName": "Current Zoning",
    "child": 2,
    "geometry": "esriGeometryPolygon",
    "oid": "Obj_id",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "Obj_id": "recordId",
      "Zoning": "publishedZoning",
      "Zone_doc": "publishedZoneDocument",
      "ZoneCat": "publishedZoneCat",
      "ZoneCatSym": "publishedZoneCatSym",
      "ZoneDesc": "publishedZoneDesc"
    },
    "fieldTypes": {
      "Obj_id": "esriFieldTypeOID",
      "Zoning": "esriFieldTypeString",
      "Zone_doc": "esriFieldTypeString",
      "ZoneCat": "esriFieldTypeString",
      "ZoneCatSym": "esriFieldTypeString",
      "ZoneDesc": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Current Zoning reference. Current written provisions, exceptions, holds, amendments, appeals and application transition applicability are unverified.",
    "source": {
      "id": "welland:zoning",
      "name": "Welland Consolidated Zoning — Current Zoning",
      "url": "https://www.arcgis.com/home/item.html?id=e0e30585066a4108b91def1509cbc87b",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "environmentalProtectionArea",
    "group": "naturalEnvironmentReference",
    "item": "e0e30585066a4108b91def1509cbc87b",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer/0",
    "serviceItem": "e12104a564aa4986bf232ecc0234b1e6",
    "expectedItemTitle": "Welland Consolidated Zoning",
    "expectedLayerName": "Environmental Protection Area",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "Obj_id",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "Obj_id": "recordId",
      "Zoning": "publishedZoning",
      "Zone_doc": "publishedZoneDocument"
    },
    "fieldTypes": {
      "Obj_id": "esriFieldTypeOID",
      "Zoning": "esriFieldTypeString",
      "Zone_doc": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published zoning Environmental Protection Area reference; separate from current NPCA regulation, flood risk, parcel-wide constraints or environmental clearance.",
    "source": {
      "id": "welland:environmentalProtectionArea",
      "name": "Welland Consolidated Zoning — Environmental Protection Area",
      "url": "https://www.arcgis.com/home/item.html?id=e0e30585066a4108b91def1509cbc87b",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "environmentalControlArea",
    "group": "naturalEnvironmentReference",
    "item": "e0e30585066a4108b91def1509cbc87b",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer/1",
    "serviceItem": "e12104a564aa4986bf232ecc0234b1e6",
    "expectedItemTitle": "Welland Consolidated Zoning",
    "expectedLayerName": "Environmental Control Area",
    "child": 1,
    "geometry": "esriGeometryPolygon",
    "oid": "Obj_id",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "Obj_id": "recordId",
      "Zoning": "publishedZoning",
      "Zone_doc": "publishedZoneDocument"
    },
    "fieldTypes": {
      "Obj_id": "esriFieldTypeOID",
      "Zoning": "esriFieldTypeString",
      "Zone_doc": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published zoning Environmental Control Area reference; separate from current NPCA regulation, flood risk, parcel-wide constraints or environmental clearance.",
    "source": {
      "id": "welland:environmentalControlArea",
      "name": "Welland Consolidated Zoning — Environmental Control Area",
      "url": "https://www.arcgis.com/home/item.html?id=e0e30585066a4108b91def1509cbc87b",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "legacyZoning",
    "group": "legacyZoning",
    "item": "e0e30585066a4108b91def1509cbc87b",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Consolidated_Zoning/MapServer/3",
    "serviceItem": "e12104a564aa4986bf232ecc0234b1e6",
    "expectedItemTitle": "Welland Consolidated Zoning",
    "expectedLayerName": "Old Zoning",
    "child": 3,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "Zoning": "publishedZoning",
      "ZoneDoc": "publishedZoneDocument"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Zoning": "esriFieldTypeString",
      "ZoneDoc": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Old Zoning reference retained separately. The City distinguishes applications completed before October 1, 2024; applicability to this property or proposed work requires current City confirmation.",
    "source": {
      "id": "welland:legacyZoning",
      "name": "Welland Consolidated Zoning — Old Zoning",
      "url": "https://www.arcgis.com/home/item.html?id=e0e30585066a4108b91def1509cbc87b",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "areaSpecificPolicy",
    "group": "officialPlan",
    "item": "84eca664d5734e918c2f0a9cbc103ee2",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer/0",
    "serviceItem": "01ab51f4ba264197bfd9c2ce29048e63",
    "expectedItemTitle": "Welland Official Plan",
    "expectedLayerName": "OfficialPlan Area Specific Policy",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "Obj_id",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "Obj_id": "recordId",
      "ProposedOP": "publishedProposedOP",
      "OP_ID": "publishedOPID",
      "PolicyArea": "publishedPolicyArea"
    },
    "fieldTypes": {
      "Obj_id": "esriFieldTypeOID",
      "ProposedOP": "esriFieldTypeString",
      "OP_ID": "esriFieldTypeInteger",
      "PolicyArea": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "note": "Area-specific policy mapping includes ProposedOP text; a proposal is separate from adopted policy. Current legal instruments and amendments are unverified.",
    "source": {
      "id": "welland:areaSpecificPolicy",
      "name": "Welland Official Plan — OfficialPlan Area Specific Policy",
      "url": "https://www.arcgis.com/home/item.html?id=84eca664d5734e918c2f0a9cbc103ee2",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "appealDeferralAreas",
    "group": "officialPlan",
    "item": "84eca664d5734e918c2f0a9cbc103ee2",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer/1",
    "serviceItem": "01ab51f4ba264197bfd9c2ce29048e63",
    "expectedItemTitle": "Welland Official Plan",
    "expectedLayerName": "Official Plan Appeal Deferral Areas",
    "child": 1,
    "geometry": "esriGeometryPolygon",
    "oid": "Obj_id",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "Obj_id": "recordId",
      "Name": "publishedName"
    },
    "fieldTypes": {
      "Obj_id": "esriFieldTypeOID",
      "Name": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published appeal/deferral reference areas; historical mapping does not establish current tribunal status or in-force policy.",
    "source": {
      "id": "welland:appealDeferralAreas",
      "name": "Welland Official Plan — Official Plan Appeal Deferral Areas",
      "url": "https://www.arcgis.com/home/item.html?id=84eca664d5734e918c2f0a9cbc103ee2",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "scheduleB",
    "group": "officialPlan",
    "item": "84eca664d5734e918c2f0a9cbc103ee2",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Official_Plan/MapServer/2",
    "serviceItem": "01ab51f4ba264197bfd9c2ce29048e63",
    "expectedItemTitle": "Welland Official Plan",
    "expectedLayerName": "Official Plan Schedule B",
    "child": 2,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "Adopted_OP": "publishedAdoptedOP",
      "Other_Use": "publishedOtherUse",
      "SiteSpec": "publishedSiteSpec"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Adopted_OP": "esriFieldTypeString",
      "Other_Use": "esriFieldTypeString",
      "SiteSpec": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Schedule B land-use, other-use and site-specific text; source currency and current adopted plan, written policies, amendments and appeals require verification. The February 2026 plan is labelled proposed on City guidance.",
    "source": {
      "id": "welland:scheduleB",
      "name": "Welland Official Plan — Official Plan Schedule B",
      "url": "https://www.arcgis.com/home/item.html?id=84eca664d5734e918c2f0a9cbc103ee2",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "heritage",
    "group": "heritage",
    "item": "0aa78d20dd6a4dac95e2e8e5bca0e8c2",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Heritage_Parcels/MapServer/0",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Heritage_Parcels/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Heritage_Parcels/MapServer/0",
    "serviceItem": "c9ffa4cd1d704515bf03f6ecce662a8f",
    "expectedItemTitle": "Welland Designated Heritage Properties",
    "expectedLayerName": "OPENDATA_Heritage_Parcels",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "CommonName": "publishedCommonName",
      "Address": "publishedAddress",
      "Descr": "publishedDescr",
      "Bylaw_No": "publishedBylawNumber",
      "Year_built": "publishedYearBuilt",
      "Year_Desig": "publishedYearDesignated",
      "Doc_URL": "publishedDocURL"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CommonName": "esriFieldTypeString",
      "Address": "esriFieldTypeString",
      "Descr": "esriFieldTypeString",
      "Bylaw_No": "esriFieldTypeString",
      "Year_built": "esriFieldTypeInteger",
      "Year_Desig": "esriFieldTypeInteger",
      "Doc_URL": "esriFieldTypeString"
    },
    "dates": [],
    "matchField": "Address",
    "note": "Exact civic-address City heritage attributes only. No cadastral geometry is returned or reused; current parcel identity, full register, instruments and alteration requirements remain unverified.",
    "source": {
      "id": "welland:heritage",
      "name": "Welland Designated Heritage Properties — OPENDATA_Heritage_Parcels",
      "url": "https://www.arcgis.com/home/item.html?id=0aa78d20dd6a4dac95e2e8e5bca0e8c2",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "sitePlans",
    "group": "sitePlans",
    "item": "97e8cf84b01b4c92839c2c94c63216b9",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_SitePlans_Parcels/MapServer/0",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_SitePlans_Parcels/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_SitePlans_Parcels/MapServer/0",
    "serviceItem": "959e5f3b6f32410e8490732d9f2fc6ea",
    "expectedItemTitle": "Welland Site Plans",
    "expectedLayerName": "OPENDATA_Plan_SitePlans_Parcels",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "DateRecd": "publishedReceivedDate",
      "CivicAddr": "publishedCivicAddress",
      "MajorUse": "publishedMajorUse",
      "ConstType": "publishedConstType",
      "IntendUse": "publishedIntendUse",
      "CommonName": "publishedCommonName",
      "Status": "publishedStatus"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "DateRecd": "esriFieldTypeDate",
      "CivicAddr": "esriFieldTypeString",
      "MajorUse": "esriFieldTypeString",
      "ConstType": "esriFieldTypeString",
      "IntendUse": "esriFieldTypeString",
      "CommonName": "esriFieldTypeString",
      "Status": "esriFieldTypeString"
    },
    "dates": [
      "DateRecd"
    ],
    "matchField": "CivicAddr",
    "note": "Exact civic-address City site-plan attributes only; raw received date, use and status are retained. No cadastral geometry is returned or reused. Full planning history, nearby proposals, current decisions and approved use remain unverified.",
    "source": {
      "id": "welland:sitePlans",
      "name": "Welland Site Plans — OPENDATA_Plan_SitePlans_Parcels",
      "url": "https://www.arcgis.com/home/item.html?id=97e8cf84b01b4c92839c2c94c63216b9",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "communityImprovement",
    "group": "communityImprovement",
    "item": "d44bffff3b054ba8b98a78289bb95037",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_CIP_Areas/MapServer/0",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_CIP_Areas/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Plan_CIP_Areas/MapServer/0",
    "serviceItem": "6b704ea9dbbe44ce99b39437fdc901c1",
    "expectedItemTitle": "Welland Community Improvement Plan Areas",
    "expectedLayerName": "OPENDATA_Plan_CIP_Areas",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "CIPName": "publishedCIPName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CIPName": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published community-improvement boundary reference. Current adopted program, funding, eligibility, contamination, remediation and grant approval remain unverified.",
    "source": {
      "id": "welland:communityImprovement",
      "name": "Welland Community Improvement Plan Areas — OPENDATA_Plan_CIP_Areas",
      "url": "https://www.arcgis.com/home/item.html?id=d44bffff3b054ba8b98a78289bb95037",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "businessImprovement",
    "group": "businessImprovement",
    "item": "38410ac61039443faaa11fc87a83e017",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_BIA/MapServer/0",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_BIA/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_BIA/MapServer/0",
    "serviceItem": "ad172d9de1ec4904817c84a2994c5bb2",
    "expectedItemTitle": "Welland Business Improvement Areas",
    "expectedLayerName": "OPENDATA_BIA",
    "child": 0,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "BIA_Name": "publishedBIAName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BIA_Name": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published business-improvement area name at the point; actual levies, services, benefits and current boundary applicability remain unverified.",
    "source": {
      "id": "welland:businessImprovement",
      "name": "Welland Business Improvement Areas — OPENDATA_BIA",
      "url": "https://www.arcgis.com/home/item.html?id=38410ac61039443faaa11fc87a83e017",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  },
  {
    "key": "ward",
    "group": "ward",
    "item": "dc0f952c325647c089819e5f7ce674c2",
    "itemUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Ward_Poll/MapServer",
    "rootUrl": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Ward_Poll/MapServer",
    "url": "https://arcgisweb.welland.ca/serverprodpub/rest/services/OpenData/OPENDATA_Ward_Poll/MapServer/1",
    "serviceItem": "fc6d642ff59a42f39c1d54b66c687fce",
    "expectedItemTitle": "Welland Ward and Poll Boundaries",
    "expectedLayerName": "Ward Boundaries",
    "child": 1,
    "geometry": "esriGeometryPolygon",
    "oid": "OBJECTID",
    "expectedRootCopyright": "",
    "expectedCopyright": "",
    "rootDescriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "descriptionHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "termsHash": "2f8f25d7e1d366fe644104b7d6e6b1d29f46f188629b8f16dfa62622921fd44c",
    "fields": {
      "OBJECTID": "recordId",
      "Ward": "publishedWard"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Ward": "esriFieldTypeInteger"
    },
    "dates": [],
    "note": "Published ward reference at the point. Current election boundaries require City verification. Councillor and contact fields are excluded.",
    "source": {
      "id": "welland:ward",
      "name": "Welland Ward and Poll Boundaries — Ward Boundaries",
      "url": "https://www.arcgis.com/home/item.html?id=dc0f952c325647c089819e5f7ce674c2",
      "licence": "Open Government Licence – City of Welland 2.0",
      "licenceUrl": "https://open-welland.hub.arcgis.com/pages/terms-of-use",
      "attribution": "Contains information licensed under the Open Government Licence – City of Welland."
    }
  }
];
export const WELLAND_WITHHELD=[
  {
    "layer": "permits",
    "url": "https://www.arcgis.com/home/item.html?id=cc794752d9e44f8880f56dc4641b8cbe",
    "reason": "The public current CityView permit item has blank terms; complete dataset grant binding is unresolved. Historical 2019-and-prior resource appears stale. No permit records or counts are queried."
  },
  {
    "layer": "buildingFootprints",
    "url": "https://www.arcgis.com/home/item.html?id=880aa1b15e9f475aac41dcb4fbc90787",
    "reason": "Supplier/2018 regional aerial lineage and geometry reuse remain unresolved; publisher says not to use this dataset for accurate building location. No footprint records, counts or centroids are queried."
  },
  {
    "layer": "planningApplications",
    "url": "https://www.welland.ca/business-and-development/for-development/planning-and-zoning/municipal-planning-data-reporting/",
    "reason": "Full application/decision history and reuse binding are unverified. Connected site-plan attributes do not cover all application types or nearby proposals."
  },
  {
    "layer": "variance",
    "url": "https://www.welland.ca/business-and-development/for-development/planning-and-zoning/planning-applications/minor-variance/",
    "reason": "Complete licensed minor-variance and consent decisions are not connected; public meeting documents do not establish full history."
  }
];
