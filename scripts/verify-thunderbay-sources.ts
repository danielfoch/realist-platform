import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { thunderBayCoverage, thunderBayResearch, thunderBayLayers } from "../lib/property/thunderbay";
import type { Location } from "../lib/property/model";
async function main() {
const out: Record<string,unknown>={checkedAt:new Date().toISOString()};
const addresses=["216 Brodie St S, Thunder Bay, ON","135 Archibald St N, Thunder Bay, ON","10 Algoma St S, Thunder Bay, ON","500 Donald St E, Thunder Bay, ON","363 Waverley St, Thunder Bay, ON","329 Waverley St, Thunder Bay, ON","439 St Patrick’s Sq, Thunder Bay, ON"];
for(const address of addresses){
  const research=await thunderBayResearch({address});assert(["available","no_match"].includes(research?.civic.status??""));assert.equal(research?.location,null);
  const u=new URL("/api/property","https://realist-lean.vercel.app");u.searchParams.set("address",address);
  const response=await fetch(u,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);const old=await response.json();
  const l=old.layers.location.data as Location|null;
  const layers=await thunderBayLayers(address.split(",")[0],"Thunder Bay","ON",l,"Thunder Bay",research);
  out[address]={research,independentLocation:old.layers.location,layers};
  assert.equal(layers.historicalHeritageRegister.status,"available");
  assert.equal((layers.municipalAddresses.data as Record<string,unknown>).sourceGeometryReused,false);
  for(const key of ["permits","zoning","heritage","thunderbayConservationRegulation"])assert.equal((layers[key].data as Record<string,unknown>).recordsQueried,false);
  console.log(address,old.layers.location.status,l?.accuracy,layers.municipality.status,layers.heritageDistrict.status);
}
out.coverage=await thunderBayCoverage();const coverage=out.coverage as Awaited<ReturnType<typeof thunderBayCoverage>>;
assert.equal(coverage.datasets.length,8);assert(coverage.datasets.every(d=>d.status==="verified"));
writeFileSync(process.argv[2]!,JSON.stringify(out,null,2)+"\n");console.log(coverage.datasets.map(d=>({layer:d.layer,records:d.records})));assert(Object.values(out).some(v=>typeof v==='object'&&v!==null&&'layers' in v&&(v as {layers:Record<string,{status:string}>}).layers.heritageDistrict.status==='available'));console.log('SOURCE CONTROLS PASSED');

}
main().catch(e=>{console.error(e);process.exitCode=1;});
