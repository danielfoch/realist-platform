import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { durhamCoverage,durhamLayers,durhamLocation } from "../lib/property/durham";
import type { Row } from "../lib/property/model";
// Civic IDs/points independently captured from the Region's source before API verification.
const controls=[
 {address:"65 Harwood Ave S, Ajax, ON",city:"Ajax",civic:296091,boundary:403},
 {address:"575 Rossland Rd E, Whitby, ON",city:"Whitby",civic:273555,boundary:405},
 {address:"1 The Esplanade S, Pickering, ON",city:"Pickering",civic:401667,boundary:404,positive:{urbanGrowthCentre2024:1}},
 {address:"40 Temperance St, Bowmanville, ON",city:"Clarington",civic:335011,boundary:407},
 {address:"1 Cameron St E, Cannington, ON",city:"Brock",civic:230951,boundary:408,positive:{wellheadProtection2024:43}},
 {address:"181 Perry St, Port Perry, ON",city:"Scugog",civic:427348,boundary:401,positive:{sourceProtectionRegion2024:2}},
 {address:"51 Toronto St S, Uxbridge, ON",city:"Uxbridge",civic:379743,boundary:402,positive:{wellheadProtection2024:8}},
 {address:"55 Aberdeen St, Oshawa, ON",city:"Oshawa",civic:359227,boundary:406,positive:{communityArea2024:231}},
];
async function main(){
 const output=resolve(process.argv[2]??"outputs/durham-verification");await mkdir(output,{recursive:true});
 const coverage=await durhamCoverage();await writeFile(resolve(output,"coverage.json"),JSON.stringify(coverage,null,2));
 assert.equal(coverage.datasets.filter(d=>d.status==="verified").length,18,JSON.stringify(coverage.datasets.map(d=>({key:d.layer,status:d.status}))));
 assert.equal(coverage.datasets.filter(d=>d.status==="withheld").length,3);assert.equal(coverage.datasets.reduce((n,d)=>n+(d.records??0),0),269836);
 for(const c of controls){
  const location=await durhamLocation({address:c.address});assert.equal(location?.status,"available",c.address);assert.equal(location?.data?.city,c.city);assert(location?.data?.municipalAddress?.recordIds.includes(String(c.civic)));
  const layers=await durhamLayers(c.city,"ON",location!.data,c.address.split(",")[1].trim());await writeFile(resolve(output,c.city.toLowerCase()+".json"),JSON.stringify({control:c,location,layers},null,2));
  assert.equal(layers.municipality.status,"available",c.city);assert((layers.municipality.data as {records:Row[]}).records.some(r=>r.recordId===c.boundary));
  const d=layers.durhamPlanning.data as {datasets:Record<string,{status:string;data:{records:Row[]}|null}>};
  for(const [key,id] of Object.entries(c.positive??{})){assert.equal(d.datasets[key].status,"available",`${c.city} ${key}`);assert(d.datasets[key].data!.records.some(r=>r.recordId===id),`${c.city} ${key} ${id}`);}
  console.log(JSON.stringify({city:c.city,civicId:c.civic,expectedPositive:c.positive??{},status:layers.durhamPlanning.status}));
 }
 const point={address:null,city:"Ajax",province:"ON",latitude:43.84340511870299,longitude:-79.03798146438098,accuracy:"caller_supplied",provider:"source_polygon_geometry_fixture"};
 const transit=await durhamLayers("Ajax","ON",point);await writeFile(resolve(output,"transit.json"),JSON.stringify(transit,null,2));
 assert((transit.durhamPlanning.data as {datasets:Record<string,{data:{records:Row[]}|null}>}).datasets.protectedTransitStationArea2024.data?.records.some(r=>r.recordId===1 && r.publishedStationAreaName==="Ajax GO Station" && r.publishedStationStatus==="Existing"));
 const conflict=await durhamLayers("Whitby","ON",point);assert.equal(conflict.municipality.status,"ambiguous");assert.equal(conflict.durhamPlanning.status,"ambiguous");
 console.log(JSON.stringify({verifiedFeeds:18,withheld:3,publishedSourceRows:269836,geometryFixture:"Ajax GO Station; not a property identity claim",boundaryConflict:"ambiguous"}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
