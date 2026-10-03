import type { MunicipalFeed } from "./ontario-municipal-sources";

export const MARKHAM_TERMS_ITEM = "ac3dd6db2bbd4c0d9fb7260291496b9b";
export const MARKHAM_TERMS_EPOCH = { owner:"City_of_Markham", orgId:"OWiFbQmr7Eu5DHn1", access:"public", type:"Hub Page", title:"Terms of Use", modified:1592876207000, size:6704 };
export const MARKHAM_GRANT_HASH = "9e5e32ff0f2cf1801097f68da421531ab7e1e33b4e7a5c5667a525f5705be4b6";
export const MARKHAM_TERMS_URL = "https://data-markham.opendata.arcgis.com/pages/terms-of-use";
export const MARKHAM_COMMUNITIES = ["MARKHAM", "UNIONVILLE", "THORNHILL"];
export const MARKHAM_PLAN_URL = "https://www.markham.ca/economic-development-business/planning-development-services/official-plan";
export const MARKHAM_HERITAGE_URL = "https://www.markham.ca/economic-development-business/planning-development-services/heritage-services/heritage-property-register";
export const MARKHAM_BUILDING_URL = "https://www.markham.ca/economic-development-business/building-permits";
export const MARKHAM_PLANNING_URL = "https://www.markham.ca/economic-development-business/planning-development-services/planning-and-development-applications";

export interface MarkhamFeed extends Omit<MunicipalFeed,"market"> {
  market:"Markham"; rootUrl:string; expectedItemTitle:string; fieldTypes:Record<string,string>;
}
function feed(key:string,item:string,service:string,title:string,layerName:string,geometry:MarkhamFeed["geometry"],fields:Record<string,string>,types:Record<string,string>,note:string):MarkhamFeed {
  const rootUrl=`https://utility.arcgis.com/usrsvcs/servers/${item}/rest/services/OpenData/${service}/FeatureServer`;
  return {market:"Markham",key,item,rootUrl,url:rootUrl+"/0",owner:"City_of_Markham",org:"OWiFbQmr7Eu5DHn1",licenceAnchors:["http://data-markham.opendata.arcgis.com/pages/terms-of-use"],oid:"OBJECTID",geometry,expectedItemTitle:title,expectedLayerName:layerName,fields:{OBJECTID:"recordId",...fields},fieldTypes:{OBJECTID:"esriFieldTypeOID",...types},note,
    source:{id:`markham:${key}`,name:`Markham ${title}`,url:`https://data-markham.opendata.arcgis.com/datasets/${item}/about`,licence:"Open Data Licence – City of Markham v1.0",licenceUrl:MARKHAM_TERMS_URL,attribution:"Contains public sector Information made available under the City of Markham’s Open Data Licence"}};
}
const string="esriFieldTypeString", double="esriFieldTypeDouble";
export const MARKHAM_FEEDS:MarkhamFeed[] = [
  feed("addresses","7791a0d2e3d3422b8eab3c800be5c4e7","OD_ADDRESSES","Civic Addresses","Civic Addresses","esriGeometryPoint",
    {ADDRESS:"civicNumber",STREET:"streetName",DIRECTION:"streetDirection",TYPE:"streetType",PRE_DIR:"streetPrefix",FULL_ADDRESS:"publishedAddress",ADDRPTID:"municipalAddressPointId",FULL_STREET_NAME:"publishedStreet",MUNICIPALITY:"publishedCommunity"},
    {ADDRESS:string,STREET:string,DIRECTION:string,TYPE:string,PRE_DIR:string,FULL_ADDRESS:string,ADDRPTID:"esriFieldTypeInteger",FULL_STREET_NAME:string,MUNICIPALITY:string},
    "Published municipal civic identity and point only. The feed has no unit, lifecycle, permit, inspection or dwelling-legality fields. MARKHAM, UNIONVILLE and THORNHILL are published community labels, not separate municipality boundaries. Thornhill alone does not identify Markham rather than Vaughan; an explicit municipality and unique boundary are required."),
  feed("heritageDistrict","d9e01d203c544d8b9f2671933f6fee40","OD_HERITAGE_DIST","Heritage Conservation Districts","Heritage Districts","esriGeometryPolygon",
    {NAME:"publishedDistrictName",DIST_ID:"publishedDistrictId"},{NAME:string,DIST_ID:double},
    "Published heritage district point intersection only. The feed supplies a district name and ID without a designation bylaw, effective date, individual listed/designated status or alteration approvals. The individual register remains unsearched; verify current district boundaries, bylaws, plan and property-specific requirements."),
  feed("secondaryPlans","69a4a292d99b4cf082d9f4b992b36369","OD_SEC_PLANS","Secondary Plans","Secondary Plans","esriGeometryPolygon",
    {SEC_PLAN_N:"publishedPlanNumber",SEC_PLAN_1:"publishedPlanName",STATUS:"publishedStatus",ACRES:"publishedPolygonAcres",HECTARES:"publishedPolygonHectares"},{SEC_PLAN_N:string,SEC_PLAN_1:string,STATUS:string,ACRES:double,HECTARES:double},
    "Published secondary-plan area, reference and source Statutory/Non-Statutory status only. Status is not a current in-force determination or a development approval. Markham's 2014 plan is partially approved and its 1987 plan remains applicable in certain appealed/secondary-plan areas. Current written policies, schedules, amendments and appeals are unverified. Areas describe whole mapped polygons, not this parcel's lot area."),
  feed("developmentChargeAreas","696a183a3a104bcd918f2b59c86363c9","OD_DEV_CHARGE","Development Charge Areas","Development Charge Areas","esriGeometryPolygon",
    {NAME:"publishedAreaName",ASDC_ID:"publishedAreaCode",STATUS:"publishedStatus",ACRES:"publishedPolygonAcres",HECTARES:"publishedPolygonHectares"},{NAME:string,ASDC_ID:string,STATUS:string,ACRES:double,HECTARES:double},
    "Published area-specific development-charge mapping and raw source status only. 'Areas with Proposed Charge' and 'Already Serviced/Covered by Agreement' are mapping classifications, not current charges, proof of payment, servicing connection/capacity, an exemption or an agreement applying to the subject. No rates, bylaw/effective dates or parcel fee calculation are supplied. Areas describe mapped polygons, not the subject lot.")
];
export const MARKHAM_WITHHELD = [
  {layer:"zoning",item:"b2f9531874c94167979864d22e200e4c",reason:"The public Interactive Zoning Map item has no explicit dataset reuse grant. Public viewer access does not establish commercial redistribution rights; no property records are queried."},
  {layer:"heritage",item:"8320264b32a34e30bfbee576ea885906",reason:"The public Heritage Property Locator item has a blank licence. The licensed district layer does not authorize this individual register; no property records are queried."},
  {layer:"municipalParcel",item:"d91aaf9c9a724bbb8344281a101385aa",reason:"The Temp1_Markham Parcels item lacks a verified commercial reuse grant and third-party parcel authorization. York-origin parcel references are separate; no records from this source are queried."}
];
