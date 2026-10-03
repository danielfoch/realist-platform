import type { Source } from "./model";

export const KINGSTON_LICENCE_URL="https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf";
export const KINGSTON_LEGACY_LICENCE_URL="https://www.cityofkingston.ca/documents/10180/144997/CityofKingston_OpenDataLicense.pdf";
export const KINGSTON_GRANT_HASH="5b22699109219df0904056f9358f8bb901c3315902f3539018e0bc23492cea9d";
export const KINGSTON_GUIDANCE={zoning:"https://www.cityofkingston.ca/planning-and-development/zoning-by-laws/",officialPlan:"https://www.cityofkingston.ca/council-and-city-administration/plans-reports-and-studies/official-plan/",applications:"https://www.cityofkingston.ca/planning-and-development/development-applications/",heritage:"https://www.cityofkingston.ca/planning-and-development/heritage-property-conservation/",permits:"https://www.cityofkingston.ca/planning-and-development/how-to-use-dash/",newPlan:"https://getinvolved.cityofkingston.ca/yg220k/"};
export interface KingstonFeed {market:"Kingston";key:string;group:string;item:string;rootUrl:string;url:string;owner:string;org:string;expectedItemTitle:string;expectedLayerName:string;expectedCopyright:string;termsHash:string;oid:string;geometry:string;fields:Record<string,string>;fieldTypes:Record<string,string>;dates:string[];note:string;source:Source;}
/** Inspected City-owned feeds. Keep exact terms, endpoint, schema and attribution with each child. */
export const KINGSTON_FEEDS:KingstonFeed[]=[
  {
    "market": "Kingston",
    "key": "addresses",
    "group": "addresses",
    "item": "d76e1fe447e84cb1983c76e1cb9dadb4",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/d76e1fe447e84cb1983c76e1cb9dadb4/rest/services/Planning/Civic_Address_Point_Public/FeatureServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/d76e1fe447e84cb1983c76e1cb9dadb4/rest/services/Planning/Civic_Address_Point_Public/FeatureServer/0",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Civic Address Points",
    "expectedLayerName": "Civic Address Point - Public",
    "expectedCopyright": "Corporation of the City of Kingston, Maintained by Planning, Building & Licensing Department",
    "termsHash": "8657b444e12ed6c43a5a24f28c4126ecf218f534e5c1d5bb52668bd78ae52dd2",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS_NUMBER": "civicNumber",
      "ADDRESS_NUMBER_SUFFIX": "civicSuffix",
      "STREET": "publishedStreet",
      "FULL_ADDRESS": "publishedAddress",
      "MUNICIPALITY": "publishedMunicipality",
      "UNIT": "publishedUnit",
      "UNIT_TYPE": "publishedUnitType",
      "ADDRESS_ID": "municipalAddressId",
      "POSTAL_CODE": "publishedPostalCode",
      "NEIGHBOURHOOD": "publishedNeighbourhood"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS_NUMBER": "esriFieldTypeInteger",
      "ADDRESS_NUMBER_SUFFIX": "esriFieldTypeString",
      "STREET": "esriFieldTypeString",
      "FULL_ADDRESS": "esriFieldTypeString",
      "MUNICIPALITY": "esriFieldTypeString",
      "UNIT": "esriFieldTypeString",
      "UNIT_TYPE": "esriFieldTypeString",
      "ADDRESS_ID": "esriFieldTypeDouble",
      "POSTAL_CODE": "esriFieldTypeString",
      "NEIGHBOURHOOD": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Municipal civic identity and location only. Unit attributes remain source context, not a verified unit or legal dwelling. The feed has no address lifecycle or building-centroid field.",
    "source": {
      "id": "kingston:addresses",
      "name": "Kingston Civic Address Point - Public",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/d76e1fe447e84cb1983c76e1cb9dadb4/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "municipality",
    "group": "municipality",
    "item": "6d728c87cd6f4fcbaa482d0e6534a7f6",
    "rootUrl": "https://services1.arcgis.com/5GRYvurYYUwAecLQ/arcgis/rest/services/CityofKingstonBoundary/FeatureServer",
    "url": "https://services1.arcgis.com/5GRYvurYYUwAecLQ/arcgis/rest/services/CityofKingstonBoundary/FeatureServer/0",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "City of Kingston Boundary",
    "expectedLayerName": "City of Kingston Boundary",
    "expectedCopyright": "",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "MUNICIPALITY_NAME": "municipality"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "MUNICIPALITY_NAME": "esriFieldTypeString"
    },
    "dates": [],
    "note": "City boundary point confirmation only; this is not a surveyed parcel or title record.",
    "source": {
      "id": "kingston:municipality",
      "name": "Kingston City of Kingston Boundary",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/6d728c87cd6f4fcbaa482d0e6534a7f6/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "permits",
    "group": "permits",
    "item": "df21b0d558164d4088f79c8533e3e6ac",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/BuildingPermits_FGDB/MapServer/0",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/BuildingPermits_FGDB/MapServer/0",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Building Permits",
    "expectedLayerName": "Building Permits",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedAddress",
      "ADDRESSID": "municipalAddressId",
      "PERMIT_NUMBER": "permitNumber",
      "STATUS": "publishedStatus",
      "PROJECTDESCRIPTION": "publishedProjectDescription",
      "USE_TYPE": "publishedUseType",
      "TYPE_OF_WORK": "publishedWorkType",
      "TOTALVALUATION": "publishedValuationText",
      "FEE": "publishedFeeText",
      "DATE_APPLICATION": "applicationDate",
      "DATE_ISSUE": "issuedDate",
      "DATE_EXPIRE": "expiryDate",
      "DATE_CLOSED": "closedDate",
      "DATE_OCC_PERMIT": "publishedOccupancyPermitDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "ADDRESSID": "esriFieldTypeInteger",
      "PERMIT_NUMBER": "esriFieldTypeString",
      "STATUS": "esriFieldTypeString",
      "PROJECTDESCRIPTION": "esriFieldTypeString",
      "USE_TYPE": "esriFieldTypeString",
      "TYPE_OF_WORK": "esriFieldTypeString",
      "TOTALVALUATION": "esriFieldTypeString",
      "FEE": "esriFieldTypeString",
      "DATE_APPLICATION": "esriFieldTypeDate",
      "DATE_ISSUE": "esriFieldTypeDate",
      "DATE_EXPIRE": "esriFieldTypeDate",
      "DATE_CLOSED": "esriFieldTypeDate",
      "DATE_OCC_PERMIT": "esriFieldTypeDate"
    },
    "dates": [
      "DATE_APPLICATION",
      "DATE_ISSUE",
      "DATE_EXPIRE",
      "DATE_CLOSED",
      "DATE_OCC_PERMIT"
    ],
    "note": "Exact civic-address permit observations. Fees and valuation are unparsed source text, not property value or a fee calculation. Closed, issue, expiry and occupancy-permit dates do not establish inspected completion, current occupancy approval or legal units. Complete history and current file status remain unverified.",
    "source": {
      "id": "kingston:permits",
      "name": "Kingston Building Permits",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/df21b0d558164d4088f79c8533e3e6ac/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "planningApplications",
    "group": "planningApplications",
    "item": "c2296d7785644d6f9e5d4f2525c711d5",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/PlanningApplications_FGDB/MapServer/0",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/PlanningApplications_FGDB/MapServer/0",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Active Planning Applications",
    "expectedLayerName": "Active Development Applications FGDB ",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "APP_TYPE": "publishedApplicationType",
      "RECORD_ID": "publishedRecordId",
      "RECORD_STATUS": "publishedStatus",
      "RECORD_TYPE": "publishedRecordType",
      "ADDR_FULL": "publishedAddress",
      "DESCRIPTION": "publishedDescription",
      "PUBLIC_MEETING_DATE": "publishedMeetingDateText",
      "PUBLIC_MEETDATE_TEXT": "publishedMeetingLabel",
      "DASH_URL": "publishedFileUrl",
      "DELEGATED_AUTHORITY": "publishedDelegatedAuthority"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "APP_TYPE": "esriFieldTypeString",
      "RECORD_ID": "esriFieldTypeString",
      "RECORD_STATUS": "esriFieldTypeString",
      "RECORD_TYPE": "esriFieldTypeString",
      "ADDR_FULL": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "PUBLIC_MEETING_DATE": "esriFieldTypeString",
      "PUBLIC_MEETDATE_TEXT": "esriFieldTypeString",
      "DASH_URL": "esriFieldTypeString",
      "DELEGATED_AUTHORITY": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Active application feed matched by exact civic address. Meeting text and source status are preserved without establishing a decision, approval conditions, appeal outcome, current permission or full planning history. Nearby applications and multi-address/range descriptions are not searched.",
    "source": {
      "id": "kingston:planningApplications",
      "name": "Kingston Active Development Applications FGDB ",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/c2296d7785644d6f9e5d4f2525c711d5/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "heritageApplications",
    "group": "heritageApplications",
    "item": "8c7a3bade496421db48b7e905be9fd4a",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/HeritagePermits_FGDB/MapServer/2",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/HeritagePermits_FGDB/MapServer/2",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Active Heritage Applications",
    "expectedLayerName": "Active Heritage Permits",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPoint",
    "fields": {
      "OBJECTID": "recordId",
      "PLANNING_FILE_NUMBER": "publishedFileNumber",
      "APP_TYPE": "publishedApplicationType",
      "ADDR_FULL": "publishedAddress",
      "DESCRIPTION": "publishedDescription",
      "RECORD_ID": "publishedRecordId",
      "RECORD_STATUS": "publishedStatus",
      "RECORD_TYPE": "publishedRecordType",
      "PUBLIC_MEETING_DATE": "publishedMeetingDateText",
      "PUBLIC_MEETDATE_TEXT": "publishedMeetingLabel",
      "DASH_URL": "publishedFileUrl",
      "DELEGATED_AUTHORITY": "publishedDelegatedAuthority"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "PLANNING_FILE_NUMBER": "esriFieldTypeString",
      "APP_TYPE": "esriFieldTypeString",
      "ADDR_FULL": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "RECORD_ID": "esriFieldTypeString",
      "RECORD_STATUS": "esriFieldTypeString",
      "RECORD_TYPE": "esriFieldTypeString",
      "PUBLIC_MEETING_DATE": "esriFieldTypeString",
      "PUBLIC_MEETDATE_TEXT": "esriFieldTypeString",
      "DASH_URL": "esriFieldTypeString",
      "DELEGATED_AUTHORITY": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Active heritage-application feed matched by exact civic address. An application is separate from a designation, an issued heritage permit or permission for the planned work; full file and decision history remain unsearched.",
    "source": {
      "id": "kingston:heritageApplications",
      "name": "Kingston Active Heritage Permits",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/8c7a3bade496421db48b7e905be9fd4a/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "designated",
    "group": "heritage",
    "item": "a9c52dd1623c4b5890389db8aca51061",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/DesignatedHeritageSite/FeatureServer",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/DesignatedHeritageSite/FeatureServer/4",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Designated Heritage Site",
    "expectedLayerName": "Designated Heritage Site",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedAddress",
      "NOTES_NAME_OF_BLDG": "publishedBuildingName",
      "HERITAGE_SITE_ID": "publishedHeritageSiteId",
      "HERITAGE_FILE_NO": "publishedHeritageFileNumber",
      "DESIGNATED": "publishedDesignatedFlag",
      "PART_IV": "publishedPartIVFlag",
      "PART_V": "publishedPartVFlag",
      "OHA_BY_LAW": "publishedDesignationBylaw",
      "OHA_DESIGNATION": "publishedDesignationDate",
      "BY_LAW_AMENDTS": "publishedBylawAmendments",
      "EASEMENT": "publishedEasementFlag",
      "EASEMENT_RGSTD": "publishedEasementRegisteredDate",
      "INTERNAL_DESIGNATION": "publishedInteriorDesignationFlag",
      "DATE_OF_CONSTRUCTION": "publishedConstructionDateText",
      "STMT_OF_SIGNIFCANCE": "publishedSignificance",
      "HERITAGE_ATTRIBUTES": "publishedHeritageAttributes",
      "DEMOLISHED": "publishedDemolishedFlag",
      "DEMOLISHED_DATE": "publishedDemolishedDate",
      "DE_DESIGNATED": "publishedDeDesignatedFlag",
      "DE_DESIGNATED_DATE": "publishedDeDesignationDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "NOTES_NAME_OF_BLDG": "esriFieldTypeString",
      "HERITAGE_SITE_ID": "esriFieldTypeInteger",
      "HERITAGE_FILE_NO": "esriFieldTypeString",
      "DESIGNATED": "esriFieldTypeSmallInteger",
      "PART_IV": "esriFieldTypeSmallInteger",
      "PART_V": "esriFieldTypeSmallInteger",
      "OHA_BY_LAW": "esriFieldTypeString",
      "OHA_DESIGNATION": "esriFieldTypeDate",
      "BY_LAW_AMENDTS": "esriFieldTypeString",
      "EASEMENT": "esriFieldTypeSmallInteger",
      "EASEMENT_RGSTD": "esriFieldTypeDate",
      "INTERNAL_DESIGNATION": "esriFieldTypeSmallInteger",
      "DATE_OF_CONSTRUCTION": "esriFieldTypeString",
      "STMT_OF_SIGNIFCANCE": "esriFieldTypeString",
      "HERITAGE_ATTRIBUTES": "esriFieldTypeString",
      "DEMOLISHED": "esriFieldTypeSmallInteger",
      "DEMOLISHED_DATE": "esriFieldTypeDate",
      "DE_DESIGNATED": "esriFieldTypeSmallInteger",
      "DE_DESIGNATED_DATE": "esriFieldTypeDate"
    },
    "dates": [
      "OHA_DESIGNATION",
      "EASEMENT_RGSTD",
      "DEMOLISHED_DATE",
      "DE_DESIGNATED_DATE"
    ],
    "note": "Published designated-heritage polygons; raw Part IV/Part V, demolition and de-designation flags stay separate. Construction date remains source text. Verify the current register, designation instrument, amendments and alteration permissions; a point match does not establish current designation or parcel-wide coverage.",
    "source": {
      "id": "kingston:designated",
      "name": "Kingston Designated Heritage Site",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/a9c52dd1623c4b5890389db8aca51061/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "listed",
    "group": "heritage",
    "item": "a767803392a64d21b6f86cf840fcadee",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/ListedHeritageProperty/FeatureServer",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/ListedHeritageProperty/FeatureServer/5",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Listed Heritage Property",
    "expectedLayerName": "Listed Heritage Property",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedAddress",
      "NOTES_NAME_OF_BLDG": "publishedBuildingName",
      "HERITAGE_SITE_ID": "publishedHeritageSiteId",
      "HERITAGE_FILE_NO": "publishedHeritageFileNumber",
      "PROP_OF_CULT_HTG_VAL": "publishedCulturalHeritageValueFlag",
      "DATE_OF_CONSTRUCTION": "publishedConstructionDateText",
      "DE_LISTED": "publishedDeListedFlag",
      "DE_LISTED_DATE": "publishedDeListedDate",
      "STMT_OF_SIGNIFCANCE": "publishedSignificance",
      "HERITAGE_ATTRIBUTES": "publishedHeritageAttributes"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "NOTES_NAME_OF_BLDG": "esriFieldTypeString",
      "HERITAGE_SITE_ID": "esriFieldTypeInteger",
      "HERITAGE_FILE_NO": "esriFieldTypeString",
      "PROP_OF_CULT_HTG_VAL": "esriFieldTypeSmallInteger",
      "DATE_OF_CONSTRUCTION": "esriFieldTypeString",
      "DE_LISTED": "esriFieldTypeSmallInteger",
      "DE_LISTED_DATE": "esriFieldTypeDate",
      "STMT_OF_SIGNIFCANCE": "esriFieldTypeString",
      "HERITAGE_ATTRIBUTES": "esriFieldTypeString"
    },
    "dates": [
      "DE_LISTED_DATE"
    ],
    "note": "Published listed-heritage polygons; listing is separate from Part IV designation. Preserve de-listing fields and verify the current register. Construction dates can be approximate text; owner and mailing fields are excluded.",
    "source": {
      "id": "kingston:listed",
      "name": "Kingston Listed Heritage Property",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/a767803392a64d21b6f86cf840fcadee/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "easement",
    "group": "heritage",
    "item": "d3937f915a424f9f8db3a78e381c271c",
    "rootUrl": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/HeritageEasement/FeatureServer",
    "url": "https://api.cityofkingston.ca/gis_unfed/rest/services/Planning/HeritageEasement/FeatureServer/3",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Heritage Easement",
    "expectedLayerName": "Heritage Easement",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ADDRESS": "publishedAddress",
      "HERITAGE_SITE_ID": "publishedHeritageSiteId",
      "HERITAGE_FILE_NO": "publishedHeritageFileNumber",
      "EASEMENT": "publishedEasementFlag",
      "EASEMENT_RGSTD": "publishedEasementRegisteredDate",
      "PART_IV": "publishedPartIVFlag",
      "PART_V": "publishedPartVFlag",
      "OHA_BY_LAW": "publishedDesignationBylaw",
      "BY_LAW_AMENDTS": "publishedBylawAmendments",
      "DEMOLISHED": "publishedDemolishedFlag",
      "STMT_OF_SIGNIFCANCE": "publishedSignificance",
      "HERITAGE_ATTRIBUTES": "publishedHeritageAttributes"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ADDRESS": "esriFieldTypeString",
      "HERITAGE_SITE_ID": "esriFieldTypeInteger",
      "HERITAGE_FILE_NO": "esriFieldTypeString",
      "EASEMENT": "esriFieldTypeSmallInteger",
      "EASEMENT_RGSTD": "esriFieldTypeDate",
      "PART_IV": "esriFieldTypeSmallInteger",
      "PART_V": "esriFieldTypeSmallInteger",
      "OHA_BY_LAW": "esriFieldTypeString",
      "BY_LAW_AMENDTS": "esriFieldTypeString",
      "DEMOLISHED": "esriFieldTypeSmallInteger",
      "STMT_OF_SIGNIFCANCE": "esriFieldTypeString",
      "HERITAGE_ATTRIBUTES": "esriFieldTypeString"
    },
    "dates": [
      "EASEMENT_RGSTD"
    ],
    "note": "Published heritage-easement mapping only. A source flag/date is not a title search, the easement instrument or verification of current obligations. Request the registered instrument and current City confirmation.",
    "source": {
      "id": "kingston:easement",
      "name": "Kingston Heritage Easement",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/d3937f915a424f9f8db3a78e381c271c/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "heritageDistrict",
    "group": "heritageDistrict",
    "item": "1c3e1df8da3a427cbea660cd6ba3d056",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/1c3e1df8da3a427cbea660cd6ba3d056/rest/services/Heritage_District/FeatureServer/0",
    "url": "https://utility.arcgis.com/usrsvcs/servers/1c3e1df8da3a427cbea660cd6ba3d056/rest/services/Heritage_District/FeatureServer/0",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Heritage Conservation District",
    "expectedLayerName": "Heritage District",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedDistrictName",
      "HTG_DIST_ID": "publishedDistrictId",
      "STATUS": "publishedStatus",
      "LAST_EDITED_DATE": "recordModifiedDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "HTG_DIST_ID": "esriFieldTypeSmallInteger",
      "STATUS": "esriFieldTypeString",
      "LAST_EDITED_DATE": "esriFieldTypeDate"
    },
    "dates": [
      "LAST_EDITED_DATE"
    ],
    "note": "Published district boundaries and raw status only. Proposed/study areas are not assumed designated or in force. Individual designation, district bylaw/effective date and alteration permission require current verification.",
    "source": {
      "id": "kingston:heritageDistrict",
      "name": "Kingston Heritage District",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/1c3e1df8da3a427cbea660cd6ba3d056/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "parentZone",
    "group": "zoning",
    "item": "528acb24c6da484daf8a3974a6731954",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/528acb24c6da484daf8a3974a6731954/rest/services/Planning/ParentZoning/FeatureServer/0",
    "url": "https://utility.arcgis.com/usrsvcs/servers/528acb24c6da484daf8a3974a6731954/rest/services/Planning/ParentZoning/FeatureServer/0",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Schedule 1 - Zone Map: Kingston Zoning By-Law (2022-62) ",
    "expectedLayerName": "ParentZoning",
    "expectedCopyright": "",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "ZONEID": "publishedZoneId",
      "ZONE_CODE": "publishedZoneCode",
      "ZONE_DESC": "publishedZoneDescription",
      "ZONE_CATEGORY": "publishedZoneCategory"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "ZONEID": "esriFieldTypeSmallInteger",
      "ZONE_CODE": "esriFieldTypeString",
      "ZONE_DESC": "esriFieldTypeString",
      "ZONE_CATEGORY": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published 2022-62 parent-zone point mapping. Not Subject to this By-law and N/A retain their literal meaning; former bylaws, transitions, legal maps, exceptions and current amendments must be checked. This is not development permission.",
    "source": {
      "id": "kingston:parentZone",
      "name": "Kingston ParentZoning",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/528acb24c6da484daf8a3974a6731954/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "exceptions",
    "group": "zoning",
    "item": "ee3abdffc3cc435ca5aa5ff249c8a4e0",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ee3abdffc3cc435ca5aa5ff249c8a4e0/rest/services/Planning/Schedule_E_Zone_Exception_Overlay/FeatureServer/1",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ee3abdffc3cc435ca5aa5ff249c8a4e0/rest/services/Planning/Schedule_E_Zone_Exception_Overlay/FeatureServer/1",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Schedule E - Zone Exception Overlay: Kingston Zoning By-Law (2022-62)",
    "expectedLayerName": "SchduleE_ZoneExceptions",
    "expectedCopyright": "",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "EXCEPTION_NUMBER": "publishedExceptionNumber",
      "EXCEPTION_TYPE": "publishedExceptionType",
      "ADDRESS": "publishedAddress",
      "BYLAW": "publishedBylaw",
      "ENACTED_BYLAW": "publishedEnactedBylaw",
      "FILE_NUMBER": "publishedFileNumber",
      "EXCEPTION_TEXT": "publishedExceptionText",
      "ZONE_CODE": "publishedZoneCode"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "EXCEPTION_NUMBER": "esriFieldTypeString",
      "EXCEPTION_TYPE": "esriFieldTypeString",
      "ADDRESS": "esriFieldTypeString",
      "BYLAW": "esriFieldTypeString",
      "ENACTED_BYLAW": "esriFieldTypeString",
      "FILE_NUMBER": "esriFieldTypeString",
      "EXCEPTION_TEXT": "esriFieldTypeString",
      "ZONE_CODE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Schedule E exception point mapping and raw text; official original bylaws/amendments take precedence. This is not current legal interpretation, a complete exception search or permission.",
    "source": {
      "id": "kingston:exceptions",
      "name": "Kingston SchduleE_ZoneExceptions",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ee3abdffc3cc435ca5aa5ff249c8a4e0/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "holding",
    "group": "zoning",
    "item": "fffa8d2fcc97472cbeb61762f28579e8",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/fffa8d2fcc97472cbeb61762f28579e8/rest/services/Planning/Schedule_F_Holding_Overlay/FeatureServer/0",
    "url": "https://utility.arcgis.com/usrsvcs/servers/fffa8d2fcc97472cbeb61762f28579e8/rest/services/Planning/Schedule_F_Holding_Overlay/FeatureServer/0",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Schedule F - Holding Overlay: Kingston Zoning By-Law (2022-62)",
    "expectedLayerName": "Schedule F - Holding Overlay",
    "expectedCopyright": "",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID_12",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID_12": "recordId",
      "HOLDINGNUMBER": "publishedHoldingNumber",
      "ZONECODE": "publishedZoneCode",
      "ZONEDESCRIPTION": "publishedZoneDescription",
      "ZONECATEGORY": "publishedZoneCategory",
      "FULLADDRESS": "publishedAddress",
      "HOLDINGTEXT": "publishedHoldingText",
      "BYLAW": "publishedBylaw",
      "ENACTEDBYLAW": "publishedEnactedBylaw",
      "FILENUMBER": "publishedFileNumber"
    },
    "fieldTypes": {
      "OBJECTID_12": "esriFieldTypeOID",
      "HOLDINGNUMBER": "esriFieldTypeString",
      "ZONECODE": "esriFieldTypeString",
      "ZONEDESCRIPTION": "esriFieldTypeString",
      "ZONECATEGORY": "esriFieldTypeString",
      "FULLADDRESS": "esriFieldTypeString",
      "HOLDINGTEXT": "esriFieldTypeString",
      "BYLAW": "esriFieldTypeString",
      "ENACTEDBYLAW": "esriFieldTypeString",
      "FILENUMBER": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Schedule F hold and raw text only. A mapped holding provision is not proof it remains applicable or has been removed. Verify current enactments, removal instruments, transitions and parcel-wide requirements.",
    "source": {
      "id": "kingston:holding",
      "name": "Kingston Schedule F - Holding Overlay",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/fffa8d2fcc97472cbeb61762f28579e8/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "formerBylawBoundary",
    "group": "zoning",
    "item": "1f50fa1dd1f6473b815b156be19bda75",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/1f50fa1dd1f6473b815b156be19bda75/rest/services/Planning/Zoning_Bylaw_Boundary/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/1f50fa1dd1f6473b815b156be19bda75/rest/services/Planning/Zoning_Bylaw_Boundary/MapServer/0",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Former Zoning Bylaw Boundary",
    "expectedLayerName": "Zoning Bylaw Boundary",
    "expectedCopyright": "Corporation of the City of Kingston",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "publishedAreaName",
      "ZONINGBYLAW": "publishedFormerBylawNumber"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "ZONINGBYLAW": "esriFieldTypeSmallInteger"
    },
    "dates": [],
    "note": "Former bylaw reference areas only. The former bylaws were generally repealed except lands not subject to 2022-62 and transition/interpretation provisions. A former-boundary intersection does not prove that former bylaw currently governs this parcel.",
    "source": {
      "id": "kingston:formerBylawBoundary",
      "name": "Kingston Zoning Bylaw Boundary",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/1f50fa1dd1f6473b815b156be19bda75/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "landUse",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/11",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Land Use Designation",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "CODE": "publishedLandUseCode",
      "AREA_ID": "publishedAreaId",
      "DESCRIPTION": "publishedLandUseDescription"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CODE": "esriFieldTypeString",
      "AREA_ID": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Existing-plan land-use mapping only. The City publishes a May 31, 2025 consolidation and is consulting on a new draft plan. Current legal schedules, written policies, later amendments and appeals are unverified; draft mapping is not in-force policy.",
    "source": {
      "id": "kingston:landUse",
      "name": "Kingston Land Use Designation",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "secondaryPlanBoundary",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/3",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Secondary Plan Boundary",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "SECP_NAME": "publishedSecondaryPlanName",
      "SCHEDULE": "publishedSchedule"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "SECP_NAME": "esriFieldTypeString",
      "SCHEDULE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Existing secondary-plan reference boundary only; verify current written policies, schedules, amendments and appeals.",
    "source": {
      "id": "kingston:secondaryPlanBoundary",
      "name": "Kingston Secondary Plan Boundary",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "cataraquiNorth",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/4",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Cat North Land Use",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "CODE": "publishedLandUseCode",
      "DESCRIPTION": "publishedLandUseDescription",
      "SCHEDULE": "publishedSchedule"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CODE": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "SCHEDULE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Cataraqui North secondary-plan land-use references only; current applicable policy is unverified.",
    "source": {
      "id": "kingston:cataraquiNorth",
      "name": "Kingston Cat North Land Use",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "cataraquiWest",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/13",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Cat West Land Use",
    "expectedCopyright": "Planning, Building and Licensing Services, Corporation of the City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "CODE": "publishedLandUseCode",
      "DESCRIPTION": "publishedLandUseDescription",
      "SCHEDULE": "publishedSchedule"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CODE": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "SCHEDULE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Cataraqui West secondary-plan land-use references only; current applicable policy is unverified.",
    "source": {
      "id": "kingston:cataraquiWest",
      "name": "Kingston Cat West Land Use",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "provincialCampus",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/6",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Kingston Provincial Campus Land Use",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "CODE": "publishedLandUseCode",
      "DESCRIPTION": "publishedLandUseDescription",
      "SCHEDULE": "publishedSchedule"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CODE": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "SCHEDULE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Kingston Provincial Campus secondary-plan land-use references only; current applicable policy is unverified.",
    "source": {
      "id": "kingston:provincialCampus",
      "name": "Kingston Kingston Provincial Campus Land Use",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "rideauLandUse",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/9",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Rideau Land Use",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "CODE": "publishedLandUseCode",
      "DESCRIPTION": "publishedLandUseDescription",
      "SCHEDULE": "publishedSchedule"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "CODE": "esriFieldTypeString",
      "DESCRIPTION": "esriFieldTypeString",
      "SCHEDULE": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Published Rideau secondary-plan land-use references only; current applicable policy is unverified.",
    "source": {
      "id": "kingston:rideauLandUse",
      "name": "Kingston Rideau Land Use",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "siteSpecificPolicy",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/10",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Site Specific Policy Area",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "POLICY": "publishedPolicyReference",
      "SITE_ID": "publishedSiteId",
      "LOCATION": "publishedLocation",
      "FILE_NUMBER": "publishedFileNumber",
      "BY_LAW": "publishedBylaw",
      "BYLAW_DATE": "publishedBylawDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "POLICY": "esriFieldTypeString",
      "SITE_ID": "esriFieldTypeInteger",
      "LOCATION": "esriFieldTypeString",
      "FILE_NUMBER": "esriFieldTypeString",
      "BY_LAW": "esriFieldTypeString",
      "BYLAW_DATE": "esriFieldTypeDate"
    },
    "dates": [
      "BYLAW_DATE"
    ],
    "note": "Published site-specific policy reference areas only; the policy number is not the current policy text or a verified permission.",
    "source": {
      "id": "kingston:siteSpecificPolicy",
      "name": "Kingston Site Specific Policy Area",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "rideauSiteSpecificPolicy",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/8",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Rideau Site Specific Policy",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "FILE_NUMBER": "publishedFileNumber",
      "POLICY_NO": "publishedPolicyReference",
      "LOCATION": "publishedLocation",
      "BY_LAW": "publishedBylaw",
      "BYLAW_APPROVAL_DATE": "publishedBylawApprovalDate"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "FILE_NUMBER": "esriFieldTypeString",
      "POLICY_NO": "esriFieldTypeString",
      "LOCATION": "esriFieldTypeString",
      "BY_LAW": "esriFieldTypeString",
      "BYLAW_APPROVAL_DATE": "esriFieldTypeDate"
    },
    "dates": [
      "BYLAW_APPROVAL_DATE"
    ],
    "note": "Published Rideau site-specific policy references and source dates only; current text, approval conditions and appeals are unverified.",
    "source": {
      "id": "kingston:rideauSiteSpecificPolicy",
      "name": "Kingston Rideau Site Specific Policy",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "opa50AppealMapping",
    "group": "officialPlan",
    "item": "ae3b512c3ea44e44a34213031ff08c14",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/ae3b512c3ea44e44a34213031ff08c14/rest/services/Planning/OP3_LandUse/MapServer/1",
    "owner": "kingstonarcgisadmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Land Use Designation - Official Plan",
    "expectedLayerName": "Property Subject to OMB Appeal (OPA No. 50)",
    "expectedCopyright": "Planning Division, City of Kingston",
    "termsHash": "39e749a90d8a4d33f63721053ce9f7d09b1b73c84898b00d15b8b8766a6ca17b",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "LOCATION": "publishedLocation",
      "PLANNING_FILE_NUMBER": "publishedFileNumber",
      "NOTES": "publishedNotes",
      "STATUS": "publishedStatus"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "LOCATION": "esriFieldTypeString",
      "PLANNING_FILE_NUMBER": "esriFieldTypeString",
      "NOTES": "esriFieldTypeString",
      "STATUS": "esriFieldTypeString"
    },
    "dates": [],
    "note": "Legacy OPA 50 appeal mapping and raw status only. The City reports OPA 50 took effect August 29, 2017; this layer does not establish a still-active appeal, current tribunal outcome or a complete appeal search.",
    "source": {
      "id": "kingston:opa50AppealMapping",
      "name": "Kingston Property Subject to OMB Appeal (OPA No. 50)",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/ae3b512c3ea44e44a34213031ff08c14/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "floodplainOverlay",
    "group": "floodplainOverlay",
    "item": "8c60472eb22e42a09f319d83d8f918e4",
    "rootUrl": "https://utility.arcgis.com/usrsvcs/servers/8c60472eb22e42a09f319d83d8f918e4/rest/services/Parks/ScheduleA_FloodplainOverlay/FeatureServer",
    "url": "https://utility.arcgis.com/usrsvcs/servers/8c60472eb22e42a09f319d83d8f918e4/rest/services/Parks/ScheduleA_FloodplainOverlay/FeatureServer/0",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Schedule A - Floodplain Overlay: Kingston Zoning By-Law (2022-62)",
    "expectedLayerName": "Schedule A - Floodplain Overlaw",
    "expectedCopyright": "",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId",
      "NOTE": "publishedNote",
      "FEATURETYPE": "publishedFeatureType",
      "FEATUREID": "publishedFeatureId",
      "ELEVATION": "publishedElevationUnknownUnits"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NOTE": "esriFieldTypeString",
      "FEATURETYPE": "esriFieldTypeString",
      "FEATUREID": "esriFieldTypeString",
      "ELEVATION": "esriFieldTypeInteger"
    },
    "dates": [],
    "note": "Published zoning Schedule A floodplain point overlay only. Elevation units/datum are not supplied. This is separate from conservation-authority regulatory limits, a flood-risk rating, flood safety, insurance eligibility or a parcel-wide survey.",
    "source": {
      "id": "kingston:floodplainOverlay",
      "name": "Kingston Schedule A - Floodplain Overlaw",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/8c60472eb22e42a09f319d83d8f918e4/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  },
  {
    "market": "Kingston",
    "key": "airportNoiseOverlay",
    "group": "airportNoiseOverlay",
    "item": "98464203faa24351b02038427323ee6a",
    "rootUrl": "https://services1.arcgis.com/5GRYvurYYUwAecLQ/arcgis/rest/services/Schedule_C_Noise_Exposure_Forecast_30/FeatureServer",
    "url": "https://services1.arcgis.com/5GRYvurYYUwAecLQ/arcgis/rest/services/Schedule_C_Noise_Exposure_Forecast_30/FeatureServer/0",
    "owner": "PlanningGISAdmin",
    "org": "5GRYvurYYUwAecLQ",
    "expectedItemTitle": "Schedule C - Airport Noise Overlay: Kingston Zoning By-Law (2022-62)",
    "expectedLayerName": "Schedule C - Noise Exposure Forecast (30)",
    "expectedCopyright": "Planning, Building and Licensing Services",
    "termsHash": "ed3f867b5c8dc72845ecf335680c5b777c1ab22065223e828144bfc2b8226eb9",
    "oid": "OBJECTID",
    "geometry": "esriGeometryPolygon",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "dates": [],
    "note": "Published zoning Schedule C Noise Exposure Forecast (30) boundary point overlay. The layer supplies no measured sound, present-day noise, flight schedule or acoustic suitability determination.",
    "source": {
      "id": "kingston:airportNoiseOverlay",
      "name": "Kingston Schedule C - Noise Exposure Forecast (30)",
      "url": "https://opendatakingston.cityofkingston.ca/datasets/98464203faa24351b02038427323ee6a/about",
      "licence": "City of Kingston Open Data Licence 1.0",
      "licenceUrl": "https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf",
      "attribution": "Contains information licensed under the Open Data Licence – City of Kingston."
    }
  }
];
export const KINGSTON_WITHHELD=[
  {
    "layer": "additionalUnitOverlays",
    "item": "f04fd4b146874c1ea76e304f9a65efae",
    "reason": "Schedule D1 credits Utilities Kingston; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "additionalUnitOverlays",
    "item": "cd936f5a03b14c00aca02c83adff76ee",
    "reason": "Schedule D2 credits Utilities Kingston; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "additionalUnitOverlays",
    "item": "cd4746364b7f474cacfed6e4156f8945",
    "reason": "Schedule D3 credits Utilities Kingston; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "servicingAllocation",
    "item": "4bae8a9c357d4b06b9e079a461ffe1dc",
    "reason": "Schedule J credits Utilities Kingston; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "nonResidentialConversion",
    "item": "f1265748cf88418183bf56fd837967b6",
    "reason": "Schedule G credits MPAC and Teranet; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "wellheadProtection",
    "item": "af6de0cf135b43769ecc19c31d550224",
    "reason": "Source credits CRCA; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "intakeProtection",
    "item": "62b615138148489f8f1f7ef4f8cb6433",
    "reason": "Source credits CRCA; third-party reuse authorization is not verified. No property records are queried."
  },
  {
    "layer": "draftOfficialPlan",
    "item": "659f82426e5741f9aa14577b3ab58af0",
    "reason": "Draft 2 heritage/archaeology mapping has no explicit reuse grant and is not in-force policy. No property records are queried."
  },
  {
    "layer": "draftOfficialPlan",
    "item": "86a1067e49274e0385244689491d7594",
    "reason": "Draft 2 natural-heritage mapping has no explicit reuse grant and is not in-force policy. No property records are queried."
  }
];
