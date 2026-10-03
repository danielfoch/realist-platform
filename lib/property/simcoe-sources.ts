import type { Source } from "./model";
export const SIMCOE_MUNICIPALITIES = ["Adjala-Tosorontio", "Bradford West Gwillimbury", "Clearview", "Collingwood", "Essa", "Innisfil", "Midland", "New Tecumseth", "Oro-Medonte", "Penetanguishene", "Ramara", "Severn", "Springwater", "Tay", "Tiny", "Wasaga Beach", "Barrie", "Orillia"] as const;
export const SIMCOE_GRANT = { termsUrl: "https://maps.simcoe.ca/terms.html", termsHash: "323039147fd64b75c62d6386b3272010a9df8c747fb35a3821c0100bf0c2c247", licenceUrl: "https://maps.simcoe.ca/openlicense.html", licenceHash: "78352ef3a2c7cc687d4b438e88ba1f6109bda869c9aa31311764ba384d16434b" };
export interface SimcoeFeed { name:string; key:string; title:string; nativeName:string; layerUrl:string; typeUrl:string; definitionHash:string; layerAttributionHash:string; schemaHash:string; fields:Record<string,string>; fieldTypes:Record<string,string>; note:string; source:Source; }
export const SIMCOE_FEEDS: SimcoeFeed[] = [
  {
    "name": "Address_Number",
    "key": "simcoeMunicipalAddresses",
    "title": "Address Number",
    "nativeName": "ssview_sc_civicaddresspts",
    "layerUrl": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Address_Number.json",
    "typeUrl": "https://opengis.simcoe.ca/geoserver/rest/workspaces/simcoe/datastores/sandy_postgres_weblive_sde_public/featuretypes/Address_Number.json",
    "definitionHash": "57d60c1430d229aab48184b573ea917e71ad0ea12b361c475fc165fefbe66521",
    "layerAttributionHash": "3b8f8941e5f83ad730cb8ca3f1e34054c74d499b13551a5dd87d9ca3ee02adc4",
    "schemaHash": "4d82c4fb1b1cc4967d3f03142206fa4f109f600a540a89391aee5401dbc942f5",
    "fields": {
      "objectid": "recordId",
      "stnum": "publishedNumber",
      "full_address": "publishedAddress",
      "fullname": "publishedStreet",
      "unit": "publishedUnit",
      "muni": "publishedMunicipality"
    },
    "fieldTypes": {
      "objectid": "java.lang.Integer",
      "stnum": "java.lang.Integer",
      "full_address": "java.lang.String",
      "fullname": "java.lang.String",
      "unit": "java.lang.String",
      "muni": "java.lang.String"
    },
    "note": "Strict complete civic attributes only; multiple observations, unresolved units or incomplete queries are ambiguous. County property-location geometry is never reused to select a building point.",
    "source": {
      "id": "simcoe:simcoeMunicipalAddresses",
      "name": "Simcoe County — Address Number",
      "url": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Address_Number.json",
      "licence": "Open Government Licence – Simcoe County 1.0",
      "licenceUrl": "https://maps.simcoe.ca/openlicense.html",
      "attribution": "Contains information licensed under the Open Government Licence – Simcoe County. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "name": "Building",
    "key": "simcoeBuildingFootprintReference",
    "title": "Building",
    "nativeName": "ssview_building",
    "layerUrl": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Building.json",
    "typeUrl": "https://opengis.simcoe.ca/geoserver/rest/workspaces/simcoe/datastores/sandy_postgres_weblive_sde_public/featuretypes/Building.json",
    "definitionHash": "5dec44ce2912b847fcae2a2837f683f74ffeb8849992854dcbcfcd1e485b17f2",
    "layerAttributionHash": "3b8f8941e5f83ad730cb8ca3f1e34054c74d499b13551a5dd87d9ca3ee02adc4",
    "schemaHash": "ce6945943ea1278f2366ab55a4f171aab46a7d18d5abb505ad8cdde93921df0c",
    "fields": {
      "Name": "publishedName",
      "Building Type": "publishedBuildingType"
    },
    "fieldTypes": {
      "Name": "java.lang.String",
      "Building Type": "java.lang.String"
    },
    "note": "General imagery-derived building reference. Published metadata says updates every two to three years; actual observation vintage is unspecified. No geometry, surveyed measurements, construction year, present condition, use permission or legal unit count is returned.",
    "source": {
      "id": "simcoe:simcoeBuildingFootprintReference",
      "name": "Simcoe County — Building",
      "url": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Building.json",
      "licence": "Open Government Licence – Simcoe County 1.0",
      "licenceUrl": "https://maps.simcoe.ca/openlicense.html",
      "attribution": "Contains information licensed under the Open Government Licence – Simcoe County. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "name": "Municipal_Borders",
    "key": "simcoeMunicipalBoundaryReference",
    "title": "Municipal Borders",
    "nativeName": "ssview_sc_simcoectyjurisdictions",
    "layerUrl": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Municipal_Borders.json",
    "typeUrl": "https://opengis.simcoe.ca/geoserver/rest/workspaces/simcoe/datastores/sandy_postgres_weblive_sde_public/featuretypes/Municipal_Borders.json",
    "definitionHash": "c1e43e041dfe63a067c3d2fa1b83f3fe3036df3861028b61cb2fee543d253d5a",
    "layerAttributionHash": "3b8f8941e5f83ad730cb8ca3f1e34054c74d499b13551a5dd87d9ca3ee02adc4",
    "schemaHash": "4e20f07d085666d771c2050fa93e7d02efe380dc2a06bfbbae00ac252f8c1798",
    "fields": {
      "Name": "publishedName",
      "Type": "publishedJurisdictionType"
    },
    "fieldTypes": {
      "Name": "java.lang.String",
      "Type": "java.lang.String"
    },
    "note": "Unofficial County jurisdiction labels only, including separated cities, First Nations and CFB Borden. These references never substitute for the independent original Ontario municipality gate or verify current legal boundaries.",
    "source": {
      "id": "simcoe:simcoeMunicipalBoundaryReference",
      "name": "Simcoe County — Municipal Borders",
      "url": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Municipal_Borders.json",
      "licence": "Open Government Licence – Simcoe County 1.0",
      "licenceUrl": "https://maps.simcoe.ca/openlicense.html",
      "attribution": "Contains information licensed under the Open Government Licence – Simcoe County. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "name": "Municipal_Ward_Boundary",
    "key": "simcoeWardReference",
    "title": "Municipal Ward Boundary",
    "nativeName": "ssview_sc_wardbndy",
    "layerUrl": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Municipal_Ward_Boundary.json",
    "typeUrl": "https://opengis.simcoe.ca/geoserver/rest/workspaces/simcoe/datastores/sandy_postgres_weblive_sde_public/featuretypes/Municipal_Ward_Boundary.json",
    "definitionHash": "56e64027ea80ce892d43e47b5547a2f0d722808ec290ce751b05aa6f0a76f5c5",
    "layerAttributionHash": "3b8f8941e5f83ad730cb8ca3f1e34054c74d499b13551a5dd87d9ca3ee02adc4",
    "schemaHash": "4685b243e29d1526e15f9c1e9f653fad192cc0f45b213d82be65cb441c865571",
    "fields": {
      "Label": "publishedWardLabel"
    },
    "fieldTypes": {
      "Label": "java.lang.String"
    },
    "note": "County compilation describes wards for the last election and four-year updates without identifying the election year. Current ward and representative assignment remain unverified.",
    "source": {
      "id": "simcoe:simcoeWardReference",
      "name": "Simcoe County — Municipal Ward Boundary",
      "url": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Municipal_Ward_Boundary.json",
      "licence": "Open Government Licence – Simcoe County 1.0",
      "licenceUrl": "https://maps.simcoe.ca/openlicense.html",
      "attribution": "Contains information licensed under the Open Government Licence – Simcoe County. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "name": "Curbside_Waste_Collection_Day",
    "key": "simcoeWasteCollectionReference",
    "title": "Curbside Waste Collection Day",
    "nativeName": "ssview_sc_solidwastecollectiondays",
    "layerUrl": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Curbside_Waste_Collection_Day.json",
    "typeUrl": "https://opengis.simcoe.ca/geoserver/rest/workspaces/simcoe/datastores/sandy_postgres_weblive_sde_public/featuretypes/Curbside_Waste_Collection_Day.json",
    "definitionHash": "f32b1341489e32243b6738f133a553ca2e4807cbe2bbbb0ca1beb070188b269b",
    "layerAttributionHash": "3b8f8941e5f83ad730cb8ca3f1e34054c74d499b13551a5dd87d9ca3ee02adc4",
    "schemaHash": "cac041fcfbbab9ba835e414744d399b4baaad4060f598c048517b001ecfa69a7",
    "fields": {
      "Collection Day": "publishedCollectionDay",
      "_collectionday": "publishedInternalCollectionDay"
    },
    "fieldTypes": {
      "Collection Day": "java.lang.String",
      "_collectionday": "java.lang.String"
    },
    "note": "Normal County collection-zone labels only. Preserve NO COLLECTION literally; separated-city service, actual eligibility/connection, holiday and special collection schedules remain unverified.",
    "source": {
      "id": "simcoe:simcoeWasteCollectionReference",
      "name": "Simcoe County — Curbside Waste Collection Day",
      "url": "https://opengis.simcoe.ca/geoserver/rest/layers/simcoe:Curbside_Waste_Collection_Day.json",
      "licence": "Open Government Licence – Simcoe County 1.0",
      "licenceUrl": "https://maps.simcoe.ca/openlicense.html",
      "attribution": "Contains information licensed under the Open Government Licence – Simcoe County. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  }
];
export const SIMCOE_WITHHELD = [
  {
    "layer": "Municipal_Park",
    "reason": "Inspected County feature-type metadata has no DOWNLOAD mark. Public visibility and the generic licence footer do not establish the specific downloadable open-data exception. Records, counts and geometry remain unqueried."
  },
  {
    "layer": "Economic_Development_Business_Improvement_Area",
    "reason": "Inspected County feature-type metadata has no DOWNLOAD mark. Public visibility and the generic licence footer do not establish the specific downloadable open-data exception. Records, counts and geometry remain unqueried."
  },
  {
    "layer": "Economic_Development_Municipal_Incentives",
    "reason": "Inspected County feature-type metadata has no DOWNLOAD mark. Public visibility and the generic licence footer do not establish the specific downloadable open-data exception. Records, counts and geometry remain unqueried."
  },
  {
    "layer": "Transit_Stop_Linx",
    "reason": "Inspected County feature-type metadata has no DOWNLOAD mark. Public visibility and the generic licence footer do not establish the specific downloadable open-data exception. Records, counts and geometry remain unqueried."
  },
  {
    "layer": "County_Forestry_Tract",
    "reason": "Inspected County feature-type metadata has no DOWNLOAD mark. Public visibility and the generic licence footer do not establish the specific downloadable open-data exception. Records, counts and geometry remain unqueried."
  }
];
export const SIMCOE_GUIDANCE = { viewer:"https://opengis.simcoe.ca/", orilliaPropertyCompliance:"https://www.orillia.ca/build-and-invest/permits-and-inspections/property-compliance/", orilliaPlanning:"https://www.orillia.ca/build-and-invest/planning-and-development/planning-documents/", orilliaPermits:"https://www.orillia.ca/build-and-invest/permits-and-inspections/building-permits-and-inspections/building-permits/" };
