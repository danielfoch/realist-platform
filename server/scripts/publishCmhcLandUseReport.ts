import { blogPosts } from "@shared/schema";
import { db, pool } from "../db";

const slug = "cmhc-land-use-regulations-housing-canada-2026";
const sourceUrl =
  "https://assets.cmhc-schl.gc.ca/sites/cmhc/professional/housing-markets-data-and-research/housing-research/research-reports/2026/land-use-regulations-impact-housing-canada-en.pdf";
const publishedAt = new Date("2026-04-23T00:00:00.000Z");

const content = `
<p><strong>Source:</strong> Adapted from Canada Mortgage and Housing Corporation, <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Breaking Ground, Breaking Barriers: Land Use Regulations and the Impact on Housing in Canada</a>, 2026.</p>

<h2>Executive summary</h2>
<p>CMHC's 2026 research insight makes a clear policy point for Canadian housing investors, municipalities, and builders: land-use regulation is not just a planning issue. It affects prices, timelines, and the long-run volume of housing that gets built.</p>
<p>The report uses CMHC's Municipal Land Use and Regulation Survey, with 2022 as the reference year and more than 400 municipalities surveyed. CMHC combines survey responses into a Municipal Land Use and Regulation Index that captures how restrictive, complex, costly, or slow a municipality's development environment is.</p>
<p>The central finding is that stricter land-use regulation is associated with worse affordability and slower supply growth, even after controlling for factors such as population, income, growth, density, and city size.</p>

<h2>Key findings from CMHC</h2>
<ul>
  <li><strong>Housing prices:</strong> CMHC estimates that a 10% increase in municipal regulatory restrictiveness leads to roughly a 14% increase in house prices.</li>
  <li><strong>Housing supply:</strong> More restrictive regulation reduces the annual growth rate of the housing stock, which can compound into materially lower supply over time.</li>
  <li><strong>Approval bottlenecks:</strong> High-demand, high-cost markets often show strong demand for rezoning but lower approval rates.</li>
  <li><strong>Upzoning matters:</strong> CMHC points to recent as-of-right upzoning reforms as a positive shift because they reduce the need for special approvals when adding more homes on existing lots.</li>
</ul>

<h2>Why this matters for Canadian real estate</h2>
<p>For investors, the report helps explain why two markets with similar population growth can behave very differently. A market with restrictive zoning, higher fees, longer timelines, and heavier discretionary approvals can experience tighter supply and higher prices than fundamentals alone would imply.</p>
<p>For builders and infill developers, the message is more direct. Approval risk is underwriting risk. Longer timelines, uncertain rezonings, added studies, and shifting municipal requirements can change residual land value, carrying costs, financing needs, and the likelihood that a project is feasible at all.</p>
<p>For policymakers, CMHC's findings reinforce that affordability policy cannot focus only on demand-side measures. If the supply process remains difficult, price pressure can persist even when demand is moderated by interest rates, taxes, or credit conditions.</p>

<h2>The affordability link</h2>
<p>CMHC compares regulation scores with house-price-to-income ratios across selected CMAs, provinces, and territories. Expensive markets such as Vancouver, Toronto, and Victoria appear with higher regulation scores and high unaffordability measures. More affordable markets such as Quebec City and London show lower regulation scores in CMHC's sample.</p>
<p>CMHC also cautions that correlation alone is not enough. Large metropolitan areas are dense, complex, and infrastructure-constrained, so the research goes further by using statistical models designed to isolate the effect of regulation from other market characteristics.</p>
<p>The result is important because it turns a familiar planning debate into an empirical housing-supply argument: restrictive rules are not merely a symptom of expensive cities. CMHC's analysis suggests they contribute to higher prices and slower housing growth.</p>

<figure style="margin: 2rem 0;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 440" role="img" aria-label="Figure 1: Unaffordability vs Regulation Score" style="width:100%;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><line x1="70" y1="50" x2="70" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="70" y="390" font-size="11" fill="#6b7280" text-anchor="middle">70</text><line x1="194" y1="50" x2="194" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="194" y="390" font-size="11" fill="#6b7280" text-anchor="middle">79</text><line x1="318" y1="50" x2="318" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="318" y="390" font-size="11" fill="#6b7280" text-anchor="middle">88</text><line x1="442" y1="50" x2="442" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="442" y="390" font-size="11" fill="#6b7280" text-anchor="middle">97</text><line x1="566" y1="50" x2="566" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="566" y="390" font-size="11" fill="#6b7280" text-anchor="middle">106</text><line x1="690" y1="50" x2="690" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="690" y="390" font-size="11" fill="#6b7280" text-anchor="middle">115</text><line x1="70" y1="370" x2="690" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="374" font-size="11" fill="#6b7280" text-anchor="end">0.0</text><line x1="70" y1="306" x2="690" y2="306" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="310" font-size="11" fill="#6b7280" text-anchor="end">3.2</text><line x1="70" y1="242" x2="690" y2="242" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="246" font-size="11" fill="#6b7280" text-anchor="end">6.4</text><line x1="70" y1="177.99999999999997" x2="690" y2="177.99999999999997" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="181.99999999999997" font-size="11" fill="#6b7280" text-anchor="end">9.6</text><line x1="70" y1="114" x2="690" y2="114" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="118" font-size="11" fill="#6b7280" text-anchor="end">12.8</text><line x1="70" y1="50" x2="690" y2="50" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="54" font-size="11" fill="#6b7280" text-anchor="end">16.0</text><line x1="70" y1="325.3252511477791" x2="690" y2="140.12056002545617" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4,4"/><circle cx="138.88888888888889" cy="289.2" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="235.33333333333334" cy="283" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="244.33333333333334" y="276" font-size="11" font-weight="600" fill="#111827">Edmonton</text><circle cx="331.77777777777777" cy="197.60000000000002" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="469.5555555555556" cy="189" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="386.88888888888886" cy="193.79999999999998" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="566" cy="86.39999999999998" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="575" y="79.39999999999998" font-size="11" font-weight="600" fill="#111827">Vancouver</text><circle cx="621.1111111111111" cy="169.20000000000002" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="630.1111111111111" y="162.20000000000002" font-size="11" font-weight="600" fill="#111827">Victoria</text><circle cx="207.77777777777777" cy="303.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="235.33333333333334" cy="313.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="345.55555555555554" cy="307.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="276.66666666666663" cy="314.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="166.44444444444446" cy="315" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="138.88888888888889" cy="307.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="290.44444444444446" cy="237" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="455.77777777777777" cy="218" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="138.88888888888889" cy="241.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="345.55555555555554" cy="220" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="483.3333333333333" cy="176.6" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="492.3333333333333" y="169.6" font-size="11" font-weight="600" fill="#111827">Toronto</text><circle cx="318" cy="264.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="262.8888888888889" cy="260.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="510.8888888888889" cy="284.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="262.8888888888889" cy="270" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="276.66666666666663" cy="246.4" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="285.66666666666663" y="239.4" font-size="11" font-weight="600" fill="#111827">Montréal</text><circle cx="138.88888888888889" cy="290.6" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="147.88888888888889" y="283.6" font-size="11" font-weight="600" fill="#111827">Québec City</text><circle cx="152.66666666666669" cy="296.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="359.3333333333333" cy="300.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><line x1="70" y1="370" x2="690" y2="370" stroke="#374151" stroke-width="1.5"/><line x1="70" y1="50" x2="70" y2="370" stroke="#374151" stroke-width="1.5"/><text x="380" y="428" font-size="13" font-weight="600" fill="#111827" text-anchor="middle">Overall Regulation Score (higher = more restrictive)</text><text x="20" y="210" font-size="13" font-weight="600" fill="#111827" text-anchor="middle" transform="rotate(-90 20 210)">House Price to Household Income</text><text x="70" y="30" font-size="14" font-weight="700" fill="#111827">Figure 1: Unaffordability vs Regulation Score</text></svg>
    <figcaption style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem; text-align: center;">
      Each dot is a province, territory, or CMA. The dashed line shows the linear trend: as the regulation score rises, the price-to-income ratio rises with it. Vancouver, Toronto, and Victoria sit in the high-regulation, high-unaffordability quadrant. Source data: CMHC Municipal Land Use and Regulation Survey (2022) and 2021 Census, as published in <em>Breaking Ground, Breaking Barriers</em> (CMHC, 2026).
    </figcaption>
  </figure>

<h2>Supply growth is the second-order effect</h2>
<p>The price effect is the headline, but the supply effect may matter more over a long horizon. CMHC finds that increases in regulation reduce the annual growth of the housing stock. Even modest annual reductions can compound over a decade, especially in growing regions where demand does not pause while approval systems work through backlogs.</p>
<p>This matters for rental markets as well as ownership markets. When ownership supply is constrained, households remain in rental housing longer. When purpose-built and infill rental projects face the same regulatory friction, vacancy pressure can rise and rent growth can accelerate.</p>

<h2>Rezoning approval is a market signal</h2>
<p>CMHC highlights a mismatch in some expensive markets: the places with the strongest demand to rezone for additional homes often have lower approval rates. That is especially relevant for multiplex conversions, missing-middle housing, laneway suites, garden suites, small apartments, and other infill formats that depend on local rules.</p>
<p>As-of-right upzoning can reduce this friction by allowing additional units without requiring a separate discretionary approval. For investors and small builders, this changes the risk profile of a site. A property that can add units as-of-right is easier to underwrite than a property that depends on a rezoning, committee process, or uncertain neighbourhood opposition.</p>

<figure style="margin: 2rem 0;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 440" role="img" aria-label="Figure 2: Unaffordability vs Rezoning Approval Rate" style="width:100%;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px"><line x1="70" y1="50" x2="70" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="70" y="390" font-size="11" fill="#6b7280" text-anchor="middle">40</text><line x1="194" y1="50" x2="194" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="194" y="390" font-size="11" fill="#6b7280" text-anchor="middle">52</text><line x1="318" y1="50" x2="318" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="318" y="390" font-size="11" fill="#6b7280" text-anchor="middle">64</text><line x1="442" y1="50" x2="442" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="442" y="390" font-size="11" fill="#6b7280" text-anchor="middle">76</text><line x1="566" y1="50" x2="566" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="566" y="390" font-size="11" fill="#6b7280" text-anchor="middle">88</text><line x1="690" y1="50" x2="690" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="690" y="390" font-size="11" fill="#6b7280" text-anchor="middle">100</text><line x1="70" y1="370" x2="690" y2="370" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="374" font-size="11" fill="#6b7280" text-anchor="end">0.0</text><line x1="70" y1="306" x2="690" y2="306" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="310" font-size="11" fill="#6b7280" text-anchor="end">3.2</text><line x1="70" y1="242" x2="690" y2="242" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="246" font-size="11" fill="#6b7280" text-anchor="end">6.4</text><line x1="70" y1="177.99999999999997" x2="690" y2="177.99999999999997" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="181.99999999999997" font-size="11" fill="#6b7280" text-anchor="end">9.6</text><line x1="70" y1="114" x2="690" y2="114" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="118" font-size="11" fill="#6b7280" text-anchor="end">12.8</text><line x1="70" y1="50" x2="690" y2="50" stroke="#e5e7eb" stroke-width="1"/><text x="60" y="54" font-size="11" fill="#6b7280" text-anchor="end">16.0</text><line x1="70" y1="126.84124802072819" x2="690" y2="320.5262919245718" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4,4"/><circle cx="524.6666666666666" cy="289.2" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="504" cy="283" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="349" cy="197.60000000000002" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="142.33333333333331" cy="86.39999999999998" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="151.33333333333331" y="79.39999999999998" font-size="11" font-weight="600" fill="#111827">Vancouver</text><circle cx="493.6666666666667" cy="169.20000000000002" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="502.6666666666667" y="162.20000000000002" font-size="11" font-weight="600" fill="#111827">Victoria</text><circle cx="566" cy="303.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="597" cy="313.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="648.6666666666666" cy="307.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="617.6666666666666" cy="314.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="638.3333333333333" cy="315" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="483.3333333333333" cy="307.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="359.3333333333333" cy="237" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="473" cy="218" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="524.6666666666666" cy="241.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="421.3333333333333" cy="220" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="142.33333333333331" cy="176.6" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="151.33333333333331" y="169.6" font-size="11" font-weight="600" fill="#111827">Toronto</text><circle cx="504" cy="264.8" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="607.3333333333334" cy="260.6" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="616.3333333333334" y="253.60000000000002" font-size="11" font-weight="600" fill="#111827">Ottawa-Gatineau</text><circle cx="659" cy="284.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="400.6666666666667" cy="270" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="297.3333333333333" cy="246.4" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="306.3333333333333" y="239.4" font-size="11" font-weight="600" fill="#111827">Montréal</text><circle cx="628" cy="290.6" r="6" fill="#dc2626" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><text x="637" y="283.6" font-size="11" font-weight="600" fill="#111827">Québec City</text><circle cx="586.6666666666667" cy="296.4" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><circle cx="597" cy="300.6" r="4.5" fill="#2563eb" fill-opacity="0.85" stroke="#fff" stroke-width="1"/><line x1="70" y1="370" x2="690" y2="370" stroke="#374151" stroke-width="1.5"/><line x1="70" y1="50" x2="70" y2="370" stroke="#374151" stroke-width="1.5"/><text x="380" y="428" font-size="13" font-weight="600" fill="#111827" text-anchor="middle">Rezoning Approval Rate (%)</text><text x="20" y="210" font-size="13" font-weight="600" fill="#111827" text-anchor="middle" transform="rotate(-90 20 210)">House Price to Household Income</text><text x="70" y="30" font-size="14" font-weight="700" fill="#111827">Figure 2: Unaffordability vs Rezoning Approval Rate</text></svg>
    <figcaption style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem; text-align: center;">
      Markets with the lowest rezoning approval rates also tend to be the least affordable. Vancouver and Toronto both approve under half of rezoning applications and post the highest price-to-income ratios in the dataset. Source data: CMHC Municipal Land Use and Regulation Survey (2022) and 2021 Census, as published in <em>Breaking Ground, Breaking Barriers</em> (CMHC, 2026).
    </figcaption>
  </figure>

<h2>Investor implications</h2>
<p><strong>1. Zoning certainty deserves a premium.</strong> Sites with clear as-of-right density, fewer approval steps, and simpler permitting can justify stronger pricing because they reduce entitlement risk and carrying time.</p>
<p><strong>2. Restrictive markets may support prices but limit execution.</strong> Scarcity can support asset values, but the same restrictions can make it harder to add units, improve yield, or execute a value-add plan.</p>
<p><strong>3. Reform markets need close monitoring.</strong> Cities that recently loosened multiplex, missing-middle, or apartment rules may not show immediate supply response. The lag between policy change and completed units can be long, but early movers may benefit from learning the new process first.</p>
<p><strong>4. Approval timelines belong in the pro forma.</strong> A project that looks profitable under a six-month timeline may fail under an 18-month entitlement period. Financing cost, tax, insurance, consultant fees, and opportunity cost should be stress tested.</p>
<p><strong>5. Local regulation can overpower national narratives.</strong> Interest rates, immigration, and national policy matter, but municipal rules often decide whether a specific parcel can become more housing.</p>

<h2>Markets to watch</h2>
<p>The report's figures point to familiar high-cost markets, including Vancouver, Toronto, and Victoria, as places where unaffordability and regulatory restrictiveness both stand out. These are also markets where small changes in allowable density can have large effects because land values are high and demand is deep.</p>
<p>Ontario is notable in CMHC's discussion because the report uses it as an example of a province with higher average restrictiveness than Alberta. That does not mean every Ontario city is the same, but it does suggest investors should compare municipal process quality, not just provincial policy headlines.</p>
<p>Lower-score markets are also worth watching. If a city has population growth, job growth, and a more permissive approval environment, it may be able to respond to demand with more supply. That can moderate price growth, but it can also create clearer development pathways for builders who depend on repeatable approvals.</p>

<h2>What to do with this research</h2>
<p>For acquisition underwriting, treat regulation as a measurable input. Before buying a site for intensification, confirm current zoning, official plan direction, recent approvals, application timelines, fees, infrastructure capacity, and whether the desired unit count is permitted as-of-right.</p>
<p>For market selection, compare approval systems alongside rents, prices, vacancy, income, and cap rates. A high-rent market with slow approvals may not be better than a moderate-rent market where projects can actually be delivered.</p>
<p>For portfolio strategy, separate scarcity value from production value. Some markets reward holding existing assets because new supply is difficult. Other markets reward operators who can repeatedly create new units. The best strategy depends on which side of that trade-off you are underwriting.</p>

<h2>Bottom line</h2>
<p>CMHC's research adds Canadian evidence to a long-running housing debate: restrictive land-use systems raise the cost of housing and reduce the rate at which new homes are added. For investors, that means municipal regulation should be part of every market thesis and every development pro forma.</p>
<p>The practical takeaway is simple. Do not underwrite density only from a map. Underwrite the approval path, the timeline, the probability of success, and the political context that determines whether paper density becomes real housing.</p>
`;

const excerpt =
  "CMHC's 2026 land-use regulation report finds stricter municipal rules are linked to higher Canadian house prices, slower housing-stock growth, and approval bottlenecks in high-demand markets.";

const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;

async function main() {
  await db
    .insert(blogPosts)
    .values({
      title: "CMHC Land Use Regulations Report: What It Means for Canadian Housing Supply",
      slug,
      excerpt,
      content,
      authorName: "Realist Research",
      category: "market-analysis",
      tags: [
        "CMHC",
        "Land Use Regulation",
        "Housing Supply",
        "Zoning",
        "Canadian Housing Market",
        "Municipal Policy",
        "Development",
      ],
      status: "published",
      metaTitle: "CMHC Land Use Regulations Report 2026: Canadian Housing Supply",
      metaDescription:
        "CMHC's 2026 land-use regulation report shows how stricter municipal rules affect Canadian house prices, housing supply growth, and rezoning approvals.",
      readTimeMinutes: Math.max(4, Math.ceil(wordCount / 200)),
      publishedAt,
    })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        excerpt,
        content,
        authorName: "Realist Research",
        category: "market-analysis",
        tags: [
          "CMHC",
          "Land Use Regulation",
          "Housing Supply",
          "Zoning",
          "Canadian Housing Market",
          "Municipal Policy",
          "Development",
        ],
        status: "published",
        metaTitle: "CMHC Land Use Regulations Report 2026: Canadian Housing Supply",
        metaDescription:
          "CMHC's 2026 land-use regulation report shows how stricter municipal rules affect Canadian house prices, housing supply growth, and rezoning approvals.",
        readTimeMinutes: Math.max(4, Math.ceil(wordCount / 200)),
        publishedAt,
        updatedAt: new Date(),
      },
    });

  console.log(`Published report: /reports/${slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
