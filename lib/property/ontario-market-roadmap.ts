import { ONTARIO_MUNICIPAL } from "./ontario-municipal-sources";
import { DURHAM_MUNICIPALITIES, DURHAM_PLANNING } from "./durham-sources";
import { HALTON_FEEDS } from "./halton-sources";
import { HALTON_HILLS_WITHHELD } from "./halton-hills-sources";
import { YORK_FEEDS, YORK_MUNICIPALITIES, YORK_WITHHELD } from "./york-sources";
import { MARKHAM_FEEDS, MARKHAM_WITHHELD } from "./markham-sources";
import { KINGSTON_FEEDS, KINGSTON_WITHHELD } from "./kingston-sources";
import { GUELPH_FEEDS, GUELPH_WITHHELD } from "./guelph-sources";
import { WATERLOO_FEEDS, WATERLOO_WITHHELD } from "./waterloo-region-sources";

import { NIAGARA_FEEDS, NIAGARA_MUNICIPALITIES, NIAGARA_WITHHELD } from "./niagara-sources";

import { YORK_LOCAL_AUDITS } from "./york-local-audits";

const metropolitanMarkets = [
  ["Ottawa–Gatineau (Ontario)",["Ottawa"]],
  ["Kingston",["Kingston"]], ["Belleville–Quinte West",["Belleville","Quinte West"]],
  ["Peterborough",["Peterborough"]], ["Oshawa",["Oshawa","Whitby","Clarington"]],
  ["Toronto",["Toronto","Mississauga","Brampton","Vaughan","Markham","Richmond Hill","Milton","Pickering","Ajax","Newmarket","Aurora","Caledon","Halton Hills","Georgina","Whitchurch-Stouffville","East Gwillimbury","Bradford West Gwillimbury","Innisfil","King"]],
  ["Hamilton",["Hamilton","Burlington","Oakville"]],
  ["St. Catharines–Niagara",["St. Catharines","Niagara Falls","Welland","Fort Erie","Port Colborne","Thorold","Niagara-on-the-Lake","Grimsby","Lincoln","Pelham"]],
  ["Kitchener–Cambridge–Waterloo",["Kitchener","Waterloo","Cambridge"]],
  ["Brantford",["Brantford","Brant"]], ["Guelph",["Guelph"]], ["London",["London","St. Thomas"]],
  ["Windsor",["Windsor","Tecumseh","LaSalle","Lakeshore"]], ["Barrie",["Barrie","Springwater"]],
  ["Greater Sudbury",["Greater Sudbury"]], ["Thunder Bay",["Thunder Bay"]],
] as const;
const regionalMarkets = ["Chatham-Kent","Sarnia","North Bay","Timmins","Orillia","Woodstock","Stratford","Cornwall","Owen Sound","Kawartha Lakes","Orangeville","Collingwood","Wasaga Beach","Midland","Sault Ste. Marie","Tillsonburg","Norfolk County","Wainfleet","West Lincoln","Brock","Scugog","Uxbridge"];
const existing:Record<string,string[]>={ Toronto:["permits","variance","parcel","zoning","ward","heritage","development","rentalBuilding","buildingEvaluations"],Brampton:["additionalUnits"],Hamilton:["addresses","permits","heritage","development","zoning","ward","environmentalSensitivity","heritageGrants","ruralSettlement","wastewaterCatchment"],Oshawa:["additionalUnits","rentalLicences"] };
export function ontarioMarketRoadmap(){
  const municipalities=[...new Set([...metropolitanMarkets.flatMap(([,cities])=>[...cities]),...regionalMarkets,...NIAGARA_MUNICIPALITIES])];
  return {
    status:"in_progress",majorMarketsComplete:false,scope:"All 16 Ontario census metropolitan markets, their major municipal submarkets, and additional regional real-estate centres. Smaller CMA municipalities can be covered through regional feeds and remain part of the final metro audit.",
    classificationSource:"https://www23.statcan.gc.ca/imdb/p3VD.pl?CLV=3&CPV=35A&CST=01012021&CVD=1348399&Function=getVDStruct&MLV=5&TVD=1348372&wbdisable=true",
    classificationReferenceYear:2021,marketSelection:"CMA anchors follow Statistics Canada's 2021 classification; municipal and regional priorities are implementation choices, not a new official classification.",
    coreResearchCategories:["municipal civic identity","permit history and inspection/status fields where published","detailed current zoning and overlays","planning applications and decisions","heritage register and districts","current official plan and property constraints"],
    completionCriteria:"Research each municipality's official catalogue and regional/provincial sources; integrate usable licensed current property-level feeds, document unavailable or withheld feeds, and verify expected records, empty results, ambiguity and source failure through the live API and report. National address/census or a single boundary layer alone does not complete a market.",
    metropolitanMarkets:metropolitanMarkets.map(([name,cities])=>({name,municipalities:cities,status:"in_progress"})),
    municipalities:municipalities.map(city=>{
      const regional=DURHAM_MUNICIPALITIES.some(m=>m===city),york=YORK_MUNICIPALITIES.some(m=>m===city),feeds=[...ONTARIO_MUNICIPAL,...HALTON_FEEDS].filter(f=>f.market===city),configuredLayers=[...new Set([...(existing[city]??[]),...feeds.filter(f=>!f.disabledReason).map(f=>f.key),...(regional?["addresses","municipality","durhamPlanning"]:[]),...(york?YORK_FEEDS.map(f=>f.key):[]),...(city==="Markham"?MARKHAM_FEEDS.map(f=>f.key):[]),...(city==="Kingston"?KINGSTON_FEEDS.map(f=>f.group):[]),...(city==="Guelph"?GUELPH_FEEDS.map(f=>f.key):[]),...(["Kitchener","Waterloo","Cambridge"].includes(city)?WATERLOO_FEEDS.filter(f=>[city,"Region of Waterloo"].includes(f.market)).map(f=>f.group):[]),...(NIAGARA_MUNICIPALITIES.some(m=>m===city)?NIAGARA_FEEDS.filter(f=>!f.disabledReason&&[city,"Niagara Region"].includes(f.market)).map(f=>f.group):[]),...(city==="Halton Hills"?["heritage","planningApplications"]:[])])];
      return {city,stage:configuredLayers.length?"partial_municipal_coverage":"queued",complete:false,configuredLayers,withheldLayers:[...feeds.filter(f=>f.disabledReason).map(f=>({layer:f.key,reason:f.disabledReason})),...(regional?DURHAM_PLANNING.filter(f=>f.disabledReason).map(f=>({layer:`durhamPlanning.${f.key}`,reason:f.disabledReason})):[]),...(york?YORK_WITHHELD.map(f=>({layer:f.layer,reason:f.reason})):[]),...(city==="Markham"?MARKHAM_WITHHELD.map(f=>({layer:f.layer,reason:f.reason})):[]),...(city==="Kingston"?KINGSTON_WITHHELD.map(f=>({layer:f.layer,reason:f.reason})):[]),...(city==="Guelph"?GUELPH_WITHHELD.map(f=>({layer:f.layer,reason:f.reason})):[]),...(["Kitchener","Waterloo","Cambridge"].includes(city)?WATERLOO_WITHHELD.filter(f=>[city,"Region of Waterloo"].includes(f.market)).map(f=>({layer:f.layer,reason:f.reason})):[]),...(NIAGARA_MUNICIPALITIES.some(m=>m===city)?[...NIAGARA_WITHHELD.filter(f=>[city,"Niagara Region"].includes(f.market)).map(f=>({layer:f.layer,reason:f.reason})),...NIAGARA_FEEDS.filter(f=>f.disabledReason&&[city,"Niagara Region"].includes(f.market)).map(f=>({layer:f.group,reason:f.disabledReason!}))]:[]),...(YORK_LOCAL_AUDITS[city as keyof typeof YORK_LOCAL_AUDITS]?.sources.map(f=>({layer:f.layer,reason:f.reason}))??[]),...(city==="Halton Hills"?HALTON_HILLS_WITHHELD.map(f=>({layer:f.layer,reason:f.reason})):[])],remainingAudit:"Current core categories and regional coverage need a full source and live-flow audit before this market can be marked complete."};
    }),
    sharedBaseline:["National Address Register where loaded and uniquely matched","2021 neighbourhood Census context where mapped","Ontario Greenbelt/Niagara Escarpment preliminary plan screens where relevant"],
    countMeaning:"Dataset rows are not distinct properties, unique data points or guaranteed matches. A verified live row count does not mean those rows were imported into our database.",
  };
}
