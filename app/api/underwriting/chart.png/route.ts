import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { apiError, rentalForRequest, PUBLIC_HEADERS, options } from "@/lib/public-underwriting/http";
import { money, metricTiles } from "@/lib/public-underwriting/visuals";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const result = await rentalForRequest(request);
    const scale = Math.max(1, ...result.charts.sensitivity.map(row => Math.abs(row.cashFlowMonthly ?? 0)));
    const div = (style: Record<string, string | number>, ...children: ReturnType<typeof h>[] | string[]) => h("div", { style: { display: "flex", ...style } }, ...children);
    const tiles = metricTiles(result).map(tile => div({ flexDirection: "column", width: 270, padding: 18, background: "white", borderRadius: 10 }, div({ fontSize: 17, color: "#666" }, tile.label), div({ fontSize: 32, marginTop: 12 }, tile.value)));
    const rows = result.charts.sensitivity.map(row => {
      const value = row.cashFlowMonthly ?? 0;
      const width = Math.max(1, Math.abs(value) / scale * 260);
      return div({ alignItems: "center", height: 52 }, div({ width: 250, fontSize: 20 }, row.label), div({ position: "relative", width: 640, height: 30 }, div({ position: "absolute", left: 320, height: 34, width: 1, background: "#aaa" }), div({ position: "absolute", left: value < 0 ? 320 - width : 320, width, height: 28, borderRadius: 3, background: value < 0 ? "#be1730" : "#242424" })), div({ width: 230, justifyContent: "flex-end", fontSize: 20, color: value < 0 ? "#be1730" : "#242424" }, money(row.cashFlowMonthly)));
    });
    return new ImageResponse(div({ width: 1200, height: 800, background: "#f5f5f5", color: "#242424", padding: 40, flexDirection: "column", fontFamily: "sans-serif" },
      div({ color: "#be1730", fontSize: 18 }, "REALIST / DEAL UNDERWRITING"),
      div({ fontSize: 30, marginTop: 18 }, (result.property.address ?? "Rental investment scenario").slice(0, 75)),
      div({ gap: 20, marginTop: 30 }, ...tiles),
      div({ fontSize: 25, marginTop: 32, marginBottom: 12 }, "What happens to monthly cash flow?"),
      div({ flexDirection: "column" }, ...rows),
      div({ fontSize: 20, marginTop: 28 }, `Price ${money(result.inputs.price)} · Rent ${money(result.inputs.monthlyRent)}/mo · ${result.inputs.downPaymentPercent}% down · ${result.inputs.interestRate}% interest`),
      div({ fontSize: 20, marginTop: 16 }, `Cash required ${money(result.metrics.cashInvested)} · Break-even offer ${money(result.offerPrices.breakEvenCashFlow)}`),
      div({ fontSize: 15, color: "#666", marginTop: 20 }, `CAD · Scenario assumptions, not an appraisal · ${result.calculationVersion}`),
    ), { width: 1200, height: 800, headers: { ...PUBLIC_HEADERS, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export const OPTIONS = options;
