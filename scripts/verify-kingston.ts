import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { kingstonCoverage, kingstonLayers, kingstonLocation } from "../lib/property/kingston";
import type { Row } from "../lib/property/model";
async function main(){
  const coverage=await kingstonCoverage();assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,24,JSON.stringify(coverage));assert.equal(coverage.withheld.length,9);
  const results=[];
  for(const address of ["216 Ontario St, Kingston, ON","1431 McAdoos Lane, Kingston, ON","1211 John Counter Blvd, Kingston, ON","1383 Gardiners Rd, Kingston, ON","244 James St, Kingston, ON","30 Sydenham St, Kingston, ON"]){
    const location=await kingstonLocation({address});assert.equal(location?.status,"available",JSON.stringify({address,location}));
    const layers=await kingstonLayers(location!.data!.address!,"Kingston","ON",location!.data!);
    assert.equal(layers.municipality.status,"available",JSON.stringify(layers.municipality));assert.equal(layers.zoning.status,"available",JSON.stringify(layers.zoning));
    for(const name of ["zoning","heritage","officialPlan"]){const d=layers[name].data as Row;assert.equal(d.coverageComplete,false);for(const v of Object.values(d.datasets as Record<string,{status:string;data:Row|null}>))assert(["available","no_match"].includes(v.status),JSON.stringify({address,name,v}));}
    if(address.startsWith("1383"))assert.equal(layers.planningApplications.status,"available");
    if(address.startsWith("244")||address.startsWith("30 "))assert.equal(layers.heritageApplications.status,"available");
    assert.equal(layers.additionalUnitOverlays.status,"unavailable");assert.equal(layers.development.status,"not_supported");
    results.push({address,location,layers});console.log(JSON.stringify({address,statuses:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status])),permitObservations:((layers.permits.data as Row|null)?.records as Row[]|undefined)?.length}));
  }
  for(const address of ["52 Faircrest Blvd, Kingston, ON","267 Earl St, Kingston, ON"]){const location=await kingstonLocation({address});assert.equal(location?.status,"ambiguous",JSON.stringify({address,location}));const layers=await kingstonLayers(address.split(",")[0],"Kingston","ON",location!.data);assert.equal(layers.municipality.status,"skipped");assert.equal(layers.permits.status,"skipped");results.push({address,location,layers});console.log(JSON.stringify({address,expected:"ambiguous",status:location!.status}));}
  const output={verifiedAt:new Date().toISOString(),coverage,results};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));console.log(JSON.stringify({passed:results.length,verifiedFeeds:24,withheld:9,publishedRows:coverage.datasets.reduce((n,d)=>n+(d.records??0),0),marketComplete:false}));
}main().catch(e=>{console.error(e);process.exitCode=1;});
