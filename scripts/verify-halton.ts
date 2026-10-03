import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { haltonCoverage, haltonLayers, haltonLocation } from "../lib/property/halton";
import type { Row } from "../lib/property/model";

async function main(){
  const coverage=await haltonCoverage();
  assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,19,JSON.stringify(coverage.datasets));
  assert.equal(coverage.datasets.filter(d=>d.status==="withheld").length,4);
  const controls=[
    {address:"150 Mary St, Milton, ON",city:"Milton",civic:"5495"},
    {address:"99 Mill St, Milton, ON",city:"Milton",civic:"27080",heritage:1},
    {address:"18 Campbell Ave E, Milton, ON",city:"Milton",civic:"12004",heritage:5},
    {address:"426 Brant St, Burlington, ON",city:"Burlington",civic:"45952"},
    {address:"1268 Abbey Court, Burlington, ON",city:"Burlington",civic:"14002",permit:"24-019651"},
    {address:"680 Plains Rd W, Burlington, ON",city:"Burlington",civic:"15196",parcelHeritage:481107},
    {address:"1225 Trafalgar Rd, Oakville, ON",city:"Oakville",civic:"39962"},
    {address:"3140 Harasym Trail, Oakville, ON",city:"Oakville",civic:"298744",permit:"2022 132737 000 00 RN"},
  ];
  const results=[];
  for(const c of controls){
    const location=await haltonLocation({address:c.address});assert.equal(location?.status,"available",JSON.stringify(location));assert.equal(location!.data!.city,c.city);assert(location!.data!.municipalAddress!.recordIds.includes(c.civic));
    const layers=await haltonLayers(location!.data!.address,c.city,"ON",location!.data!);
    assert((layers.zoning.data as Row).coverageComplete===false);assert.equal((layers.officialPlan.data as Row).currentPlanScreenPerformed,false);
    if(c.heritage){assert.equal(layers.heritage.status,"available");assert((layers.heritage.data as {records:Row[]}).records.some(r=>r.recordId===c.heritage));}
    if(c.parcelHeritage){assert.equal(layers.heritage.status,"available");assert((layers.heritage.data as {records:Row[]}).records.some(r=>r.recordId===c.parcelHeritage));}
    if(c.permit){assert.equal(layers.permits.status,"available",JSON.stringify(layers.permits));assert((layers.permits.data as {records:Row[]}).records.some(r=>r.permitNumber===c.permit));}
    results.push({control:c,location,layers});console.log(JSON.stringify({address:c.address,civic:c.civic,layers:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
  }
  const output={verifiedAt:new Date().toISOString(),coverage,results};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));
  console.log(JSON.stringify({passed:controls.length,verifiedFeeds:19,withheld:4,publishedSourceRows:coverage.datasets.reduce((n,d)=>n+(d.records??0),0),allMarketsComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
