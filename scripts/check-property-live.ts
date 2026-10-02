import { enrichProperty, coverage } from "../lib/property/service";

async function main() {
  const samples = ["15 Deermeade Pl SE, Calgary, AB", "1636 McCreary Road, Winnipeg, MB", "90 Ash Crescent, Toronto, ON", "778 Robson Street, Vancouver, BC", "10 Clarke Ave, Coxheath, NS"];
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), imported: (await coverage()).imported }));
  for (const address of samples) console.log(JSON.stringify({ address, result: await enrichProperty({ address }) }));
}
main().catch(() => { console.error("Live property verification failed"); process.exitCode = 1; });
