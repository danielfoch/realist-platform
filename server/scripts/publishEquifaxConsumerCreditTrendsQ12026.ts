import { blogPosts } from "@shared/schema";
import { db, pool } from "../db";

const slug = "equifax-consumer-credit-trends-q1-2026";
const sourceUrl =
  "https://livestorm-ireland-plugins-handouts.s3.eu-west-1.amazonaws.com/0f7c6ac1-1a5c-4c3d-a18d-5c96515427a4/5bee3c63-2b73-4a7a-9f0f-41b409135f37/Equifax%20Consumer%20Credit%20Trends%20Q1%202026%20-%20English.pdf";
const publishedAt = new Date("2026-06-02T00:00:00.000Z");

const content = `
<p><strong>Source:</strong> Adapted from <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Equifax Canada's Consumer Credit Trends &amp; Economic Insights, Q1 2026</a>. Realist commentary is editorial and focused on implications for Canadian real estate, mortgage renewals, and housing-market risk.</p>

<h2>Executive summary</h2>
<p>The Equifax Consumer Credit Trends Q1 2026 report shows a Canadian household sector that is trying to stay disciplined but is still under pressure. Non-mortgage debt fell by about $487 million in the quarter, suggesting some post-holiday restraint. But that headline improvement sits beside a more concerning set of signals: insolvency volumes have climbed to their highest level since 2009, mortgage delinquency rates are still rising year over year, and severe credit-card delinquencies are worsening most quickly among mortgage holders in Ontario and British Columbia.</p>
<p>For Canadian real estate, the report matters because it links consumer-credit strain to the parts of the housing market already dealing with affordability fatigue, expensive renewals, and weaker refinancing flexibility. Equifax's read is not that every borrower is breaking at once. It is that stress is becoming more visible in the exact segments where housing costs are highest and mortgage resets are hardest.</p>
<p>The strongest housing signal in the report is geographic and borrower-specific. Ontario and BC mortgage holders are driving much of the deterioration in mortgage and card delinquency metrics. That makes this report highly relevant for investors, Realtors, mortgage brokers, and buyers trying to understand where motivated sellers and renewal stress are most likely to appear first.</p>

<h2>Key takeaways</h2>
<ul>
  <li><strong>Total consumer debt keeps rising:</strong> total consumer debt reached about $2.66 trillion in Q1 2026, up 3.79% year over year.</li>
  <li><strong>Consumers pulled back on non-mortgage balances:</strong> non-mortgage debt fell by roughly $487 million in the quarter after several quarters of growth.</li>
  <li><strong>Mortgage holders are still the critical watchlist:</strong> Equifax says disciplined spending helped in Q1, but lingering high rates and inflation still pushed insolvencies to the highest level since 2009.</li>
  <li><strong>Mortgage delinquency is rising unevenly:</strong> the 90+ day mortgage delinquency rate increased to 0.28% from 0.21% a year earlier, with the pressure concentrated in Ontario and British Columbia.</li>
  <li><strong>Insolvency severity is getting worse for homeowners:</strong> homeowner insolvency volumes jumped more than 11% from the previous quarter, and the average non-mortgage insolvency balance for homeowners reached $82.4K.</li>
  <li><strong>Credit-card stress is diverging by housing status:</strong> Equifax says mortgage holders in Ontario and BC are under the greatest pressure, while mortgage-free seniors are showing stronger repayment behaviour.</li>
  <li><strong>Mortgage renewals remain part of the problem:</strong> the report directly ties Ontario and BC stress to housing costs and mortgage renewals, especially where borrowers are still rolling out of older low-rate fixed terms.</li>
</ul>

<h2>Why this Equifax report matters for Canadian real estate</h2>
<p>Search intent around <strong>Equifax Canada consumer credit trends</strong>, <strong>mortgage delinquency Canada</strong>, <strong>Ontario mortgage renewals</strong>, <strong>BC housing stress</strong>, and <strong>credit card delinquency Canada</strong> is really about one practical question: are households stabilizing, or are they simply rationing spending while deeper stress keeps building?</p>
<p>Equifax's Q1 2026 answer is mixed. Households showed more discipline in non-mortgage borrowing, but the harder stress indicators did not disappear. Insolvencies remain elevated, delinquency rates on several credit products are still worse than a year ago, and the most housing-sensitive borrower groups remain under pressure in the country's highest-cost provinces.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-1-consumer-debt-11.png" alt="Equifax Canada chart showing total consumer debt and non-mortgage debt balances in Q1 2026" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Equifax Q1 2026 consumer debt snapshot: total consumer debt reached $2.66 trillion even as non-mortgage balances edged down in the quarter.</figcaption>
</figure>

<h2>Consumer debt: restraint is visible, but the balance sheet is still large</h2>
<p>Equifax reports that total consumer debt in Canada reached about $2.66 trillion, up 3.79% year over year. Mortgage balances were about $2.0 trillion, while HELOC balances reached $226.8 billion and credit-card balances reached $130.7 billion. Auto balances were up 6.87% year over year to $95.8 billion.</p>
<p>The more encouraging data point is that non-mortgage debt fell by about $487 million in Q1, which Equifax frames as a sign of disciplined post-holiday debt management. But real estate operators should be careful not to over-read that improvement. A quarter of restraint does not erase the larger affordability problem, especially when mortgage debt, HELOC exposure, and housing-carry costs remain high.</p>
<p>For housing, the message is that the balance sheet is still heavy even if borrowers are trying to behave better. When cash flow is tight, short-term discipline can coexist with medium-term renewal risk.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-2-delinquency-13.png" alt="Equifax Canada chart showing 90 plus day delinquency rates across multiple consumer credit products" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Equifax delinquency view: severe delinquencies rose year over year for mortgages, loans, cards, and unsecured lines, even though the quarter-to-quarter rise was milder than seasonal norms.</figcaption>
</figure>

<h2>Delinquencies: the quarterly pace improved, but year-over-year stress is still rising</h2>
<p>Equifax says severe 90+ day delinquency rates rose year over year for several major credit products. Mortgage delinquency increased to 0.28% from 0.21%. Credit-card delinquency rose to 4.15% from 3.82%. Loans increased to 1.56% from 1.47%, and unsecured lines of credit rose to 2.23% from 1.94%.</p>
<p>The important nuance is that the quarterly rise in missed payments was below normal seasonal expectations. That suggests the pace of deterioration may have eased in Q1 even though household stress is still worse than it was a year ago. For real estate, this is the kind of data that supports a selective-stress view rather than either a clean recovery narrative or an immediate crash narrative.</p>

<h2>Demographics and regions: stress is not evenly distributed</h2>
<p>Equifax notes that borrowers under 25 posted their first year-over-year improvement in 90+ day non-mortgage delinquencies since mid-2022. That is useful, but it is not the centre of gravity for housing risk. The more important divide is between mortgage-free households and households still carrying expensive housing costs.</p>
<p>The report repeatedly points to a stark split among older borrowers as well. Mortgage-free seniors improved their repayment behaviour and paid down balances more aggressively, while mortgage-holding households had less cash-flow room. For housing professionals, this distinction matters because it suggests that age alone is not the best stress lens. Housing payment burden is.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-3-insolvency-15.png" alt="Equifax Canada chart showing insolvency volumes and average insolvency balances for homeowners and non-homeowners" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Equifax insolvency data: homeowner insolvency volumes jumped sequentially, and average non-mortgage insolvency balances remained much higher for homeowners than for non-homeowners.</figcaption>
</figure>

<h2>Insolvencies: the severity story is especially important for homeowners</h2>
<p>One of the strongest warning signals in the Equifax report is insolvency severity. Equifax says insolvency volumes have surged to levels not seen since 2009, while the overall insolvency rate reached the highest level since 2019. Homeowner insolvency volumes rose more than 11% from the previous quarter, and over 90% of those filings chose consumer proposals rather than bankruptcy.</p>
<p>The average non-mortgage insolvency balance for homeowners reached $82.4K in Q1 2026, up 2.6% from a year earlier and 19.0% from Q1 2024. That is a useful real-estate signal because it suggests defaults are not just becoming more common in stressed pockets; they are becoming larger when they happen.</p>
<p>For investors and agents, that increases the odds of motivated-sale behaviour in some submarkets, particularly where owners are carrying mortgage renewals, credit-card balances, and HELOC debt at the same time.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-4-mortgage-terms-20.png" alt="Equifax and CMHC chart showing shifts in mortgage renewal terms and fixed versus variable mortgage rates" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Mortgage term shift: borrowers are moving away from a simple five-year fixed default and looking harder at shorter terms and variable-rate products.</figcaption>
</figure>

<h2>Mortgage renewals: borrowers are changing term choices under rate uncertainty</h2>
<p>Equifax highlights a notable behaviour shift in the mortgage market. More borrowers are reluctant to commit to a five-year fixed term and are exploring shorter fixed terms or variable-rate options instead. The report notes that since Q4 2025, variable mortgage rates fell below fixed-rate mortgage rates, encouraging some borrowers to move away from fixed-rate products.</p>
<p>This matters for real estate because it shortens certainty. When borrowers use shorter terms or variables to manage payment pressure, they gain flexibility in the short run but also face a faster refinance cycle and more sensitivity to future rate volatility. That can matter for both owner-occupiers and leveraged investors.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-5-mortgage-delinquency-21.png" alt="Equifax Canada chart showing Ontario and British Columbia leading mortgage delinquency growth" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Mortgage delinquency geography: Ontario and British Columbia remain the clearest pressure pockets in Equifax's Q1 2026 mortgage data.</figcaption>
</figure>

<h2>Ontario and BC: where mortgage stress is showing up first</h2>
<p>Equifax says the increase in mortgage delinquency is largely concentrated in Ontario and British Columbia, where households face the strongest payment pressure. That makes sense in a market where housing costs, mortgage renewals, and price-to-income strain are all more intense than in cheaper regions.</p>
<p>The report also notes that first-time homebuyer activity fell 1.8% year over year in Q1 2026. Combined with renewal stress, that is not a great mix for liquidity. If fewer marginal buyers are stepping in while more existing owners are still wrestling with reset payments, higher-cost provinces are more vulnerable to slower absorption and softer resale conditions.</p>
<p>Equifax's mortgage section also warns that geopolitical energy shocks could defer expected rate cuts. For real estate, that keeps the same tension alive: weaker affordability argues for easier rates, but sticky inflation risk can slow that relief.</p>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-6-card-balances-31.png" alt="Equifax Canada chart showing average credit card balances by credit score segment" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Credit-card balances remain heaviest in riskier score bands, while mortgage holders continue to carry the most sensitive revolving exposure.</figcaption>
</figure>

<figure style="margin: 2rem 0;">
  <img src="/reports/equifax-consumer-credit-trends-q1-2026/chart-7-card-delinquency-35.png" alt="Equifax Canada chart showing Ontario and BC mortgage holders driving credit card delinquency growth" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff;" loading="lazy" />
  <figcaption style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem;text-align:center;">Credit-card delinquency growth is also concentrated in Ontario and BC, reinforcing the connection between housing costs, renewals, and broader consumer-credit stress.</figcaption>
</figure>

<h2>Credit cards: the consumer-credit pressure is still tied to housing costs</h2>
<p>Equifax reports that average credit-card balances remain highest in the weaker credit-score bands, with the 621-680 group averaging $9,230 and the 581-620 group averaging $8,879. Even the 320-520 band averaged $6,919. Overall average credit-card balance per consumer was $4,481, up 2.2% year over year.</p>
<p>The report also says new credit-card originations fell to a four-year low. New cards opened were down 1.5% year over year, while growth in balances on newly opened cards was only 1.0%. That is another sign that consumers are not leaning into easy expansion credit the way they might in a stronger cycle.</p>
<p>The most housing-relevant card data is regional. Equifax says Ontario and BC mortgage holders are driving credit-card delinquency growth, with severe card delinquency rates at 4.64% in Ontario and 3.67% in BC. Year-over-year growth in those provincial delinquency rates was 11.17% and 13.23%, respectively.</p>

<h2>What this means for Canadian real estate investors, buyers, sellers and Realtors</h2>
<p><strong>1. Renewal stress is still the key transmission channel.</strong> Equifax connects current stress to borrowers rolling out of older cheaper mortgages into a more expensive payment environment.</p>
<p><strong>2. Ontario and BC deserve tighter underwriting.</strong> If you are buying, lending, or prospecting in those markets, use more conservative assumptions for carrying costs, exit timing, and borrower resilience.</p>
<p><strong>3. Insolvency severity matters more than delinquency headlines alone.</strong> Bigger insolvency balances mean that when households fail, they may fail with less flexibility and fewer cleanup options.</p>
<p><strong>4. Non-mortgage restraint does not mean the cycle is healed.</strong> A quarterly paydown in consumer balances can happen at the same time as rising insolvencies and delinquency pressure.</p>
<p><strong>5. Credit-card stress is a housing signal.</strong> In high-cost provinces, missed card payments are not just a consumer-finance story. They are part of the same affordability system as mortgage renewals and housing-carry costs.</p>

<h2>Practical playbook</h2>
<ul>
  <li><strong>Buyers:</strong> Stress-test monthly payments at today's real carrying cost, not the rate path you hope arrives later.</li>
  <li><strong>Sellers:</strong> In Ontario and BC especially, assume your buyer pool remains payment-sensitive and financing-sensitive.</li>
  <li><strong>Investors:</strong> Focus on liquidity and holding power. A cheap entry point is not enough if your financing stack is exposed to renewal or vacancy risk.</li>
  <li><strong>Mortgage renewers:</strong> Compare terms early. Shorter fixed terms and variable rates may offer flexibility, but they also reduce future certainty.</li>
  <li><strong>Realtors:</strong> Watch credit stress and insolvency trends as leading context for listing motivation, not just as background macro data.</li>
</ul>

<h2>FAQ: Equifax Consumer Credit Trends Q1 2026</h2>
<p><strong>Is consumer debt falling in Canada?</strong><br />Not overall. Equifax says total consumer debt still rose to about $2.66 trillion in Q1 2026, although non-mortgage debt dipped modestly in the quarter.</p>
<p><strong>Are mortgage delinquencies rising in Canada?</strong><br />Yes, year over year. Equifax reported the 90+ day mortgage delinquency rate at 0.28% in Q1 2026 versus 0.21% in Q1 2025, with the increase concentrated in Ontario and BC.</p>
<p><strong>Why do insolvencies matter for real estate?</strong><br />Because they show where financial stress is becoming severe enough to force formal restructuring. Higher homeowner insolvency volumes and balances can translate into more motivated sales and weaker refinancing flexibility.</p>
<p><strong>What is the biggest takeaway for Ontario and BC housing?</strong><br />Equifax's data suggest mortgage holders in those provinces are carrying the heaviest payment pressure, and that stress is visible not only in mortgage delinquency but also in credit-card delinquency growth.</p>

<h2>Bottom line</h2>
<p>The Equifax Consumer Credit Trends Q1 2026 report does not say Canadian households have lost control across the board. It says households are trying to manage through a difficult environment, but higher-cost housing markets are still showing real strain.</p>
<p>For Canadian real estate, the clearest read-through is that Ontario and BC remain the most sensitive stress zones for mortgage renewals, delinquency growth, and spillover into consumer credit. That is where investors, lenders, buyers, and agents should expect the most selective pressure to appear first.</p>
`;

const excerpt =
  "Equifax Consumer Credit Trends Q1 2026 shows Canadian households pulling back on non-mortgage debt, but insolvencies, mortgage delinquencies, and credit-card stress remain elevated, especially for mortgage holders in Ontario and British Columbia.";

const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;

async function main() {
  await db
    .insert(blogPosts)
    .values({
      title: "Equifax Consumer Credit Trends Q1 2026: Ontario and BC Mortgage Holders Are Driving Credit Stress",
      slug,
      excerpt,
      content,
      coverImage: "/reports/equifax-consumer-credit-trends-q1-2026/chart-5-mortgage-delinquency-21.png",
      authorName: "Realist Research",
      category: "market-analysis",
      tags: [
        "Equifax Canada",
        "Consumer Credit Trends",
        "Mortgage Delinquency Canada",
        "Mortgage Renewals",
        "Ontario Housing Market",
        "BC Housing Market",
        "Credit Card Delinquency",
        "Consumer Insolvency",
        "Canadian Housing Market",
      ],
      status: "published",
      metaTitle: "Equifax Consumer Credit Trends Q1 2026: Mortgage Delinquencies, Insolvencies, Ontario and BC Stress",
      metaDescription:
        "Realist analysis of Equifax Consumer Credit Trends Q1 2026, covering mortgage delinquencies, insolvencies, mortgage renewals, and why Ontario and BC mortgage holders are under the most pressure.",
      readTimeMinutes: Math.max(6, Math.ceil(wordCount / 200)),
      publishedAt,
    })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        title: "Equifax Consumer Credit Trends Q1 2026: Ontario and BC Mortgage Holders Are Driving Credit Stress",
        excerpt,
        content,
        coverImage: "/reports/equifax-consumer-credit-trends-q1-2026/chart-5-mortgage-delinquency-21.png",
        authorName: "Realist Research",
        category: "market-analysis",
        tags: [
          "Equifax Canada",
          "Consumer Credit Trends",
          "Mortgage Delinquency Canada",
          "Mortgage Renewals",
          "Ontario Housing Market",
          "BC Housing Market",
          "Credit Card Delinquency",
          "Consumer Insolvency",
          "Canadian Housing Market",
        ],
        status: "published",
        metaTitle: "Equifax Consumer Credit Trends Q1 2026: Mortgage Delinquencies, Insolvencies, Ontario and BC Stress",
        metaDescription:
          "Realist analysis of Equifax Consumer Credit Trends Q1 2026, covering mortgage delinquencies, insolvencies, mortgage renewals, and why Ontario and BC mortgage holders are under the most pressure.",
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
