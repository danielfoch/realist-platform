import { fetchJson, fetchText } from "./http";
import { civicStreetKey, layer, streetNumber, type Layer, type Row, type Source } from "./model";
import { OSHAWA_TERMS, OSHAWA_LICENCE_ANCHORS, validMunicipalPublisher } from "./ontario-municipal-sources";

export const OSHAWA_REGISTRATIONS = [
  { key:"additionalUnits", item:"97d92126eeae4430885d6225df0ff2a0", title:"Oshawa Registered Two Unit Apartments", name:"TwoUnit.csv", headers:["Property Address","Date Certificate was Issued"], dateField:"certificateIssuedDate" },
  { key:"rentalLicences", item:"1331c821b8cd49369f6dc89e2ce0fc50", title:"Oshawa Rental Housing Licenses Issued", name:"RRHL.csv", headers:["Address","Expiry Date"], dateField:"publishedExpiryDate" },
] as const;
type Feed = typeof OSHAWA_REGISTRATIONS[number];
const publisher = { owner:"City.of.Oshawa",org:"qQGLFamV2KgdKsUa",licenceAnchors:OSHAWA_LICENCE_ANCHORS };
function source(f:Feed):Source { return { id:`oshawa:${f.key}`,name:f.title,url:`https://www.arcgis.com/home/item.html?id=${f.item}`,licence:"Open Government Licence – The Corporation of the City of Oshawa, version 2.0",licenceUrl:OSHAWA_TERMS,attribution:"Contains information licensed under the Open Government Licence – The Corporation of the City of Oshawa." }; }
export function validOshawaRegistrationItem(item:Row,f:Feed):boolean {
  return validMunicipalPublisher(item,publisher) && item.id===f.item && item.type==="CSV" && item.title===f.title && item.name===f.name && !item.url && typeof item.modified==="number" && Number.isFinite(item.modified) && item.modified>0 && typeof item.size==="number" && item.size>20 && item.size<=400_000;
}

/** Strict two-column CSV: reject damaged quotes/rows instead of attaching another row's facts. */
export function parseOshawaCsv(csv:string,f:Feed):Row[] {
  if (Buffer.byteLength(csv,"utf8")>400_000) throw new Error("Registration file too large");
  const input=csv.replace(/^\uFEFF/,""), lines:string[][]=[];
  let row:string[]=[], field="", quoted=false, closed=false;
  const finishField=()=>{row.push(field);field="";closed=false;};
  const finishRow=()=>{finishField();lines.push(row);row=[];if(lines.length>10_001)throw new Error("Registration row bound exceeded");};
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){
      if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else field+=c;
    }else if(c===','){finishField();}
    else if(c==='\n'||c==='\r'){finishRow();if(c==='\r'&&input[i+1]==='\n')i++;}
    else if(c==='"'){if(field||closed)throw new Error("Unexpected CSV quote");quoted=true;}
    else {if(closed)throw new Error("CSV text after quote");field+=c;}
  }
  if(quoted)throw new Error("Unterminated CSV quote");
  if(field.length||row.length||closed)finishRow();
  const header=lines.shift();
  if(!header || header.length!==2 || header.some((x,i)=>x!==f.headers[i]) || !lines.length)throw new Error("Registration schema changed");
  return lines.map((cells,i)=>{
    if(cells.length!==2 || !cells[0].trim() || cells[0].length>240 || /[\x00-\x1f]/.test(cells[0]))throw new Error("Invalid registration row");
    const publishedAddress=cells[0].trim(), match=publishedAddress.match(/^(\d+[a-z]?\s+[^,]+?)(?:,\s*UNIT:([a-z0-9-]+))?$/i);
    const civicAddress=match?.[1].trim() ?? null;
    const rawDate=cells[1].trim();
    return { recordId:`${f.item}:row:${i+2}`,sourceRowNumber:i+2,publishedAddress,civicAddress,unit:match?.[2]??null,[f.dateField]:registrationDate(rawDate),publishedDateText:rawDate || null };
  });
}
function registrationDate(raw:string):string|null {
  const m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return null;
  const year=Number(m[3]),month=Number(m[1]),day=Number(m[2]),d=new Date(Date.UTC(year,month-1,day));
  return year>=1900 && year<=2100 && d.getUTCFullYear()===year && d.getUTCMonth()+1===month && d.getUTCDate()===day ? d.toISOString().slice(0,10) : null;
}
async function registrationFile(f:Feed) {
  const base=`https://www.arcgis.com/sharing/rest/content/items/${f.item}`;
  const item=await fetchJson(new URL(base+"?f=json")) as Row;
  if(!validOshawaRegistrationItem(item,f))throw new Error("Registration publisher, licence or file changed");
  // Direct fixed item data returns 200. Redirects remain prohibited by the bounded HTTP helper.
  const csv=await fetchText(new URL(base+"/data"));
  if(Buffer.byteLength(csv,"utf8")!==item.size)throw new Error("Registration file byte count changed");
  const records=parseOshawaCsv(csv,f);
  const after=await fetchJson(new URL(base+"?f=json")) as Row;
  if(!validOshawaRegistrationItem(after,f) || item.modified!==after.modified || item.size!==after.size)throw new Error("Registration file changed during retrieval");
  return {records,fileCatalogueModifiedAt:new Date(Number(item.modified)).toISOString()};
}
const evidenceNote = "The selected public file is an issued-record list; it does not prove completeness, continued registration/licensing, revocation status, final inspection or legality of an advertised unit. Catalogue modification time is file metadata, not a verified observation date. Exact civic-address results can include published unit records and shared-address sites with multiple buildings; an individual unit or building is not resolved. A no-match does not establish absence.";
export async function oshawaRegistrations(address:string|null):Promise<Record<string,Layer>> {
  return Object.fromEntries(await Promise.all(OSHAWA_REGISTRATIONS.map(async f=>{
    const s=source(f);
    if(!address || !streetNumber(address))return [f.key,layer("skipped",null,s,"A civic building/site address is required.")] as const;
    try{
      const file=await registrationFile(f), key=civicStreetKey(address);
      const matching=file.records.filter(r=>typeof r.civicAddress==="string" && civicStreetKey(r.civicAddress)===key), truncated=matching.length>50;
      const evidence=layer(matching.length?"available":"no_match",{records:matching.slice(0,50),matchMethod:"exact_normalized_civic_address",scope:"civic_address_site",coverageComplete:!truncated,publishedRowsInSelectedFile:file.records.length,fileCatalogueModifiedAt:file.fileCatalogueModifiedAt,sourceObservationDate:null,currentStatusVerified:false,finalInspectionVerified:false,unitLegalityVerified:false,completeHistorySearched:false,absenceEstablished:false,...(f.key==="rentalLicences"?{expiryMeaning:"Published licence expiry only; a future expiry does not prove current validity and a past expiry does not exclude an unpublished renewal."}:{certificateMeaning:"Certificate issue evidence in the published two-unit list; verify the specific unit and current municipal record."})},s,evidenceNote);
      evidence.truncated=truncated;return [f.key,evidence] as const;
    }catch{return [f.key,layer("unavailable",null,s,"The registration file's publisher, reuse terms, version, download or expected CSV schema could not be verified. No factual result is returned.")] as const;}
  })));
}
export async function oshawaRegistrationCoverage(){
  return Promise.all(OSHAWA_REGISTRATIONS.map(async f=>{
    try{const file=await registrationFile(f);return {city:"Oshawa" as const,layer:f.key,status:"verified",records:file.records.length,source:source(f),sourceUpdatedAt:null,fileCatalogueModifiedAt:file.fileCatalogueModifiedAt,note:evidenceNote};}
    catch{return {city:"Oshawa" as const,layer:f.key,status:"unavailable",records:null,source:source(f),sourceUpdatedAt:null,note:"Registration publisher, reuse terms, download or schema could not be verified."};}
  }));
}
