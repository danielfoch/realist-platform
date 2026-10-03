import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
const controls=[
  {address:"51 Cork St W, Guelph, ON",positive:"zoning"},
  {address:"199 Woodlawn Rd W, Guelph, ON",positive:"planningApplications"},
  {address:"19 Inverness Dr, Guelph, ON",positive:"formerTermiteManagement"},
  {lat:43.50116319714766,lng:-80.2303213550989,city:"Guelph",province:"ON",positive:"registeredPlans"},
  {lat:43.54362526000898,lng:-80.2253571999088,city:"Guelph",province:"ON",positive:"watercourseReference"},
  {lat:43.50969493872762,lng:-80.19872895089296,city:"Guelph",province:"ON",positive:"parkReference"},
];
async function main(){
  const results=[];
  for(const {positive,...params}of controls){const u=new URL('https://realist-lean.vercel.app/api/property');Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));const response=await fetch(u,{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'*');const result=await response.json()as Row;assert.equal(result.success,true);const layers=result.layers as Record<string,{status:string;data:Row|null}>;assert.equal(layers.municipality.status,'available');assert.equal(layers[positive].status,'available',JSON.stringify({params,positive,result}));for(const name of ['permits','heritage','variance','communityPlanningPermit','currentTermiteManagement'])assert.equal(layers[name].status,'unavailable');assert.equal(layers.zoning.data?.legalPermissionsEstablished,false);assert.equal(layers.officialPlan.data?.currentPlanScreenPerformed,false);if(!params.address)assert.equal(layers.planningApplications.status,'skipped');results.push({params,positive,result});console.log(JSON.stringify({params,positive,statuses:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));}
  const response=await fetch('https://realist-lean.vercel.app/api/property/coverage',{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);const coverage=await response.json()as Row;const g=(coverage.live as Row[]).find(x=>(x.cities as string[]|undefined)?.includes('Guelph'))!;assert.equal((g.datasets as Row[]).filter(x=>x.status==='verified').length,11);assert.equal((g.withheld as Row[]).length,7);assert.equal(g.complete,false);const output={verifiedAt:new Date().toISOString(),results,coverage};if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(output,null,2));console.log(JSON.stringify({passed:results.length,verifiedFeeds:11,publishedRows:(g.datasets as Row[]).reduce((n,d)=>n+Number(d.records??0),0),marketComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
