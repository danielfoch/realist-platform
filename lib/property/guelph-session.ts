import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** Guelph's inspected terms require no concurrent source requests, at most five per second.
 * The existing lease table coordinates all production/staged workers; no new schema is created.
 * Fail closed when busy or disconnected. Keep every source request inside this callback.
 */
export async function withGuelphSession<T>(run:(renew:()=>Promise<void>)=>Promise<T>):Promise<T> {
  const token=randomUUID(),key="property-guelph-upstream";
  const claim=await getDb().execute(sql`INSERT INTO property_refresh_runs (key,token,lease_until,last_attempt_at,status) VALUES (${key},${token},now()+interval '45 seconds',now(),'running') ON CONFLICT (key) DO UPDATE SET token=EXCLUDED.token,lease_until=EXCLUDED.lease_until,last_attempt_at=now(),status='running' WHERE property_refresh_runs.lease_until IS NULL OR property_refresh_runs.lease_until < now() RETURNING key`);
  if(!claim.rows.length)throw new Error("Guelph source session busy");
  let renewedAt=Date.now();
  const renew=async()=>{
    if(Date.now()-renewedAt<3000)return;
    const result=await getDb().execute(sql`UPDATE property_refresh_runs SET lease_until=now()+interval '45 seconds' WHERE key=${key} AND token=${token} AND lease_until>now() RETURNING key`);
    if(!result.rows.length)throw new Error("Guelph source session lost");
    renewedAt=Date.now();
  };
  try{return await run(renew);}finally{
    // A failed release leaves a short lease rather than allowing concurrent source traffic.
    try{await getDb().execute(sql`UPDATE property_refresh_runs SET token=NULL,lease_until=NULL,status='idle' WHERE key=${key} AND token=${token}`);}catch{}
  }
}
