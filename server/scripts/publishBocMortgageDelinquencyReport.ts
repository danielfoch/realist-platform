import { blogPosts } from "@shared/schema";
import { db, pool } from "../db";

const slug = "bank-of-canada-consumers-path-mortgage-delinquency-2026";
const sourceUrl = "https://www.bankofcanada.ca/wp-content/uploads/2026/02/sap2026-3.pdf";
const publishedAt = new Date("2026-02-26T00:00:00.000Z");

const content = `
<p><strong>Source:</strong> Adapted from Bank of Canada Staff Analytical Paper 2026-3, <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Consumers' Path to Mortgage Delinquency</a>, by Laura Zhao, Jia Qi Xiao, and Aidan Witts. Bank of Canada staff research is independent of Governing Council and should not be read as official policy guidance.</p>

<h2>Executive summary</h2>
<p>The Bank of Canada paper gives investors, lenders, and real estate operators a practical way to think about mortgage stress before it appears in arrears data. The main finding is that Canadian borrowers usually do not move straight from current payments to missed mortgage payments. Stress first shows up in consumer credit.</p>
<p>Using TransUnion Canada borrower credit data from 2015 to 2024, the authors find that future mortgage-delinquent households begin leaning harder on revolving credit roughly two years before their first mortgage delinquency. One to two years before the mortgage event, missed payments begin rising on consumer products, especially credit cards. In the final six months, both utilization and non-mortgage delinquencies accelerate.</p>
<p>For Canadian real estate, the implication is straightforward: mortgage arrears are a lagging indicator. Credit-card utilization, credit-card arrears, borrower creditworthiness, and payment-growth stress are better early-warning signals for the next wave of forced selling, refinancing pain, and lender caution.</p>

<h2>Key findings from the paper</h2>
<ul>
  <li><strong>Mortgage debt is systemically large:</strong> outstanding Canadian residential mortgage debt was about $2.4 trillion as of November 2025, close to 73% of GDP and roughly 74% of total household debt.</li>
  <li><strong>The data are broad:</strong> the TransUnion panel covers more than 9 million mortgage holders and over 100 mortgage lenders, representing around 80% of Canadian household mortgages.</li>
  <li><strong>Credit cards are the first warning light:</strong> around 90% of mortgage borrowers also have at least one credit card, making card utilization and arrears useful high-frequency stress indicators.</li>
  <li><strong>Stress begins early:</strong> revolving credit use starts rising roughly 24 months before the first mortgage delinquency.</li>
  <li><strong>Arrears spread before the mortgage breaks:</strong> non-mortgage product delinquencies rise one to two years before mortgage delinquency, with credit cards moving earliest.</li>
  <li><strong>The last six months matter most:</strong> credit-card delinquency rates rise by as much as 20 percentage points and utilization rises by about 6 percentage points as mortgage delinquency nears.</li>
  <li><strong>Behaviour beats static underwriting alone:</strong> utilization, credit-card arrears, and the interaction between utilization and credit score explain more than 70% of the model's total variation.</li>
</ul>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-mortgage-delinquency-2026/chart-09.png" alt="Bank of Canada chart showing credit utilization rising more than 24 months before mortgage delinquency" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 1: credit-card and personal-line utilization rises steadily for borrowers who later become mortgage delinquent.</figcaption>
</figure>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-mortgage-delinquency-2026/chart-10.png" alt="Bank of Canada charts showing non-mortgage delinquencies and credit utilization accelerating before mortgage delinquency" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Charts 2 and 3: consumer-credit arrears lead mortgage delinquency, then accelerate in the final months.</figcaption>
</figure>

<h2>The path to mortgage delinquency</h2>
<p>The paper's timeline is useful because it separates early financial strain from the final default event. Mortgage payments are usually prioritized because the consequences of falling behind are severe. Borrowers under pressure tend to absorb shocks first through unsecured or revolving credit, then miss smaller consumer obligations, and only later miss mortgage payments.</p>

<figure style="margin: 2rem 0;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" role="img" aria-label="Timeline of early warning signals before mortgage delinquency" style="width:100%;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
    <rect width="760" height="300" fill="#ffffff"/>
    <line x1="80" y1="150" x2="680" y2="150" stroke="#cbd5e1" stroke-width="3"/>
    <line x1="80" y1="145" x2="80" y2="155" stroke="#64748b" stroke-width="2"/>
    <line x1="280" y1="145" x2="280" y2="155" stroke="#64748b" stroke-width="2"/>
    <line x1="480" y1="145" x2="480" y2="155" stroke="#64748b" stroke-width="2"/>
    <line x1="680" y1="145" x2="680" y2="155" stroke="#64748b" stroke-width="2"/>
    <circle cx="80" cy="150" r="9" fill="#2563eb"/>
    <circle cx="280" cy="150" r="9" fill="#7c3aed"/>
    <circle cx="480" cy="150" r="9" fill="#f59e0b"/>
    <circle cx="680" cy="150" r="9" fill="#dc2626"/>
    <text x="80" y="190" font-size="13" fill="#334155" text-anchor="middle">-36 months</text>
    <text x="280" y="190" font-size="13" fill="#334155" text-anchor="middle">~ -24 months</text>
    <text x="480" y="190" font-size="13" fill="#334155" text-anchor="middle">-12 to -6 months</text>
    <text x="680" y="190" font-size="13" fill="#334155" text-anchor="middle">Mortgage delinquency</text>
    <text x="80" y="82" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">Baseline</text>
    <text x="280" y="72" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">Utilization rises</text>
    <text x="280" y="94" font-size="12" fill="#475569" text-anchor="middle">Cards and lines of credit</text>
    <text x="480" y="72" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">Consumer arrears rise</text>
    <text x="480" y="94" font-size="12" fill="#475569" text-anchor="middle">Credit cards move first</text>
    <text x="680" y="72" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle">Mortgage missed</text>
    <text x="680" y="94" font-size="12" fill="#475569" text-anchor="middle">Lagging stress signal</text>
    <text x="380" y="250" font-size="13" fill="#64748b" text-anchor="middle">Realist summary of Bank of Canada Staff Analytical Paper 2026-3.</text>
  </svg>
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Mortgage delinquency is the end of the sequence, not the start. The paper finds the earliest measurable signals in revolving credit behaviour.</figcaption>
</figure>

<h2>Why this matters for Canadian housing investors</h2>
<p>Investors usually watch headline mortgage arrears, unemployment, listings, and rates. Those matter, but they can miss the early household balance-sheet deterioration that eventually becomes mortgage stress. If credit-card arrears and utilization are already rising, the market may be accumulating future motivated sellers even before power-of-sale activity shows up.</p>
<p>This is especially important in a refinancing cycle. Borrowers who can technically make today's payment may still be using revolving credit to bridge higher mortgage costs, weaker income, or higher living expenses. That can preserve the mortgage payment for a while, but it also makes the household more fragile at renewal, job loss, separation, repair shock, or rent vacancy.</p>

<h2>How to read the signal</h2>
<p>The paper does not say that every borrower with high credit-card utilization will become mortgage delinquent. It says the pattern has predictive value at scale. A rise in utilization is more concerning when paired with a lower credit score, missed credit-card payments, mortgage payment growth, or a sharp drop in card spending.</p>
<p>For market surveillance, the most useful framing is not a single borrower screen. It is a local stress dashboard: rising revolving utilization, rising card arrears, falling discretionary spending, softer labour markets, and more listings with seller-motivation language should be read together.</p>

<h2>Investor playbook</h2>
<p><strong>1. Treat mortgage arrears as late-cycle data.</strong> By the time mortgage arrears rise, pressure has often been building for one to two years in consumer credit.</p>
<p><strong>2. Watch consumer-credit stress alongside listings.</strong> A market with rising utilization and rising stale inventory is more vulnerable than a market with only one of those signals.</p>
<p><strong>3. Underwrite holding power, not just purchase price.</strong> Borrowers and investors with high revolving balances have less room to absorb vacancies, repairs, insurance increases, tax changes, and refinancing shocks.</p>
<p><strong>4. Expect lender caution to follow borrower stress.</strong> If behavioural indicators worsen, lenders may tighten approvals, scrutinize debt-service ratios, or price risk more aggressively before arrears data looks alarming.</p>
<p><strong>5. Separate distress opportunity from distress risk.</strong> More financial stress can create motivated acquisitions, but it can also hurt rents, resale liquidity, and refinancing options. Buying cheap is not enough if the capital stack cannot survive the same environment.</p>

<h2>What operators should monitor</h2>
<ul>
  <li><strong>Credit-card delinquency:</strong> the paper identifies card arrears as one of the earliest non-mortgage stress signals.</li>
  <li><strong>Revolving utilization:</strong> rising utilization is especially important when borrowers are moving closer to credit limits.</li>
  <li><strong>Credit score interaction:</strong> high utilization is more concerning for weaker-credit borrowers than for high-score borrowers.</li>
  <li><strong>Mortgage payment growth:</strong> payment increases are statistically significant in the robustness model, even though behavioural credit variables carry more explanatory weight.</li>
  <li><strong>Local labour conditions:</strong> the paper points to future work incorporating income and employment shocks; for investors, that means local job risk should sit beside credit signals.</li>
</ul>

<h2>Bottom line</h2>
<p>The Bank of Canada paper reframes mortgage delinquency as a process, not an event. Canadian households usually show strain in revolving credit before they miss mortgage payments. That makes consumer credit behaviour one of the best early warning systems for future housing stress.</p>
<p>For real estate investors, the practical takeaway is to stop waiting for mortgage arrears to confirm the cycle. By then, the market has already moved. Track credit-card arrears, utilization, income risk, payment resets, and listing behaviour together. That is where the early signal lives.</p>
`;

const excerpt =
  "Bank of Canada research using TransUnion data finds that Canadian mortgage stress often starts in consumer credit: utilization rises roughly two years before mortgage delinquency, and credit-card arrears accelerate before the mortgage payment is missed.";

const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;

async function main() {
  await db
    .insert(blogPosts)
    .values({
      title: "Bank of Canada Mortgage Delinquency Report: The Early Warning Signals Before Borrowers Miss Payments",
      slug,
      excerpt,
      content,
      coverImage: "/reports/boc-mortgage-delinquency-2026/chart-10.png",
      authorName: "Realist Research",
      category: "market-analysis",
      tags: [
        "Bank of Canada",
        "Mortgage Delinquency",
        "Household Credit",
        "Credit Cards",
        "Financial Stability",
        "Canadian Housing Market",
        "Distress",
      ],
      status: "published",
      metaTitle: "Bank of Canada Mortgage Delinquency Report 2026",
      metaDescription:
        "Realist analysis of Bank of Canada Staff Analytical Paper 2026-3 on consumer credit warning signals before Canadian mortgage delinquency.",
      readTimeMinutes: Math.max(5, Math.ceil(wordCount / 200)),
      publishedAt,
    })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        title: "Bank of Canada Mortgage Delinquency Report: The Early Warning Signals Before Borrowers Miss Payments",
        excerpt,
        content,
        coverImage: "/reports/boc-mortgage-delinquency-2026/chart-10.png",
        authorName: "Realist Research",
        category: "market-analysis",
        tags: [
          "Bank of Canada",
          "Mortgage Delinquency",
          "Household Credit",
          "Credit Cards",
          "Financial Stability",
          "Canadian Housing Market",
          "Distress",
        ],
        status: "published",
        metaTitle: "Bank of Canada Mortgage Delinquency Report 2026",
        metaDescription:
          "Realist analysis of Bank of Canada Staff Analytical Paper 2026-3 on consumer credit warning signals before Canadian mortgage delinquency.",
        readTimeMinutes: Math.max(5, Math.ceil(wordCount / 200)),
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
