import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { Row } from "../lib/property/model";
// Polygon controls are synthetic interiors of inspected source features, not surveyed properties.
const controls:Row[]=[
  {
    "address": "5786 Dunn St, Niagara Falls, ON",
    "positive": "permits"
  },
  {
    "address": "7972 Thorold Townline Rd, Niagara Falls, ON",
    "positive": "planningApplications"
  },
  {
    "address": "4691 Ontario Av, Niagara Falls, ON",
    "positive": "heritage"
  },
  {
    "lat": 43.03852689127248,
    "lng": -79.12404046674517,
    "city": "Niagara Falls",
    "province": "ON",
    "positive": "legacyZoning",
    "nestedPositive": "zoning1538Crowland",
    "sourceControlRecordId": 1,
    "controlMeaning": "synthetic interior of an inspected source feature; not a surveyed property"
  },
  {
    "lat": 42.96093530415753,
    "lng": -79.12949471635355,
    "city": "Niagara Falls",
    "province": "ON",
    "positive": "legacyZoning",
    "nestedPositive": "zoning7069Humberstone",
    "sourceControlRecordId": 1,
    "controlMeaning": "synthetic interior of an inspected source feature; not a surveyed property"
  },
  {
    "lat": 43.04906397788869,
    "lng": -79.0104296101801,
    "city": "Niagara Falls",
    "province": "ON",
    "positive": "legacyZoning",
    "nestedPositive": "zoningB0395Willoughby",
    "sourceControlRecordId": 1,
    "controlMeaning": "synthetic interior of an inspected source feature; not a surveyed property"
  },
  {
    "lat": 43.025585891966635,
    "lng": -79.12528405276286,
    "city": "Niagara Falls",
    "province": "ON",
    "positive": "communityImprovement",
    "nestedPositive": "brownfieldCIP",
    "sourceControlRecordId": 1,
    "controlMeaning": "synthetic interior of an inspected source feature; not a surveyed property"
  }
];
async function main(){
  const base=process.argv[2]??'https://realist-lean.vercel.app',results=[];
  // Coverage includes Guelph's serialized source session: keep this verifier sequential.
  for(const control of controls){const u=new URL('/api/property',base);Object.entries(control).filter(([k])=>['address','city','province','lat','lng'].includes(k)).forEach(([k,v])=>u.searchParams.set(k,String(v)));const response=await fetch(u,{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'*');const result=await response.json()as Row;assert.equal(result.success,true);const layers=result.layers as Record<string,{status:string;data:Row|null}>;assert.equal(layers.municipality.status,'available');assert.equal(layers[String(control.positive)].status,'available',JSON.stringify({control,result}));if(control.nestedPositive)assert.equal(((layers[String(control.positive)].data!.datasets as Row)[String(control.nestedPositive)]as Row).status,'available');assert.equal(layers.conservation.status,'unavailable');assert.equal(layers.development.status,'not_supported');if(!control.address&&control.city==='Niagara Falls')assert.equal(layers.permits.status,'skipped');results.push({control,result});console.log(JSON.stringify({control,status:'passed'}));}
  const response=await fetch(new URL('/api/property/coverage',base),{signal:AbortSignal.timeout(65000)});assert.equal(response.status,200);const coverage=await response.json()as Row;const n=(coverage.live as Row[]).find(x=>(x.cities as string[]|undefined)?.includes('Niagara Falls'))!;assert.equal((n.datasets as Row[]).filter(x=>x.status==='verified').length,12);assert.equal((n.datasets as Row[]).filter(x=>x.status==='unavailable'&&x.records===null).length,11);assert.equal((n.withheld as Row[]).length,10);assert.equal(n.complete,false);const output={verifiedAt:new Date().toISOString(),results,coverage};if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(output,null,2));console.log(JSON.stringify({passed:results.length,verifiedFeeds:12,publishedRows:(n.datasets as Row[]).reduce((total,d)=>total+Number(d.records??0),0),marketComplete:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
