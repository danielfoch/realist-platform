import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
// Polygon controls are synthetic interiors of inspected source features, not surveyed properties.
const controls:Row[]=[
  {
    "address": "585 First Avenue, Welland, ON",
    "positive": "zoning"
  },
  {
    "address": "102 East Main Street, Welland, ON",
    "positive": "heritage"
  },
  {
    "address": "477 King Street, Welland, ON",
    "positive": "sitePlans"
  },
  {
    "city": "Welland",
    "province": "ON",
    "lat": 43.00642080604703,
    "lng": -79.24805146432156,
    "positive": "naturalEnvironmentReference",
    "nestedPositive": "environmentalProtectionArea",
    "sourceControlRecordId": 2,
    "controlMeaning": "synthetic interior of an inspected non-cadastral source feature; not a surveyed property"
  },
  {
    "city": "Welland",
    "province": "ON",
    "lat": 43.02484835783353,
    "lng": -79.27216657537042,
    "positive": "naturalEnvironmentReference",
    "nestedPositive": "environmentalControlArea",
    "sourceControlRecordId": 2,
    "controlMeaning": "synthetic interior of an inspected non-cadastral source feature; not a surveyed property"
  },
  {
    "city": "Welland",
    "province": "ON",
    "lat": 42.97612062548813,
    "lng": -79.21858204335777,
    "positive": "officialPlan",
    "nestedPositive": "areaSpecificPolicy",
    "sourceControlRecordId": 2,
    "controlMeaning": "synthetic interior of an inspected non-cadastral source feature; not a surveyed property"
  },
  {
    "city": "Welland",
    "province": "ON",
    "lat": 42.962752263812895,
    "lng": -79.22990281468566,
    "positive": "officialPlan",
    "nestedPositive": "appealDeferralAreas",
    "sourceControlRecordId": 2,
    "controlMeaning": "synthetic interior of an inspected non-cadastral source feature; not a surveyed property"
  }
];
async function main(){
  const base=process.argv[2]??'https://realist-lean.vercel.app',results=[];
  // Coverage includes Guelph: every request in this verifier is sequential.
  for(const control of controls){
    const u=new URL('/api/property',base);Object.entries(control).filter(([k])=>['address','city','province','lat','lng'].includes(k)).forEach(([k,v])=>u.searchParams.set(k,String(v)));
    const response=await fetch(u,{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'*');const result=await response.json()as Row;assert.equal(result.success,true);
    const layers=result.layers as Record<string,{status:string;data:Row|null}>;assert.equal(layers.municipality.status,'available');assert.equal(layers[String(control.positive)].status,'available',JSON.stringify({control,result}));if(control.nestedPositive)assert.equal(((layers[String(control.positive)].data!.datasets as Row)[String(control.nestedPositive)]as Row).status,'available');
    assert.equal(layers.permits.status,'unavailable');assert.equal(layers.conservation.status,'unavailable');assert.equal(layers.planningApplications.status,'unavailable');if(!control.address){assert.equal(layers.sitePlans.status,'skipped');assert.equal(layers.heritage.status,'skipped');}
    results.push({control,result});console.log(JSON.stringify({control,status:'passed'}));
  }
  const response=await fetch(new URL('/api/property/coverage',base),{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);const coverage=await response.json()as Row,w=(coverage.live as Row[]).find(x=>(x.cities as string[]|undefined)?.length===1&&(x.cities as string[])[0]==='Welland')!;
  assert.equal((w.datasets as Row[]).length,13);assert.equal((w.datasets as Row[]).filter(x=>x.status==='verified').length,13);assert.equal((w.withheld as Row[]).length,4);assert.equal(w.complete,false);
  const output={verifiedAt:new Date().toISOString(),results,coverage};if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(output,null,2));console.log(JSON.stringify({passed:results.length,verifiedFeeds:13,publishedRows:(w.datasets as Row[]).reduce((total,d)=>total+Number(d.records??0),0),marketComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
