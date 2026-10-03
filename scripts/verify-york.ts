import {strict as assert} from "node:assert";
import {writeFile} from "node:fs/promises";
import {yorkCoverage,yorkLayers,yorkLocation} from "../lib/property/york";
import type {Row} from "../lib/property/model";

async function main(){
  const coverage=await yorkCoverage();assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,6,JSON.stringify(coverage.datasets));assert.equal(coverage.withheld.length,5);
  const controls=[
    {address:"2141 Major Mackenzie Dr W, Vaughan, ON",city:"Vaughan",civic:"271103"},
    {address:"101 Town Centre Blvd, Markham, ON",city:"Markham",civic:"165387"},
    {address:"225 East Beaver Creek Rd, Richmond Hill, ON",city:"Richmond Hill",civic:"205042"},
    {address:"395 Mulock Dr, Newmarket, ON",city:"Newmarket",civic:"290417"},
    {address:"100 John West Way, Aurora, ON",city:"Aurora",civic:"119995",wellhead:"WHPA-D"},
    {address:"26557 Civic Centre Rd, Georgina, ON",city:"Georgina",civic:"266460"},
    {address:"19000 Leslie St, East Gwillimbury, ON",city:"East Gwillimbury",civic:"153367"},
    {address:"111 Sandiford Dr, Whitchurch-Stouffville, ON",city:"Whitchurch-Stouffville",civic:"169265",employment:true},
    {address:"2585 King Rd, King, ON",city:"King",civic:"324034"},
    {address:"199 Church St, Schomberg, ON",city:"King",civic:"323477",planning:"ZBA.26.K.0078",wellhead:"WHPA-D",parcel:412683},
    {address:"15 Poplar Dr, Richmond Hill, ON",city:"Richmond Hill",civic:"130404",planning:"CONS.18.R.0077",parcel:396464},
  ];
  const results=[];
  for(const c of controls){
    const location=await yorkLocation({address:c.address});assert.equal(location?.status,"available",JSON.stringify({c,location}));assert.equal(location!.data!.city,c.city);assert(location!.data!.municipalAddress!.recordIds.includes(c.civic));
    const layers=await yorkLayers(c.city,"ON",location!.data!);assert.equal(layers.municipality.status,"available",JSON.stringify(layers.municipality));
    for(const key of ["permits","zoning","heritage","planningApplications","officialPlan","development"])assert.equal(layers[key].status,"not_supported");
    assert.equal((layers.officialPlan.data as Row).currentPlanScreenPerformed,false);
    if(c.planning){assert.equal(layers.regionalPlanningApplications.status,"available");assert((layers.regionalPlanningApplications.data as {records:Row[]}).records.some(r=>r.regionalFileNumber===c.planning));}
    if(c.wellhead){assert.equal(layers.wellheadProtection.status,"available");assert((layers.wellheadProtection.data as {records:Row[]}).records.some(r=>r.publishedProtectionArea===c.wellhead));}
    if(c.parcel){assert.equal(layers.parcel.status,"available");assert((layers.parcel.data as {records:Row[]}).records.some(r=>r.municipalParcelId===c.parcel));}
    if(c.employment){assert.equal(layers.employmentInventory2025.status,"available");assert.equal((layers.employmentInventory2025.data as Row).inventoryYear,2025);}
    results.push({control:c,location,layers});console.log(JSON.stringify({address:c.address,civic:c.civic,layers:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
  }
  const output={verifiedAt:new Date().toISOString(),coverage,results};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));
  console.log(JSON.stringify({passed:controls.length,verifiedFeeds:6,withheld:5,publishedScopedSourceRows:coverage.datasets.reduce((n,d)=>n+(d.records??0),0),allMarketsComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
