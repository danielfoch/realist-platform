import type { Source } from "./model";
export interface GuelphFeed { market:string; key:string; item:string; url:string; owner:string; org:string; expectedItemTitle:string; expectedLayerName:string; expectedCopyright:string; termsHash:string; requiresCatalogueGrant:boolean; oid:string; geometry:string; fields:Record<string,string>; fieldTypes:Record<string,string>; dates:string[]; matchField?:string; note:string; source:Source; }
export const GUELPH_GRANT={
  "site": "87ad3736953549daa98ead9f2f98ab55",
  "page": "4430c79729cf47968ffde39ed58771d4",
  "terms": "ddc8ba4ab45f43d8a658174f987a5382",
  "group": "fa63a5d3eb9b4054a5066f5acaf5b066",
  "groupOwner": "mbarthol_cityofguelph",
  "owner": "GuelphGIS_cityofguelph",
  "org": "k3dd78JyG9GFoZHG",
  "licenceHash": "c34ecdd5cc2f2fe00f71b7b91e6dacd393b8508567373c72d9e5b30e6b96b5c8",
  "termsHash": "14b9f31cb3aa28e3b5da57c28bce9d65f71082039588aff426a22b02d7d29272"
};
export const GUELPH_FEEDS:GuelphFeed[]=[
  {
    "market": "Guelph",
    "key": "addresses",
    "item": "3a511df6735a4982810a43d75b303983",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/0",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Addresses",
    "expectedLayerName": "Addresses",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "STREETNO": "publishedStreetNumber",
      "UNIT_NO": "publishedUnitNumber",
      "STREETNAME": "publishedStreetName",
      "ADDRESS": "publishedAddress",
      "STNAME": "publishedStname",
      "STSUF": "publishedStsuf",
      "STDIR": "publishedStdir",
      "FULLNAME": "publishedFullname",
      "PLACE": "publishedPlace",
      "STATUS": "publishedStatus",
      "POSTCODE": "publishedPostcode",
      "QUALIFIER": "publishedQualifier"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "STREETNO": "esriFieldTypeString",
      "UNIT_NO": "esriFieldTypeString",
      "STREETNAME": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "STNAME": "esriFieldTypeString",
      "STSUF": "esriFieldTypeString",
      "STDIR": "esriFieldTypeString",
      "FULLNAME": "esriFieldTypeString",
      "PLACE": "esriFieldTypeString",
      "STATUS": "esriFieldTypeString",
      "POSTCODE": "esriFieldTypeString",
      "QUALIFIER": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Municipal civic points; no unit, owner, assessment, title or surveyed boundary verification.",
    "source": {
      "id": "guelph:addresses",
      "name": "Guelph Addresses",
      "url": "https://www.arcgis.com/home/item.html?id=3a511df6735a4982810a43d75b303983",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "municipality",
    "item": "4e2e9a88707f4dbbb3bb51a6bd8083a1",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/3",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "City Boundary",
    "expectedLayerName": "CityBoundary",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "BOUNDARY": "publishedBoundary"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "BOUNDARY": "esriFieldTypeString"
    },
    "dates": [],
    "note": "City boundary point confirmation; not a survey or title record.",
    "source": {
      "id": "guelph:municipality",
      "name": "Guelph City Boundary",
      "url": "https://www.arcgis.com/home/item.html?id=4e2e9a88707f4dbbb3bb51a6bd8083a1",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "parcelReference",
    "item": "ac57780312324aedbb63291bfbca4ed2",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/16",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Property Lines",
    "expectedLayerName": "Property",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "PARCELSTAT": "publishedParcelstat",
      "PARCELTYPE": "publishedParceltype",
      "Shape__Area": "publishedShapeArea",
      "Shape__Length": "publishedShapeLength"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PARCELSTAT": "esriFieldTypeString",
      "PARCELTYPE": "esriFieldTypeString",
      "Shape__Area": "esriFieldTypeDouble",
      "Shape__Length": "esriFieldTypeDouble"
    },
    "dates": [],
    "note": "Published property polygons intersecting the point; no title, PIN, ownership or surveyed dimensions are returned. Published shape measures retain unknown units and are not surveyed lot sizes.",
    "source": {
      "id": "guelph:parcelReference",
      "name": "Guelph Property Lines",
      "url": "https://www.arcgis.com/home/item.html?id=ac57780312324aedbb63291bfbca4ed2",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "buildingFootprints",
    "item": "07d5189001a3410ca457247863ba4e67",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/10",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Buildings",
    "expectedLayerName": "Buildings",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedName",
      "MUN": "publishedMun",
      "SOURCE": "publishedSource",
      "Shape__Area": "publishedShapeArea",
      "Shape__Length": "publishedShapeLength"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "MUN": "esriFieldTypeString",
      "SOURCE": "esriFieldTypeString",
      "Shape__Area": "esriFieldTypeDouble",
      "Shape__Length": "esriFieldTypeDouble"
    },
    "dates": [],
    "note": "Published building-footprint reference polygons intersecting the point; a civic point may lie outside a footprint. Shape measures have unverified units and do not establish interior floor area, age, permits or legal units.",
    "source": {
      "id": "guelph:buildingFootprints",
      "name": "Guelph Buildings",
      "url": "https://www.arcgis.com/home/item.html?id=07d5189001a3410ca457247863ba4e67",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "zoning",
    "item": "36592a73a6174fdebee9f3156694c843",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData2/FeatureServer/16",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Zoning Bylaw (2023)-20790",
    "expectedLayerName": "Zoning_2023",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ZONEMAP": "publishedZonemap",
      "ZONE_1": "publishedZone1",
      "Type_": "publishedTypeundefined",
      "ZONING_CODE": "publishedZoningCode",
      "SITE_SPECIFIC": "publishedSiteSpecific",
      "PARKING": "publishedParking",
      "HOLDING": "publishedHolding",
      "ZONING_CODE_DESC": "publishedZoningCodeDesc",
      "ZONING_CODE_LINK": "publishedZoningCodeLink",
      "SITE_SPECIFIC_LINK": "publishedSiteSpecificLink",
      "PARKING_LINK": "publishedParkingLink",
      "HOLDING_LINK": "publishedHoldingLink"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZONEMAP": "esriFieldTypeString",
      "ZONE_1": "esriFieldTypeString",
      "Type_": "esriFieldTypeString",
      "ZONING_CODE": "esriFieldTypeString",
      "SITE_SPECIFIC": "esriFieldTypeString",
      "PARKING": "esriFieldTypeString",
      "HOLDING": "esriFieldTypeString",
      "ZONING_CODE_DESC": "esriFieldTypeString",
      "ZONING_CODE_LINK": "esriFieldTypeString",
      "SITE_SPECIFIC_LINK": "esriFieldTypeString",
      "PARKING_LINK": "esriFieldTypeString",
      "HOLDING_LINK": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published 2023-20790 zone, site-specific, parking and holding references at the subject point. Current text, amendments, appealed sections and applicability remain unverified. March 2026 settlements, unconsolidated 2024-21024 ADU amendments and the separate 2025-21064 Stone/Edinburgh CPP regime require current City confirmation.",
    "source": {
      "id": "guelph:zoning",
      "name": "Guelph Zoning Bylaw (2023)-20790",
      "url": "https://www.arcgis.com/home/item.html?id=36592a73a6174fdebee9f3156694c843",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "legacyZoning1995",
    "item": "b2bbac19c35c405b80f4cd63ee931ac8",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/9",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Zoning",
    "expectedLayerName": "Zoning",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ZONE1": "publishedZone1",
      "ZONEMAP": "publishedZonemap",
      "BYLAW_LINK": "publishedBylawLink",
      "ZONING_TYPE": "publishedZoningType"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZONE1": "esriFieldTypeString",
      "ZONEMAP": "esriFieldTypeString",
      "BYLAW_LINK": "esriFieldTypeString",
      "ZONING_TYPE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Legacy zoning reference at the point, separate from the 2023 regime. It does not establish current applicability or permissions; some appealed 2023 provisions require continued 1995-bylaw reference, subject to current City confirmation.",
    "source": {
      "id": "guelph:legacyZoning1995",
      "name": "Guelph Zoning",
      "url": "https://www.arcgis.com/home/item.html?id=b2bbac19c35c405b80f4cd63ee931ac8",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "formerTermiteManagement",
    "item": "38b8fcced8b040868cc9b03c945e3051",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/12",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Termite_Data",
    "expectedLayerName": "Termite_Data",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID_12",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID_12": "publishedObjectid12",
      "ACTIVITY": "publishedActivity",
      "MAN_AREA": "publishedManArea",
      "YEAR": "publishedYear"
    },
    "fieldTypes": {
      "OBJECTID_12": "esriFieldTypeOID",
      "ACTIVITY": "esriFieldTypeString",
      "MAN_AREA": "esriFieldTypeString",
      "YEAR": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Former termite-management mapping with published activity/year text; historical area labels do not establish present infestation, eradication, inspection, treatment or absence. The separate Regent/Grove activity identified in 2025 and City-managed in 2026 is not screened by this historical feed.",
    "source": {
      "id": "guelph:formerTermiteManagement",
      "name": "Guelph Termite_Data",
      "url": "https://www.arcgis.com/home/item.html?id=38b8fcced8b040868cc9b03c945e3051",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "planningApplications",
    "item": "a4a5f8a075ae4528a1fc7525d7c9fa4f",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/27",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Active Development Planning",
    "expectedLayerName": "ActiveDevelopmentPlanning",
    "expectedCopyright": "",
    "termsHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "requiresCatalogueGrant": true,
    "oid": "OBJECTID_1",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID_1": "recordId",
      "ADDRESS": "publishedAddress",
      "FOLDERNAME": "publishedFoldername",
      "FOLDERDESC": "publishedFolderdesc",
      "REFERENCEFILE": "publishedReferencefile",
      "INDATE": "publishedApplicationDate",
      "FOLDERTYPE": "publishedFoldertype",
      "WORKDESC": "publishedWorkdesc",
      "STATUSDESC": "publishedStatus",
      "FOLDERDESCRIPTION": "publishedFolderdescription",
      "SUBDESC": "publishedSubdesc",
      "URL": "publishedUrl",
      "WARD": "publishedWard"
    },
    "fieldTypes": {
      "OBJECTID_1": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "FOLDERNAME": "esriFieldTypeString",
      "FOLDERDESC": "esriFieldTypeString",
      "REFERENCEFILE": "esriFieldTypeString",
      "INDATE": "esriFieldTypeDate",
      "FOLDERTYPE": "esriFieldTypeString",
      "WORKDESC": "esriFieldTypeString",
      "STATUSDESC": "esriFieldTypeString",
      "FOLDERDESCRIPTION": "esriFieldTypeString",
      "SUBDESC": "esriFieldTypeString",
      "URL": "esriFieldTypeString",
      "WARD": "esriFieldTypeString"
    },
    "dates": [
      "INDATE"
    ],
    "matchField": "ADDRESS",
    "note": "Exact civic-address observations from the published Active Development Planning feed. It includes older digitized records and Undetermined status; current activity is not established. Preserve raw status/file references and application dates. Nearby development, complete decisions, conditions, appeals and full history are unsearched.",
    "source": {
      "id": "guelph:planningApplications",
      "name": "Guelph Active Development Planning",
      "url": "https://www.arcgis.com/home/item.html?id=a4a5f8a075ae4528a1fc7525d7c9fa4f",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "registeredPlans",
    "item": "44d8a50da8324f03a8f09acd6b2c3c9b",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData2/FeatureServer/5",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Registered Plans 61M",
    "expectedLayerName": "Registered Plans (61M)",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "PLAN_": "publishedPlanundefined",
      "REGDATE": "publishedRegistrationDate",
      "PHASE": "publishedPhase",
      "BLOCKS": "publishedBlocks",
      "LOTS": "publishedLots",
      "M_NO": "publishedMNo"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PLAN_": "esriFieldTypeString",
      "REGDATE": "esriFieldTypeDate",
      "PHASE": "esriFieldTypeString",
      "BLOCKS": "esriFieldTypeInteger",
      "LOTS": "esriFieldTypeInteger",
      "M_NO": "esriFieldTypeSmallInteger"
    },
    "dates": [
      "REGDATE"
    ],
    "note": "Published 61M plan-reference polygons intersecting the point and dated registration observations; no registered instrument, survey, ownership or title search is performed. Owner/surveyor/contact fields are excluded.",
    "source": {
      "id": "guelph:registeredPlans",
      "name": "Guelph Registered Plans 61M",
      "url": "https://www.arcgis.com/home/item.html?id=44d8a50da8324f03a8f09acd6b2c3c9b",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "watercourseReference",
    "item": "329dd1acf6074d358da2c6d7714200db",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/15",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Watercourse Polygons",
    "expectedLayerName": "Watercourse Polygons",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "COMMON_NAME": "publishedCommonName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "COMMON_NAME": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published watercourse-reference polygons intersecting the point; this is not a floodplain, setback, natural-heritage, GRCA regulatory, water-quality or parcel-wide environmental screen.",
    "source": {
      "id": "guelph:watercourseReference",
      "name": "Guelph Watercourse Polygons",
      "url": "https://www.arcgis.com/home/item.html?id=329dd1acf6074d358da2c6d7714200db",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  },
  {
    "market": "Guelph",
    "key": "parkReference",
    "item": "31c79f60e5e44745b343dc7767418944",
    "url": "https://gismaps.guelph.ca/hosting/rest/services/OpenData/OpenData1/FeatureServer/5",
    "owner": "GuelphGIS_cityofguelph",
    "org": "k3dd78JyG9GFoZHG",
    "expectedItemTitle": "Parks",
    "expectedLayerName": "Park Boundary",
    "expectedCopyright": "",
    "termsHash": "6ed4799128c34acb2f360950eff10cf7e54d0306a012f9dcfd04732f15a9939f",
    "requiresCatalogueGrant": false,
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ParkName": "publishedParkname",
      "ParkStatus": "publishedParkstatus",
      "Name": "publishedName"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ParkName": "esriFieldTypeString",
      "ParkStatus": "esriFieldTypeString",
      "Name": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published park-reference polygons intersecting the point; this is not nearby amenity-distance research, current public access, ownership or development permission.",
    "source": {
      "id": "guelph:parkReference",
      "name": "Guelph Parks",
      "url": "https://www.arcgis.com/home/item.html?id=31c79f60e5e44745b343dc7767418944",
      "licence": "Open Government Licence – City of Guelph 2.0",
      "licenceUrl": "https://explore.guelph.ca/pages/open-data-license",
      "attribution": "Contains information licensed under the Open Government Licence – City of Guelph."
    }
  }
];
export const GUELPH_WITHHELD=[
  {
    "layer": "permits",
    "url": "https://guelph.ca/city-government/building-permits-inspections/building-services-record-request/",
    "reason": "GPAS public permit search has unresolved automated reuse terms; no records or counts are queried. The City warns pre-1995 records may not appear."
  },
  {
    "layer": "heritage",
    "item": "9ff50dc2055f435c92251cb83282da7f",
    "reason": "The underlying heritage service has blank terms and lacks individual curated-dataset membership. City-curated viewer/package publication does not establish the underlying data grant. Current register, designations, districts and full parcel scope remain unconnected."
  },
  {
    "layer": "variance",
    "item": "17488677036b4cfa852028aa8b418cc1",
    "reason": "The underlying Committee of Adjustment service has blank terms and lacks individual curated-dataset membership. Public viewer/package availability does not establish data reuse."
  },
  {
    "layer": "zoningOverlays",
    "item": "1aaf4257508f4a5189ce8e4cf91c3d02",
    "reason": "Draft/proposed overlay view has unresolved reuse and current legal currency; it is excluded from the current zoning screen."
  },
  {
    "layer": "floodplainOverlay",
    "item": "6f61c0bfafa1412099d61c2c38a13522",
    "reason": "The proposed floodplain-overlay view has blank terms and no verified individual curated-dataset grant. Current GRCA regulation is separate."
  },
  {
    "layer": "communityPlanningPermit",
    "item": "49f6661cf83249dcaee3d32de1cc6cff",
    "url": "https://guelph.ca/city-government/by-laws-and-policies/zoning-by-law/",
    "reason": "The separate Stone Road/Edinburgh CPP viewer and underlying data have unresolved reuse; current CPP applicability is not screened."
  },
  {
    "layer": "currentTermiteManagement",
    "url": "https://guelph.ca/living/house-and-home/termites/",
    "reason": "The City reports separate Regent/Grove termite activity identified in 2025 and management in 2026. Current map is a published image; reusable machine-readable geometry was not verified. Historical Termite_Data is not a current infestation or safety screen."
  }
];
