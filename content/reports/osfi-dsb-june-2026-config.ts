/**
 * Config report: OSFI lowers the Domestic Stability Buffer to 3.0% (June 2026).
 *
 * Ported from the orphaned market-reports/osfi-dsb-june-2026/report.md. The
 * regulator's own chart package ships as static images (public/reports/
 * osfi-dsb-june-2026/), so this report leans on `image` blocks rather than
 * recharts data. The mortgage-capital argument is an inference from OSFI's
 * capital decision, not an OSFI statement — the warning callout below keeps
 * that hedge explicit, exactly as the source report did.
 */
import { DEFAULT_AUTHOR, type ReportContent } from "@/lib/research/reportContent";

const OSFI_RELEASE_URL =
  "https://www.osfi-bsif.gc.ca/en/news/osfi-lowers-domestic-stability-buffer-30-so-canadas-largest-banks-can-deploy-more-capital";
const OSFI_DECISION_NOTE_URL =
  "https://www.osfi-bsif.gc.ca/en/supervision/financial-institutions/banks/domestic-stability-buffer/domestic-stability-buffer-decision-summary-note-june-2026";

const IMG = "/reports/osfi-dsb-june-2026";

export const osfiDsbJune2026ConfigReport: ReportContent = {
  slug: "osfi-dsb-june-2026",
  title: "OSFI Lowers the Domestic Stability Buffer to 3.0%: Why It Could Free Up More Mortgage Capital",
  dek: "On June 19, 2026, OSFI cut the Domestic Stability Buffer for Canada's largest banks from 3.5% to 3.0% of risk-weighted assets — its first level change since June 2023. The regulator frames it as releasing well-capitalized banks to support the economy; the reasonable inference for housing is more balance-sheet room for mortgage credit, not automatic mortgage easing.",
  author: DEFAULT_AUTHOR,
  publishDate: "2026-06-19",
  kind: "macro",
  tags: ["osfi", "banks", "mortgage-credit", "capital-rules", "regulation", "housing"],
  metaTitle: "OSFI Cuts the Domestic Stability Buffer to 3.0%: Mortgage Capital Implications",
  metaDescription:
    "OSFI lowered the Domestic Stability Buffer to 3.0% and the big-bank CET1 expectation to 11.0% in June 2026. What the decision — and its chart package — could mean for Canadian mortgage credit and housing.",
  heroStat: {
    label: "Domestic Stability Buffer",
    value: "3.0%",
    detail:
      "Down from 3.5% of risk-weighted assets. The supervisory CET1 expectation for Canada's largest banks falls to 11.0%; they currently average 13.5%.",
  },
  sections: [
    {
      type: "narrative",
      heading: "Executive summary",
      id: "executive-summary",
      body:
        "On June 19, 2026, OSFI lowered the Domestic Stability Buffer (DSB) for Canada's domestic systemically important banks from **3.5%** to **3.0%** of risk-weighted assets and cut the top end of the DSB range from **4%** to **3%**. That reduces the supervisory Common Equity Tier 1 (CET1) expectation for the big banks to **11.0%**.\n\nOSFI's stated reason is that Canada's largest banks are already well capitalized, with an average CET1 ratio of **13.5%**, and can now deploy more of that excess capital into the economy. OSFI explicitly frames the move as a way to support lending and risk-taking through a period of change in trade, geopolitics, infrastructure, defence, resources, and AI.\n\nThe mortgage implication is not stated directly by OSFI, but it is a reasonable inference. A lower capital buffer gives large banks more room to grow risk-weighted assets without raising new equity first. Since residential mortgages are a core asset class for Canadian banks, part of that added capacity could flow into mortgage originations, renewals, refinancing, warehouse lines, and construction-related credit. It does not guarantee easier mortgage credit, but it improves the system's capacity to provide it.",
    },
    {
      type: "statGrid",
      heading: "What changed",
      id: "what-changed",
      stats: [
        { label: "DSB level", value: "3.0%", detail: "Cut from 3.5% — first level change since June 2023", trend: "down" },
        { label: "DSB range", value: "0% – 3%", detail: "Top end cut from 4%", trend: "down" },
        { label: "Big-bank CET1 expectation", value: "11.0%", detail: "Supervisory minimum incl. buffers", trend: "down" },
        { label: "Average D-SIB CET1", value: "13.5%", detail: "As of April 30, 2026 — well above the new floor", trend: "flat" },
        { label: "Capital cushion", value: "~$74B", detail: "Excess CET1 above the new expectation", trend: "up" },
        { label: "RWA expansion room", value: "~$673B", detail: "Risk-weighted asset capacity that cushion supports", trend: "up" },
      ],
    },
    {
      type: "narrative",
      heading: "Why OSFI says it is comfortable cutting the buffer",
      id: "osfi-rationale",
      body:
        "OSFI's rationale is straightforward:\n\n- The banks have remained profitable and well capitalized.\n- Expected credit loss provisioning has stabilized.\n- Credit growth has picked up, though still below long-run norms.\n- Stress tests suggest banks can absorb significant shocks while continuing to lend.\n- Broader system vulnerabilities are still elevated, but have been relatively stable.\n\nThe decision note still highlights familiar Canadian vulnerabilities: household indebtedness remains high, house prices are still elevated relative to fundamentals even after cooling, and unemployment and delinquencies have risen but remain within historically normal ranges.",
    },
    {
      type: "callout",
      tone: "warning",
      heading: "An inference, not an OSFI quote",
      id: "inference-caveat",
      body:
        "The mortgage-capital argument below is an inference from OSFI's capital decision, not a direct OSFI statement. Lowering the DSB does not force banks to make more mortgages — it reduces how much CET1 they must hold against a given stock of risk-weighted assets, and capital is one of the main constraints on balance-sheet growth.",
    },
    {
      type: "narrative",
      heading: "Why this could lead to more mortgage capital",
      id: "mortgage-capital",
      body:
        "In practice, a looser aggregate capital constraint can support mortgage credit in a few ways:\n\n- **More origination capacity:** banks have more room to add insured and uninsured mortgage exposure before capital becomes binding.\n- **More renewal and refinance flexibility:** lenders can keep competing for high-quality borrowers instead of preserving as much capital headroom.\n- **More support for housing-adjacent credit:** home equity lines, builder finance, land loans, and insured multifamily lending can all benefit.\n- **Better pricing resilience:** if capital is less scarce, banks may be less aggressive about widening spreads solely to ration balance sheet.\n\nThe most important caveat is that mortgage capital does not move only with capital rules. It also depends on funding costs, unemployment, home prices, arrears, OSFI underwriting standards, securitization conditions, and banks' internal risk appetite. So the likely effect is \"more capacity to lend\" rather than \"automatic mortgage easing.\"",
    },
    {
      type: "narrative",
      heading: "Real estate read-through",
      id: "real-estate-read-through",
      body:
        "For housing markets, the cleanest interpretation is that OSFI is trying to preserve resilience while making sure capital rules do not unnecessarily choke off credit during a slower, more uncertain cycle.\n\nThat matters because mortgage markets usually tighten before housing weakens materially. If large banks have more room to keep lending, renew loans, and absorb demand for prime mortgage credit, that can reduce the odds of an avoidable credit crunch. It is more supportive for mortgage availability than for home prices directly, but the two are linked.\n\nFor borrowers and investors, the likely first-order effects are:\n\n- Prime borrowers may continue to see strong competition from large-bank lenders.\n- Multifamily and insured rental lending could remain better supported than feared if banks use some released capacity there.\n- A softer capital constraint may help keep refinancing channels open for stronger borrowers even if the macro backdrop stays uneven.\n- The move is more likely to support credit availability than to trigger a broad drop in mortgage rates by itself.",
    },
    {
      type: "narrative",
      heading: "What the charts show",
      id: "charts",
      body:
        "The decision note's chart package argues that vulnerabilities are still real, but not deteriorating fast enough to justify keeping the old, higher buffer.",
    },
    {
      type: "image",
      id: "chart-household-leverage",
      title: "1. Household leverage is still high",
      src: `${IMG}/chart-01.jpg`,
      alt: "Line chart of the Canadian household debt-to-income ratio, rising again into early 2026 to 179.4% in March 2026, below recent highs.",
      caption:
        "OSFI shows the household debt-to-income ratio rising again into early 2026, to 179.4% in March 2026, but still below recent highs.",
      width: 1179,
      height: 765,
    },
    {
      type: "image",
      id: "chart-price-to-income",
      title: "2. Home prices have cooled relative to income",
      src: `${IMG}/chart-02.jpg`,
      alt: "Line chart of the Canadian house price-to-income index falling to 144.53 in March 2026 from much higher 2021-2023 levels.",
      caption:
        "OSFI's house price-to-income index fell to 144.53 in March 2026 from much higher 2021-2023 levels, suggesting valuations have come off the peak even if they still look elevated versus fundamentals.",
      width: 1185,
      height: 676,
    },
    {
      type: "image",
      id: "chart-debt-service",
      title: "3. Debt-service pressure remains elevated",
      src: `${IMG}/chart-03.jpg`,
      alt: "Line chart of the Canadian household debt service ratio ticking up to 14.75% in March 2026, below 2023 highs.",
      caption:
        "The household debt service ratio ticked up to 14.75% in March 2026, below 2023 highs but still historically heavy enough to matter for mortgage sensitivity.",
      width: 1242,
      height: 707,
    },
    {
      type: "image",
      id: "chart-corporate-debt",
      title: "4. Corporate leverage is still a macro vulnerability",
      src: `${IMG}/chart-04.jpg`,
      alt: "Line chart of Canadian non-financial corporate debt to GDP, rising again since 2022.",
      caption:
        "OSFI also keeps an eye on non-financial corporate debt-to-GDP, which has been rising again since 2022.",
      width: 1323,
      height: 766,
    },
    {
      type: "image",
      id: "chart-geopolitical-risk",
      title: "5. Geopolitics still matter",
      src: `${IMG}/chart-05.jpg`,
      alt: "Line chart of the geopolitical risk index, showing an unstable external environment.",
      caption:
        "The geopolitical risk index chart supports OSFI's point that the external environment is unstable even though domestic banks remain strong.",
      width: 1372,
      height: 790,
    },
    {
      type: "image",
      id: "chart-trade-uncertainty",
      title: "6. Trade uncertainty has cooled from the spike",
      src: `${IMG}/chart-06.jpg`,
      alt: "Line chart of the trade policy uncertainty index, elevated but easing from earlier spikes.",
      caption:
        "Trade policy uncertainty remains elevated in the background, but has eased from earlier spikes.",
      width: 1533,
      height: 815,
    },
    {
      type: "image",
      id: "chart-cet1",
      title: "7. Bank capital levels remain comfortably above the new minimum",
      src: `${IMG}/chart-07.jpg`,
      alt: "Line chart of average D-SIB Common Equity Tier 1 ratios remaining above 13.5%, well above the new 11.0% supervisory expectation.",
      caption:
        "This is the core chart behind the decision. Average D-SIB CET1 ratios remain above 13.5%, well above the new 11.0% supervisory expectation.",
      width: 1335,
      height: 744,
    },
    {
      type: "image",
      id: "chart-unemployment",
      title: "8. Unemployment has risen, but not to crisis levels",
      src: `${IMG}/chart-08.jpg`,
      alt: "Line chart of the Canadian unemployment rate reaching 6.6% in May 2026.",
      caption:
        "OSFI notes the unemployment rate reached 6.6% in May 2026, which is higher, but still not a crisis reading by historical standards.",
      width: 1341,
      height: 742,
    },
    {
      type: "image",
      id: "chart-ecl-coverage",
      title: "9. Loss provisioning looks contained",
      src: `${IMG}/chart-09.jpg`,
      alt: "Line chart of the D-SIB expected credit loss coverage ratio increasing gradually.",
      caption:
        "The expected credit loss coverage ratio has increased gradually, which supports OSFI's view that banks are provisioning prudently rather than falling behind credit deterioration.",
      width: 1356,
      height: 760,
    },
    {
      type: "image",
      id: "chart-impaired-loans",
      title: "10. Impaired loans have risen, but remain manageable",
      src: `${IMG}/chart-10.jpg`,
      alt: "Line chart of D-SIB average gross impaired loans climbing, though still within historically normal ranges.",
      caption:
        "Gross impaired loans have been climbing, though OSFI still describes overall delinquencies and credit losses as within historically normal ranges.",
      width: 1251,
      height: 725,
    },
    {
      type: "image",
      id: "chart-funding-spread",
      title: "11. Funding spreads widened briefly, then eased",
      src: `${IMG}/chart-11.jpg`,
      alt: "Line chart of D-SIB average funding spreads moving up in February-March 2026 and then falling back.",
      caption:
        "Bank funding spreads moved up in February-March 2026 and then fell back, consistent with a market that is alert but not disorderly.",
      width: 1674,
      height: 917,
    },
    {
      type: "callout",
      tone: "info",
      heading: "Bottom line",
      id: "bottom-line",
      body:
        "OSFI is telling the market that Canadian banks are strong enough to operate with a slightly smaller capital buffer and should use some of that excess capacity to support the economy. For housing and real estate, the practical implication is that the large banks now have somewhat more room to extend mortgage credit and adjacent housing finance without new equity needing to do as much of the work.\n\nThat does not mean a mortgage boom is coming. It means the regulatory backdrop has become modestly more supportive for mortgage capital at the margin.",
    },
  ],
  sources: [
    {
      label: "OSFI lowers Domestic Stability Buffer to 3.0% so Canada's largest banks can deploy more capital",
      url: OSFI_RELEASE_URL,
      publisher: "OSFI news release, June 19, 2026",
    },
    {
      label: "Domestic Stability Buffer decision summary note — June 2026",
      url: OSFI_DECISION_NOTE_URL,
      publisher: "OSFI",
    },
  ],
  cta: {
    toolUrl: "/listings",
    headline: "A looser capital backdrop is not a deal thesis",
    body: "More bank capacity can support mortgage availability at the margin, but every purchase still has to survive its own underwriting. Browse pre-underwritten listings and pressure-test the cap rate and cash flow before the credit narrative does the thinking for you.",
  },
};
