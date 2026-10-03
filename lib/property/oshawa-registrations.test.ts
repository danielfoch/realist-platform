import { beforeEach, describe, expect, it, vi } from "vitest";
import { OSHAWA_REGISTRATIONS, oshawaRegistrations, oshawaRegistrationCoverage, parseOshawaCsv, validOshawaRegistrationItem } from "./oshawa-registrations";
import { OSHAWA_TERMS } from "./ontario-municipal-sources";
import { preShowingBrief } from "./brief";
import type { Row } from "./model";
const {json,csv}=vi.hoisted(()=>({json:vi.fn(),csv:vi.fn()}));
vi.mock("./http",()=>({fetchJson:json,fetchText:csv}));
const certificates=OSHAWA_REGISTRATIONS[0],licences=OSHAWA_REGISTRATIONS[1];
let files:Record<string,string>={};
function item(f=certificates as typeof OSHAWA_REGISTRATIONS[number]):Row {return {id:f.item,access:"public",owner:"City.of.Oshawa",orgId:"qQGLFamV2KgdKsUa",type:"CSV",title:f.title,name:f.name,url:null,size:Buffer.byteLength(files[f.item]),modified:1764694452000,licenseInfo:`<a href='${OSHAWA_TERMS}'>Open licence</a>`};}
function file(f:typeof OSHAWA_REGISTRATIONS[number],rows:string){return f.headers.join(",")+"\n"+rows;}
beforeEach(()=>{files={ [certificates.item]:file(certificates,"55 ABERDEEN ST,02/09/2018\n"),[licences.item]:file(licences,'"460 WOODMOUNT DR, UNIT:18",08/09/2027\n') };json.mockReset().mockImplementation(async(u:URL)=>item(OSHAWA_REGISTRATIONS.find(f=>u.pathname.includes(f.item))!));csv.mockReset().mockImplementation(async(u:URL)=>files[OSHAWA_REGISTRATIONS.find(f=>u.pathname.includes(f.item))!.item]);});
describe("Oshawa issued registration evidence",()=>{
  it("binds the public City CSV, organization, exact name, title, size and terms",()=>{
    expect(validOshawaRegistrationItem(item(),certificates)).toBe(true);
    for(const change of [{owner:"copy"},{orgId:null},{access:"private"},{id:licences.item},{title:"different"},{name:"other.csv"},{type:"Feature Service"},{url:"https://example.com/data"},{size:400001},{modified:null},{licenseInfo:""},{licenseInfo:"all rights reserved"}])expect(validOshawaRegistrationItem({...item(),...change},certificates)).toBe(false);
  });
  it("parses quoted unit addresses and preserves source rows, raw dates and unknown dates",()=>{
    const records=parseOshawaCsv('\uFEFF'+file(licences,'"460 WOODMOUNT DR, UNIT:18",08/09/2027\r\n52 AIR DANCER CRES,02/30/2027\n'),licences);
    expect(records[0]).toMatchObject({civicAddress:"460 WOODMOUNT DR",unit:"18",publishedAddress:"460 WOODMOUNT DR, UNIT:18",publishedExpiryDate:"2027-08-09",publishedDateText:"08/09/2027",sourceRowNumber:2});
    expect(records[1]).toMatchObject({publishedExpiryDate:null,publishedDateText:"02/30/2027"});
    expect(parseOshawaCsv(file(certificates,'55 ABERDEEN ST,02/29/2024\n'),certificates)[0].certificateIssuedDate).toBe("2024-02-29");
  });
  it("rejects changed columns, damaged quotes, malformed rows and empty files",()=>{
    for(const value of ['Address,Date\n55 ABERDEEN ST,02/09/2018\n',file(certificates,'"55 ABERDEEN ST,02/09/2018'),file(certificates,'"55 ABERDEEN ST"bad,02/09/2018\n'),file(certificates,'55 ABERDEEN ST,02/09/2018,extra\n'),file(certificates,''),file(certificates,'55 ABE"RDEEN ST,02/09/2018\n')])expect(()=>parseOshawaCsv(value,certificates)).toThrow();
    expect(()=>parseOshawaCsv(file(certificates,'55 ABERDEEN ST,02/09/2018\n'.repeat(10001)),certificates)).toThrow();
  });
  it("matches exact civic direction/suffix and keeps unit entries as site evidence",async()=>{
    files[certificates.item]=file(certificates,'55 ABERDEEN ST,02/09/2018\n55A ABERDEEN ST,02/09/2020\n');files[licences.item]=file(licences,'"460 WOODMOUNT DR, UNIT:18",08/09/2027\n"460 WOODMOUNT DR, UNKNOWN:18",08/09/2027\n');
    const r=await oshawaRegistrations("460 Woodmount Drive");expect(r.rentalLicences.status).toBe("available");expect(r.rentalLicences.data).toMatchObject({scope:"civic_address_site",currentStatusVerified:false,unitLegalityVerified:false,sourceObservationDate:null,records:[expect.objectContaining({unit:"18"})]});expect(r.rentalLicences.sourceUpdatedAt).toBeNull();
    expect((await oshawaRegistrations("55 Aberdeen Street")).additionalUnits.data).toMatchObject({records:[expect.objectContaining({certificateIssuedDate:"2018-02-09"})]});
    expect((await oshawaRegistrations("55 Aberdeen St N")).additionalUnits.status).toBe("no_match");
  });
  it("exposes old/new expiry evidence without asserting current status or validity",async()=>{
    files[licences.item]=file(licences,'52 AIR DANCER CRES,09/05/2027\n52 AIR DANCER CRES,09/05/2025\n');
    const r=(await oshawaRegistrations("52 Air Dancer Cres")).rentalLicences;expect(r.data).toMatchObject({currentStatusVerified:false,completeHistorySearched:false,records:[expect.objectContaining({publishedExpiryDate:"2027-09-05"}),expect.objectContaining({publishedExpiryDate:"2025-09-05"})]});expect(r.sourceUpdatedAt).toBeNull();expect(r.note).toContain("not a verified observation date");
    const brief=preShowingBrief({rentalLicences:r},[]);expect(brief.findings[0].summary).toContain("current validity");expect(brief.documentsToRequest[2]?.document??brief.documentsToRequest.at(-1)?.document).toContain("rental licence");
  });
  it("fails closed before download when licence changes and during a version change",async()=>{
    json.mockResolvedValue({...item(),licenseInfo:""});expect((await oshawaRegistrations("55 Aberdeen St")).additionalUnits.status).toBe("unavailable");expect(csv).not.toHaveBeenCalled();
    json.mockClear().mockImplementation(async(u:URL)=>({...item(OSHAWA_REGISTRATIONS.find(f=>u.pathname.includes(f.item))!),modified:json.mock.calls.length<3?1:2}));expect((await oshawaRegistrations("55 Aberdeen St")).additionalUnits.status).toBe("unavailable");
  });
  it("distinguishes successful empty matching from a failed file and bounds records",async()=>{
    expect((await oshawaRegistrations("99 Nonexistent Rd")).additionalUnits.data).toMatchObject({absenceEstablished:false});
    files[certificates.item]=file(certificates,'55 ABERDEEN ST,02/09/2018\n'.repeat(51));const r=(await oshawaRegistrations("55 Aberdeen St")).additionalUnits;expect(r.truncated).toBe(true);expect(r.data).toMatchObject({coverageComplete:false});expect((r.data as Row).records).toHaveLength(50);
    csv.mockRejectedValue(new Error("offline"));expect((await oshawaRegistrations("55 Aberdeen St")).additionalUnits.status).toBe("unavailable");expect((await oshawaRegistrationCoverage()).every(f=>f.records===null&&f.status==="unavailable")).toBe(true);
  });
  it("rejects a partial but syntactically valid file rather than returning absence",async()=>{
    csv.mockResolvedValue(file(certificates,'99 DIFFERENT ST,02/09/2018\n'));expect((await oshawaRegistrations("55 Aberdeen St")).additionalUnits.status).toBe("unavailable");
  });
});
