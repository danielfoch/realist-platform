import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ontarioMunicipalCoverage,ontarioMunicipalLocation,ontarioMunicipalLayers } from "../lib/property/ontario-municipal";
import { oshawaRegistrations } from "../lib/property/oshawa-registrations";
import type { Row } from "../lib/property/model";
async function main(){
 const output=resolve(process.argv[2]??"outputs/oshawa-verification");await mkdir(output,{recursive:true});
 const coverage=await ontarioMunicipalCoverage();await writeFile(resolve(output,"coverage.json"),JSON.stringify(coverage,null,2));
 const feeds=coverage.filter(f=>f.city==="Oshawa");assert.equal(feeds.length,8);assert(feeds.every(f=>f.status==="verified"),JSON.stringify(feeds.map(f=>({key:f.layer,status:f.status}))));
 for(const address of ["55 Aberdeen St, Oshawa, ON","52 Air Dancer Cres, Oshawa, ON"]){
  const l=await ontarioMunicipalLocation({address});assert.equal(l?.status,"available",address);
  const layers=await ontarioMunicipalLayers(l!.data!.address,"Oshawa","ON",l!.data!);
  for(const key of ["zoning","parcel","existingLandUse","ward","community"])assert.equal(layers[key].status,"available",key);
  const expected=address.startsWith("55")?{zoning:1125088,parcel:3097657,existingLandUse:2242589,community:10077,ward:4}:{zoning:1126640,parcel:3144342,existingLandUse:2300379,community:10072,ward:2};
  for(const [key,id] of Object.entries(expected))assert((layers[key].data as {records:Row[]}).records.some(r=>r.recordId===id),`${key} expected record ${id}`);
  for(const key of ["heritage","permits","officialPlan","development"])assert.equal(layers[key].status,"not_supported",key);
  if(address.startsWith("55"))assert((layers.additionalUnits.data as {records:Row[]}).records.some(r=>r.certificateIssuedDate==="2018-02-09"));
  if(address.startsWith("52"))assert((layers.rentalLicences.data as {records:Row[]}).records.some(r=>r.publishedExpiryDate==="2027-09-05"));
  await writeFile(resolve(output,address.startsWith("55")?"aberdeen.json":"air-dancer.json"),JSON.stringify({address,location:l,layers},null,2));
  console.log(JSON.stringify({address,location:l?.status,layers:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.status]))}));
 }
 const l=await ontarioMunicipalLocation({address:"460 Woodmount Dr, Oshawa, ON"});assert.equal(l?.status,"ambiguous");
 const site=await ontarioMunicipalLayers("460 Woodmount Dr","Oshawa","ON",l!.data);assert.equal(site.zoning.status,"skipped");assert.equal(site.rentalLicences.status,"available");
 await writeFile(resolve(output,"woodmount.json"),JSON.stringify({location:l,layers:site},null,2));
 const empty=await oshawaRegistrations("99999 Nonexistent St");assert.equal(empty.additionalUnits.status,"no_match");assert.equal(empty.rentalLicences.status,"no_match");
 console.log(JSON.stringify({oshawaPublishedRows:feeds.reduce((n,f)=>n+(f.records??0),0),allPublishedRows:coverage.reduce((n,f)=>n+(f.records??0),0),verified:coverage.filter(f=>f.status==="verified").length,withheld:coverage.filter(f=>f.status==="withheld").length,sharedSitePoint:l?.status,empty:"no_match"}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
