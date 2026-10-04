import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { ontarioMunicipalLocation, ontarioMunicipalLayers, ontarioMunicipalCoverage } from "../lib/property/ontario-municipal";
import type { Row } from "../lib/property/model";

async function main(){
  const output=resolve(process.argv[2]??"outputs/ontario-municipal-verification");await mkdir(output,{recursive:true});
  const coverage=await ontarioMunicipalCoverage();await writeFile(resolve(output,"municipal-coverage.json"),JSON.stringify(coverage,null,2));
  const controls=[
    {id:"mississauga-permit",address:"1416 Liveoak Dr, Mississauga, ON",expectedLayer:"permits",expectedRecordId:3},
    {id:"mississauga-civic",address:"280 Lakeshore Rd E, Mississauga, ON"},
    {id:"london-listed",address:"857 Adelaide St N, London, ON",expectedLayer:"heritage",expectedRecordId:5992},
    {id:"london-designated",address:"862 Waterloo St, London, ON",expectedLayer:"heritage",expectedRecordId:5993},
    {id:"ottawa-civic",address:"150 Donald St, Ottawa, ON"},
  ];
  for(const c of controls){
    const l=await ontarioMunicipalLocation({address:c.address});assert.equal(l?.status,"available",`${c.id} civic point`);
    const parts=c.address.split(",");const layers=await ontarioMunicipalLayers(l!.data!.address,parts[1].trim(),"ON",l!.data!);
    const result={query:c.address,location:l,layers};await writeFile(resolve(output,c.id+".json"),JSON.stringify(result,null,2));
    if(c.expectedLayer){const evidence=layers[c.expectedLayer];assert.equal(evidence.status,"available",`${c.id} ${c.expectedLayer}`);assert((evidence.data as {records:Row[]}).records.some(r=>r.recordId===c.expectedRecordId),`${c.id} expected record ${c.expectedRecordId}`);}
    if(c.id.startsWith("mississauga")){assert.equal(layers.zoning.status,"unavailable");assert.equal(layers.officialPlan.status,"not_supported");}
    console.log(JSON.stringify({control:c.id,identity:l?.status,layers:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
  }
  console.log(JSON.stringify({verified:coverage.filter(x=>x.status==="verified").length,withheld:coverage.filter(x=>x.status==="withheld").length,publishedRows:coverage.reduce((sum,x)=>sum+(x.records??0),0)}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
