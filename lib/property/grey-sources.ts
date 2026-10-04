import type { Source } from './model';
export interface GreyFeed { key:string; kind:'settlement'|'plan'; item:string; itemTitle:string; itemDefinitionHash:string; root:string; rootItem:string; child:number; name:string; display:string; fields:Record<string,string>; fieldTypes:Record<string,string>; metadataDefinitionHash:string; note:string; source:Source; }
export const GREY_MUNICIPALITIES=['Owen Sound','Georgian Bluffs','Meaford','The Blue Mountains','Chatsworth','Southgate','West Grey','Grey Highlands','Hanover'] as const;
export const GREY_GRANT = {
  "site": "645d414b2614427e91efc9c197c79657",
  "termsItem": "9bada6ae370e479f8fa98774a0219bd5",
  "termsTitle": "Terms",
  "termsHash": "849b8c1cb6062a8020e558d85d3c35e97f0ceaad87505a85aea7b50b9ab71f70"
};
export const GREY_FEEDS:GreyFeed[] = [
  {
    "key": "greySettlementReference",
    "kind": "settlement",
    "item": "f16f12e9f4f549d5a46331aa844599a1",
    "itemTitle": "Grey County Settlements",
    "itemDefinitionHash": "6116bbef00772621d33994f98ccfae1ebed99f556f0c06f06f2e4e32df15b0ee",
    "root": "https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Grey_County_Reference_Layers_-_Open_Data/FeatureServer",
    "rootItem": "b36d77fb4a8145eebc0ab1ff602b55bf",
    "child": 4,
    "name": "Grey County Settlements",
    "display": "NAME",
    "fields": {
      "OBJECTID": "recordId",
      "NAME": "reportedSettlementName",
      "TYPE": "reportedSettlementType",
      "MUNICIPAL": "reportedMunicipalCode",
      "EDIT_DATE": "recordEditedEpochMilliseconds"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "NAME": "esriFieldTypeString",
      "TYPE": "esriFieldTypeString",
      "MUNICIPAL": "esriFieldTypeString",
      "EDIT_DATE": "esriFieldTypeDate"
    },
    "metadataDefinitionHash": "060fb61afc5c503c06fd44b0770ce3a01f00623b38ade3d5d3af341f0c234d62",
    "note": "Published settlement reference; a duplicate of the separate Settlement Boundaries offer is counted only here. Settlement type and municipal code do not establish current adopted boundaries, actual servicing, capacity, urban eligibility or development permission.",
    "source": {
      "id": "grey:greySettlementReference",
      "name": "Grey County — Grey County Settlements",
      "url": "https://services1.arcgis.com/wE2uWQWlTTnVDgyt/arcgis/rest/services/Grey_County_Reference_Layers_-_Open_Data/FeatureServer/4",
      "licence": "Open Data Licence – Grey County",
      "licenceUrl": "https://maps.grey.ca/pages/terms",
      "attribution": "Contains information licensed under the Grey County Open Data Licence. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "key": "greyHistoricalLandUseReference",
    "kind": "plan",
    "item": "c0a0ede3dc764d17a819adf6c46c614f",
    "itemTitle": "Official Plan Schedule A - Land Use",
    "itemDefinitionHash": "f6f00f7c1a0efca1f521a205a63a45f973da7812fb45c18044a684020ddd99dc",
    "root": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer",
    "rootItem": "58d30be6c16242a48ed15c5f71b37e18",
    "child": 30,
    "name": "Land use",
    "display": "Final_Type",
    "fields": {
      "OBJECTID": "recordId",
      "Final_Type": "reportedLandUse",
      "Opa_num": "reportedAmendmentNumber",
      "Approved": "reportedApprovalCode",
      "Approved_Date": "reportedApprovalEpochMilliseconds",
      "Edit_Date": "recordEditedEpochMilliseconds",
      "Exception": "reportedException",
      "By_Law": "reportedBylaw"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID",
      "Final_Type": "esriFieldTypeString",
      "Opa_num": "esriFieldTypeString",
      "Approved": "esriFieldTypeSmallInteger",
      "Approved_Date": "esriFieldTypeDate",
      "Edit_Date": "esriFieldTypeDate",
      "Exception": "esriFieldTypeString",
      "By_Law": "esriFieldTypeString"
    },
    "metadataDefinitionHash": "e807530d253a8130d33a11cba544f7bc0914b6263a2c112b40bc8579ef799f3a",
    "note": "Published County service is titled 2018 Official Plan. Preserve raw approval code, amendments, exceptions, bylaw labels and epoch dates. These observations do not establish current adopted County/City policy, complete amendments/appeals, zoning, actual approval, servicing or development permission.",
    "source": {
      "id": "grey:greyHistoricalLandUseReference",
      "name": "Grey County — Official Plan Schedule A - Land Use",
      "url": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer/30",
      "licence": "Open Data Licence – Grey County",
      "licenceUrl": "https://maps.grey.ca/pages/terms",
      "attribution": "Contains information licensed under the Grey County Open Data Licence. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "key": "greyHistoricalKarstReference",
    "kind": "plan",
    "item": "7878345b8e154bb9bdd2109aefe52d2e",
    "itemTitle": "Official Plan Appendix A - Karst Area",
    "itemDefinitionHash": "ae9b71badf0fb7d544c9f75dcac82b7587caed1b9f711758c0a7b7fcd4ec54d5",
    "root": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer",
    "rootItem": "58d30be6c16242a48ed15c5f71b37e18",
    "child": 9,
    "name": "Karst Area",
    "display": "CONTRAINT_",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "metadataDefinitionHash": "c6a773facb12bc17488929ce556c1208316345c856774f810c1efc39136ae73d",
    "note": "2018 County Official Plan Appendix A karst reference. Only a source row identifier is returned. Mapping does not establish observed karst, unstable bedrock, parcel-wide hazard, safe construction, a current regulated area or absence of a hazard. Obtain an appropriate site investigation and original-authority confirmation.",
    "source": {
      "id": "grey:greyHistoricalKarstReference",
      "name": "Grey County — Official Plan Appendix A - Karst Area",
      "url": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer/9",
      "licence": "Open Data Licence – Grey County",
      "licenceUrl": "https://maps.grey.ca/pages/terms",
      "attribution": "Contains information licensed under the Grey County Open Data Licence. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "key": "greyHistoricalWoodlandReference",
    "kind": "plan",
    "item": "4a67de16fa3e4fa9af8e3569cd862d66",
    "itemTitle": "Official Plan Appendix B - Significant Woodlands",
    "itemDefinitionHash": "e09e7f8c5659d06cb26fd5819ebfc09392171bd85275fc0cc37b0bae877509d7",
    "root": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer",
    "rootItem": "58d30be6c16242a48ed15c5f71b37e18",
    "child": 16,
    "name": "Significant Woodlands",
    "display": "FINAL_TYPE",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "metadataDefinitionHash": "c6a773facb12bc17488929ce556c1208316345c856774f810c1efc39136ae73d",
    "note": "2018 County plan significant-woodland reference; the catalogue describes refinement in 2017. Only source row identifiers are returned. Current significance, ecological condition, boundaries, tree-removal permission, current adopted policies and parcel-wide overlap require current instruments and appropriate site investigation.",
    "source": {
      "id": "grey:greyHistoricalWoodlandReference",
      "name": "Grey County — Official Plan Appendix B - Significant Woodlands",
      "url": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer/16",
      "licence": "Open Data Licence – Grey County",
      "licenceUrl": "https://maps.grey.ca/pages/terms",
      "attribution": "Contains information licensed under the Grey County Open Data Licence. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  },
  {
    "key": "greyHistoricalValleylandReference",
    "kind": "plan",
    "item": "0a97ed4e85c840199d22cba0793c18fe",
    "itemTitle": "Official Plan Appendix B - Significant Valleylands",
    "itemDefinitionHash": "2c9af8c9a92a6064e5f277149fabb740ef42897ef9bed855836e8ea9ba4a4d90",
    "root": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer",
    "rootItem": "58d30be6c16242a48ed15c5f71b37e18",
    "child": 15,
    "name": "Significant Valleylands",
    "display": "Desc_",
    "fields": {
      "OBJECTID": "recordId"
    },
    "fieldTypes": {
      "OBJECTID": "esriFieldTypeOID"
    },
    "metadataDefinitionHash": "c6a773facb12bc17488929ce556c1208316345c856774f810c1efc39136ae73d",
    "note": "2018 County plan significant-valleyland reference; the catalogue cites the January 2017 Green in Grey study and site-specific evaluation. Only source row identifiers are returned. Current significance, measured dimensions, floodplain, regulated boundaries, development permission and parcel-wide overlap remain unverified.",
    "source": {
      "id": "grey:greyHistoricalValleylandReference",
      "name": "Grey County — Official Plan Appendix B - Significant Valleylands",
      "url": "https://gis.grey.ca/server/rest/services/Public/Service_GCOfficialPlan/MapServer/15",
      "licence": "Open Data Licence – Grey County",
      "licenceUrl": "https://maps.grey.ca/pages/terms",
      "attribution": "Contains information licensed under the Grey County Open Data Licence. Selected attributes are renamed by Homies / Realist; no County endorsement."
    }
  }
];
