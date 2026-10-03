import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { waterlooCoverage, waterlooLayers, waterlooLocation } from "../lib/property/waterloo-region";
import type { Row } from "../lib/property/model";
async function main(){
  const coverage=await waterlooCoverage();assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,26,JSON.stringify(coverage));assert.equal(coverage.withheld.length,10);
  const controls:[string,string][]=[
    ["21 Heins Ave, Kitchener, ON","heritage"],["1241 Weber St E, Kitchener, ON","permits"],["321 Courtland Ave E, Kitchener, ON","planningApplications"],
    ["35 King St N, Waterloo, ON","permits"],["11 Richards Ave, Cambridge, ON","officialPlan"],["8 Schofield St, Cambridge, ON","planningApplications"],
    ["37 Dianne Ave, Cambridge, ON","planningApplications"],["105 Middle Block Rd, Cambridge, ON","heritage"],
  ];
  const results=[];
  for(const [address,positive]of controls){
    const location=await waterlooLocation({address});assert.equal(location?.status,"available",JSON.stringify({address,location}));
    const city=address.split(",")[1].trim(),layers=await waterlooLayers(location!.data!.address!,city,"ON",location!.data!);
    for(const name of ["municipality","regionalBoundary",positive])assert.equal(layers[name].status,"available",JSON.stringify({address,name,layer:layers[name]}));
    for(const name of ["heritage","officialPlan","planningApplications","regionalEnvironment"]){const d=layers[name]?.data as Row|null;if(!d?.datasets)continue;assert.equal(d.coverageComplete,false);for(const v of Object.values(d.datasets as Record<string,{status:string;data:Row|null}>))assert(["available","no_match"].includes(v.status),JSON.stringify({address,name,v}));}
    assert.equal(layers.development.status,"not_supported");assert.notEqual(layers.zoning.status,"available");
    if(city==="Waterloo"){assert.equal(layers.waterPressureZone.status,"available");assert.equal((layers.waterPressureZone.data as Row).availableCapacityEstablished,false);}
    results.push({address,location,layers});console.log(JSON.stringify({address,positive,statuses:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
  }
  const output={verifiedAt:new Date().toISOString(),coverage,results};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));console.log(JSON.stringify({passed:results.length,verifiedFeeds:26,withheld:10,publishedRows:coverage.datasets.reduce((n,d)=>n+(d.records??0),0),marketComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
