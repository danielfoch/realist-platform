import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { markhamCoverage, markhamLayers, markhamLocation } from "../lib/property/markham";
import { yorkLayers } from "../lib/property/york";
import type { Row } from "../lib/property/model";

async function main() {
  const coverage=await markhamCoverage();assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,4,JSON.stringify(coverage));assert.equal(coverage.withheld.length,3);
  const controls=[
    {address:"101 Town Centre Blvd, Markham, ON",civic:"19945",plan:"PD33-1",charge:"42B-1"},
    {address:"7 Station Lane, Markham, ON",civic:"13305",district:"Unionville",plan:"PD1-12",charge:"11"},
    {address:"197 Main St, Unionville, ON",civic:"76221",district:"Unionville",plan:"PD1-12",charge:"11"},
    {address:"96 Main St N, Markham, ON",civic:"59322",district:"Markham",plan:"PD1-14",charge:"11"},
    {address:"8 Church View Ave, Markham, ON",civic:"66173",plan:"PD39-1",charge:"46",chargeStatus:" Areas with Proposed Charge"},
    {address:"8 Cachet Parkway, Markham, ON",civic:"60953",empty:true},
  ];
  const results=[];
  for(const c of controls){
    const location=await markhamLocation({address:c.address});assert.equal(location?.status,"available",JSON.stringify({c,location}));assert(location!.data!.municipalAddress!.recordIds.includes(c.civic));
    const york=await yorkLayers("Markham","ON",location!.data!);assert.equal(york.municipality.status,"available",JSON.stringify(york.municipality));
    const layers=await markhamLayers("Markham","ON",location!.data!,york.municipality);
    const records=(key:string)=>(layers[key].data as {records:Row[]}).records;
    if(c.district){assert.equal(layers.heritageDistrict.status,"available");assert(records("heritageDistrict").some(r=>r.publishedDistrictName===c.district));}
    if(c.plan){assert.equal(layers.secondaryPlans.status,"available");assert(records("secondaryPlans").some(r=>r.publishedPlanNumber===c.plan));}
    if(c.charge){assert.equal(layers.developmentChargeAreas.status,"available");assert(records("developmentChargeAreas").some(r=>r.publishedAreaCode===c.charge&&(!c.chargeStatus||r.publishedStatus===c.chargeStatus)));}
    if(c.empty)for(const key of ["heritageDistrict","secondaryPlans","developmentChargeAreas"])assert.equal(layers[key].status,"no_match");
    assert.equal((layers.secondaryPlans.data as Row).currentPlanScreenPerformed,false);assert.equal((layers.developmentChargeAreas.data as Row).feesCalculated,false);assert.equal(layers.heritage.status,"unavailable");assert.equal(layers.zoning.status,"unavailable");
    results.push({control:c,location,layers});console.log(JSON.stringify({address:c.address,civic:c.civic,statuses:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
  }
  const output={verifiedAt:new Date().toISOString(),coverage,results};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));
  console.log(JSON.stringify({passed:controls.length,verifiedFeeds:4,withheld:3,publishedRows:coverage.datasets.reduce((n,d)=>n+(d.records??0),0),marketComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
