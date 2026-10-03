import { ONTARIO_MUNICIPAL } from "./ontario-municipal-sources";

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
const regionalMarkets = ["Chatham-Kent","Sarnia","North Bay","Timmins","Orillia","Woodstock","Stratford","Cornwall","Owen Sound","Kawartha Lakes","Orangeville","Collingwood","Wasaga Beach","Midland","Sault Ste. Marie","Tillsonburg","Norfolk County"];
const existing:Record<string,string[]>={ Toronto:["permits","variance","parcel","zoning","ward","heritage","development","rentalBuilding","buildingEvaluations"],Brampton:["additionalUnits"],Hamilton:["addresses","permits","heritage","development","zoning","ward","environmentalSensitivity","heritageGrants","ruralSettlement","wastewaterCatchment"] };
export function ontarioMarketRoadmap(){
  const municipalities=[...new Set([...metropolitanMarkets.flatMap(([,cities])=>[...cities]),...regionalMarkets])];
  return {
    status:"in_progress",majorMarketsComplete:false,scope:"All 16 Ontario census metropolitan markets, their major municipal submarkets, and additional regional real-estate centres. Smaller CMA municipalities can be covered through regional feeds and remain part of the final metro audit.",
    classificationSource:"https://www23.statcan.gc.ca/imdb/p3VD.pl?CLV=3&CPV=35A&CST=01012021&CVD=1348399&Function=getVDStruct&MLV=5&TVD=1348372&wbdisable=true",
    classificationReferenceYear:2021,marketSelection:"CMA anchors follow Statistics Canada's 2021 classification; municipal and regional priorities are implementation choices, not a new official classification.",
    coreResearchCategories:["municipal civic identity","permit history and inspection/status fields where published","detailed current zoning and overlays","planning applications and decisions","heritage register and districts","current official plan and property constraints"],
    completionCriteria:"Research each municipality's official catalogue and regional/provincial sources; integrate usable licensed current property-level feeds, document unavailable or withheld feeds, and verify expected records, empty results, ambiguity and source failure through the live API and report. National address/census or a single boundary layer alone does not complete a market.",
    metropolitanMarkets:metropolitanMarkets.map(([name,cities])=>({name,municipalities:cities,status:"in_progress"})),
    municipalities:municipalities.map(city=>{
      const feeds=ONTARIO_MUNICIPAL.filter(f=>f.market===city),configuredLayers=[...new Set([...(existing[city]??[]),...feeds.filter(f=>!f.disabledReason).map(f=>f.key)])];
      return {city,stage:configuredLayers.length?"partial_municipal_coverage":"queued",complete:false,configuredLayers,withheldLayers:feeds.filter(f=>f.disabledReason).map(f=>({layer:f.key,reason:f.disabledReason})),remainingAudit:"Current core categories and regional coverage need a full source and live-flow audit before this market can be marked complete."};
    }),
    sharedBaseline:["National Address Register where loaded and uniquely matched","2021 neighbourhood Census context where mapped","Ontario Greenbelt/Niagara Escarpment preliminary plan screens where relevant"],
    countMeaning:"Dataset rows are not distinct properties, unique data points or guaranteed matches. A verified live row count does not mean those rows were imported into our database.",
  };
}
