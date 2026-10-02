/** Read-only smoke test against the scoped database and public government services. */
import fs from "node:fs/promises";
import { enrichProperty } from "../../lib/property/service";
process.env.DATABASE_URL = (await fs.readFile("/private/tmp/realist-import-database-url", "utf8")).trim();
const samples = [
  { address: "15 Deermeade Pl SE, Calgary, AB" },
  { address: "1214 16 Ave NW, Edmonton, AB" },
  { address: "1636 McCreary Rd, Winnipeg, MB" },
  { address: "10 Clarke Ave, Coxheath, NS" },
  { address: "44 Rue Parc P'Tiso, Edmundston, NB" },
  { address: "5405 Manitoba St, Vancouver, BC" },
  { address: "90 Ash Crescent, Toronto, ON" },
];
for (const sample of samples) {
  const start = Date.now(), result = await enrichProperty(sample);
  console.log(JSON.stringify({ query: sample, ms: Date.now() - start, result }));
}
