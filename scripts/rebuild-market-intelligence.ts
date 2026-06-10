import { rebuildMarketIntelligence, finalizeLeaderboardSnapshot } from "../server/marketIntelligence";

const mode = process.argv[2] || "rebuild";
const anchor = process.argv[3] ? new Date(process.argv[3]) : new Date();

if (mode === "finalize-month") {
  const result = await finalizeLeaderboardSnapshot({ periodType: "monthly", anchor, force: process.argv.includes("--force") });
  console.log(JSON.stringify(result, null, 2));
} else {
  const result = await rebuildMarketIntelligence(anchor);
  console.log(JSON.stringify(result, null, 2));
}
