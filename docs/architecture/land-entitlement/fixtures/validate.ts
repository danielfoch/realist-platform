import { createHash } from "node:crypto";
import { assumptions, expectedCells, records, stages, type Stage } from "./fixture-data";

const rank: Record<Stage,number> = Object.fromEntries(stages.map((s,i)=>[s,i])) as Record<Stage,number>;
const terminal = new Set<Stage>(["withdrawn","refused","expired"]);
const allowed: Partial<Record<Stage,Stage[]>> = {
  pre_application:["application_submitted","withdrawn"], application_submitted:["deemed_complete","under_review","withdrawn","refused"],
  deemed_complete:["under_review","withdrawn","refused"], under_review:["recommendation_or_appeal","approved","withdrawn","refused"],
  recommendation_or_appeal:["approved","under_review","refused","withdrawn"], approved:["conditions_or_agreements","permits_or_site_works","expired"],
  conditions_or_agreements:["permits_or_site_works","expired"], permits_or_site_works:["under_construction","expired"], under_construction:["completed"],
};

function rollup(values: Stage[]): Stage {
  if (values.includes("completed")) return "completed";
  if (values.includes("under_construction")) return "under_construction";
  const live = values.filter(s=>!terminal.has(s));
  if (!live.length) return values[0] ?? "unknown";
  if (live.includes("unknown")) return "unknown";
  return live.sort((a,b)=>rank[a]-rank[b])[0];
}
function illegal(previous:Stage|undefined,next:Stage) { return !!previous && previous!=="unknown" && !(allowed[previous]??[]).includes(next); }
function mortgageConstant(rate:number, years:number) { const i=rate/12,n=years*12; return 12*(i*(1+i)**n/((1+i)**n-1)); }
function debtCap(units:number,rate:number) { const a=assumptions.base; const noi=units*a.rentPerUnitMonthly*12*(1-a.vacancy)*(1-a.expenseRatio); return noi/(a.dscr*mortgageConstant(rate,a.amortYears)); }

const parallel = records.filter(r=>r.site==="parallel").map(r=>r.stage);
if (rollup(parallel)!=="under_review") throw new Error("parallel-track roll-up failed");
console.log("stage roll-up: PASS");
if (!records.some(r=>illegal(r.previous,r.stage))) throw new Error("illegal transition missed");
console.log("illegal transition flagged: PASS");

const seen=new Set<string>();
const ingest=()=>records.filter(r=>{ const k=createHash("sha256").update(`${r.id}|${r.stage}`).digest("hex"); if(seen.has(k)) return false; seen.add(k); return true; }).length;
if (ingest()===0 || ingest()!==0) throw new Error("idempotency failed");
console.log("idempotency: PASS");

expectedCells.forEach((c,i)=>{ const actual=debtCap(c.units,c.rate); if(Math.abs(actual-c.debtCap)>2) throw new Error(`matrix cell ${i} mismatch: ${actual}`); console.log(`matrix cell ${i===0?"A":"B"}: PASS`); });
