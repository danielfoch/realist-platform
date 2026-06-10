import { blogPosts } from "@shared/schema";
import { db, pool } from "../db";

const slug = "bank-of-canada-financial-stability-report-2026";
const sourceUrl = "https://www.bankofcanada.ca/wp-content/uploads/2026/05/fsr2026.pdf";
const publishedAt = new Date("2026-05-22T00:00:00.000Z");

const content = `
<p><strong>Source:</strong> Adapted from the Bank of Canada, <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Financial Stability Report 2026</a>. Realist commentary is editorial and focused on implications for Canadian real estate investors.</p>

<h2>Executive summary</h2>
<p>The Bank of Canada's 2026 Financial Stability Report says Canada's financial system is still functioning well, but the risk backdrop has become more fragile. Households, businesses and large banks remain broadly resilient. The concern is not one single weak point. The concern is that stretched asset valuations, high sovereign debt issuance, hedge-fund repo leverage, trade uncertainty, geopolitical risk and AI-related concentration could interact if a new shock hits.</p>
<p>For real estate investors, the household section is the most directly actionable. Household stress has stabilized, but debt levels remain elevated, mortgage arrears have risen in specific high loan-to-income pockets, and the last wave of pandemic-era five-year fixed-payment mortgages will renew over the next 12 months. The Bank estimates this group represents about 12% of outstanding mortgages and faces an average payment increase of about 15%.</p>
<p>The report's housing message is balanced: most borrowers are managing higher rates, but lower home prices have reduced refinancing flexibility for some owners. Stress is most acute among Toronto borrowers with high loan-to-income ratios who originated mortgages in 2022-23. That group is small nationally, but it matters for local condo, pre-construction and motivated-seller risk.</p>

<h2>Key takeaways</h2>
<ul>
  <li><strong>System-wide resilience is intact:</strong> households and businesses remain in stable financial condition, and large Canadian banks have improved their capacity to absorb shocks.</li>
  <li><strong>Market vulnerabilities are higher:</strong> equity and corporate debt valuations are stretched, and sovereign debt issuance is increasing globally.</li>
  <li><strong>AI concentration is a financial-stability issue:</strong> the S&amp;P 500's information technology weight is near dot-com-bubble levels, so an AI earnings disappointment could hit broader indexes.</li>
  <li><strong>Household stress has plateaued:</strong> borrowers 60+ days late on at least one credit product are broadly stable at about 2.5% for non-mortgage holders and 1.3% for mortgage holders.</li>
  <li><strong>Mortgage arrears are low but uneven:</strong> arrears are only slightly above the 2018-19 average overall, but have risen more for high loan-to-income borrowers.</li>
  <li><strong>Toronto is the pressure pocket:</strong> stress is most acute among Toronto borrowers with high loan-to-income ratios who took out mortgages in 2022-23.</li>
  <li><strong>Renewal shock is not finished:</strong> the final wave of five-year fixed-payment pandemic mortgages renews over the next year, with average payment increases around 15%.</li>
</ul>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-fsr-2026/chart-1-valuations.png" alt="Bank of Canada chart showing compressed risk premiums and elevated valuation measures" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 1: risk premiums and credit spreads are compressed relative to historical distributions.</figcaption>
</figure>

<h2>Financial markets: the correction risk is higher</h2>
<p>The Bank highlights stretched valuations in equities and corporate debt. Equity risk premiums, forward earnings yields and credit spreads are all near low-risk-premium or high-valuation parts of their historical distributions. That does not guarantee a correction, but it means investors are being paid less for taking risk.</p>
<p>The report also flags concentration risk. Large technology companies tied to AI investment now represent a very large share of US equity market capitalization. If earnings expectations disappoint, that one sector could drive a broader market correction. For Canadian real estate investors, this matters because equity wealth, lending sentiment and funding markets can all affect housing liquidity.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-fsr-2026/chart-2-sp500-tech.png" alt="Bank of Canada chart showing the information technology sector's rising share of the S&P 500" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 2: information technology has become an increasingly large share of the S&amp;P 500.</figcaption>
</figure>

<h2>Households: stable overall, but pockets matter</h2>
<p>The household read-through is not a broad crisis. Household indebtedness remains high, but below its 2022 peak. Debt relative to net worth has edged down and is below its pre-pandemic average. The Bank also notes that many borrowers renewed below qualifying rates, and some reduced payment shock by extending amortization.</p>
<p>The stress signal is narrower. People without mortgages are still showing higher delinquency rates than mortgage holders, and high loan-to-income borrowers are seeing more mortgage arrears. That is consistent with the Bank's separate work on the path to mortgage delinquency: consumer-credit strain tends to appear before mortgage arrears become obvious.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-fsr-2026/chart-6-household-stress.png" alt="Bank of Canada chart showing financial stress stabilizing for mortgage holders and non-mortgage holders" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 6: financial stress has stabilized, but remains higher for non-mortgage holders than mortgage holders.</figcaption>
</figure>

<h2>Mortgage arrears: low nationally, higher in the wrong pockets</h2>
<p>Mortgage arrears remain low overall. The report says the share of mortgage accounts more than 60 days behind is only slightly above the 2018-19 average. But the average hides risk. Borrowers with high loan-to-income ratios represent about 17% of outstanding mortgage balances, and arrears have increased more for them.</p>
<p>The Bank identifies the sharpest stress among Toronto borrowers with high loan-to-income ratios who originated mortgages in 2022-23. That group represents about 2% of outstanding mortgage balances nationally, but it sits in one of the most important investor markets in Canada. It also overlaps with softer condo conditions, pre-construction closing difficulty and lower refinancing flexibility.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-fsr-2026/chart-7-mortgage-arrears.png" alt="Bank of Canada chart showing mortgage arrears rising among high loan-to-income borrowers" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 7: arrears remain low overall, but have increased among borrowers with large balances relative to income.</figcaption>
</figure>

<h2>The renewal wave still has one last hard leg</h2>
<p>The next 12 months bring the last wave of five-year fixed-payment mortgages taken out during the pandemic. The Bank estimates these borrowers account for about 12% of outstanding mortgages and will see payments rise by about 15% on average. By the second half of 2027, nearly all borrowers facing large payment increases will have renewed.</p>
<p>The Bank's base case is that most borrowers can manage the increase because incomes have grown. The risk is concentrated among households with weaker income growth, less equity because of lower home prices, or limited capacity to refinance under lender requirements.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/boc-fsr-2026/chart-8-renewal-payment-shock.png" alt="Bank of Canada chart showing large payment increases for five-year fixed-payment mortgage renewals" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Bank of Canada Chart 8: the final wave of five-year fixed-payment pandemic mortgages faces large renewal increases.</figcaption>
</figure>

<h2>Investor implications</h2>
<p><strong>1. Do not use national arrears as the whole stress signal.</strong> The national number is still low. The useful signal is local and borrower-specific: high loan-to-income, weaker equity, renewal timing, job risk and condo-market liquidity.</p>
<p><strong>2. Toronto condo exposure deserves extra caution.</strong> The Bank explicitly points to Toronto high-LTI 2022-23 borrowers as the acute stress pocket. That overlaps with the segment where investor-owned condos, pre-construction assignments and refinancing risk are most relevant.</p>
<p><strong>3. Renewal risk is now more focused than broad.</strong> The biggest payment shocks are increasingly concentrated in the remaining five-year fixed-payment renewals. That can produce motivated sellers without creating a system-wide mortgage crisis.</p>
<p><strong>4. Watch employment more than rates alone.</strong> The Bank says the main household risk is that economic or geopolitical developments cause a downturn and a sharp rise in unemployment. Rate relief helps, but income loss is what turns stretched borrowers into distressed borrowers.</p>
<p><strong>5. Funding-market stress can hit real estate indirectly.</strong> Repo leverage, sovereign debt absorption and stretched risk assets may sound far from duplex underwriting, but they influence bank funding costs, credit availability, investor sentiment and exit liquidity.</p>

<h2>Bottom line</h2>
<p>The 2026 Financial Stability Report is not calling a Canadian financial crisis. It is saying the system is resilient, but the margin for error has narrowed. For real estate investors, the best opportunities and risks are likely to be local: stressed condos, high loan-to-income borrowers, renewal-heavy submarkets and sellers with limited refinancing options.</p>
<p>The practical playbook is to underwrite liquidity. Assume buyers may be scarcer, lender scrutiny may stay high, and refinancing may not be available to every owner. In that environment, cash flow, debt structure and local resale depth matter more than a simple rate-cut thesis.</p>
`;

const excerpt =
  "Bank of Canada's 2026 Financial Stability Report says Canada's system remains resilient, but stretched valuations, sovereign-debt and repo-market vulnerabilities, renewal shock, and Toronto high-LTI mortgage stress deserve investor attention.";

const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;

async function main() {
  await db
    .insert(blogPosts)
    .values({
      title: "Bank of Canada Financial Stability Report 2026: What It Means for Canadian Real Estate",
      slug,
      excerpt,
      content,
      coverImage: "/reports/boc-fsr-2026/chart-7-mortgage-arrears.png",
      authorName: "Realist Research",
      category: "market-analysis",
      tags: [
        "Bank of Canada",
        "Financial Stability",
        "Mortgage Arrears",
        "Renewals",
        "Household Debt",
        "Canadian Housing Market",
        "Toronto Condos",
        "Financial Markets",
      ],
      status: "published",
      metaTitle: "Bank of Canada Financial Stability Report 2026: Real Estate Impact",
      metaDescription:
        "Realist analysis of the Bank of Canada Financial Stability Report 2026, covering mortgage arrears, renewal shock, Toronto stress pockets, and market vulnerabilities.",
      readTimeMinutes: Math.max(6, Math.ceil(wordCount / 200)),
      publishedAt,
    })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        title: "Bank of Canada Financial Stability Report 2026: What It Means for Canadian Real Estate",
        excerpt,
        content,
        coverImage: "/reports/boc-fsr-2026/chart-7-mortgage-arrears.png",
        authorName: "Realist Research",
        category: "market-analysis",
        tags: [
          "Bank of Canada",
          "Financial Stability",
          "Mortgage Arrears",
          "Renewals",
          "Household Debt",
          "Canadian Housing Market",
          "Toronto Condos",
          "Financial Markets",
        ],
        status: "published",
        metaTitle: "Bank of Canada Financial Stability Report 2026: Real Estate Impact",
        metaDescription:
          "Realist analysis of the Bank of Canada Financial Stability Report 2026, covering mortgage arrears, renewal shock, Toronto stress pockets, and market vulnerabilities.",
        readTimeMinutes: Math.max(6, Math.ceil(wordCount / 200)),
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
