import { blogPosts } from "@shared/schema";
import { db, pool } from "../db";

const slug = "cmhc-2025-annual-report-housing-market";
const sourceUrl =
  "https://assets.cmhc-schl.gc.ca/sites/cmhc/about-cmhc/corporate-reporting/annual-report/2025/cmhc-annual-report-2025-en.pdf";
const publishedAt = new Date("2026-04-17T00:00:00.000Z");

const content = `
<p><strong>Source:</strong> Adapted from Canada Mortgage and Housing Corporation, <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">CMHC 2025 Annual Report</a>.</p>

<h2>Executive summary</h2>
<p>CMHC's 2025 annual report reads like a market report for Canadian housing: construction improved nationally, rental markets loosened, resale activity stayed below normal, and federal housing finance remained a central part of the supply stack.</p>
<p>The headline is not that Canada solved its housing shortage. It is that 2025 produced a split market. Quebec and Alberta showed more strength, Ontario and British Columbia were softer, purpose-built rental continued to take share from condominium high-rises, and CMHC-backed financing remained a major driver of multi-unit delivery.</p>
<p>For investors, developers, and housing professionals, the report points to three practical themes: supply is still policy- and financing-constrained, rental feasibility is being reset by softer rent growth and higher costs, and CMHC's market-housing role is becoming more important as Build Canada Homes takes on more affordable-housing delivery.</p>

<h2>Market backdrop</h2>
<p>Canada's economy grew 1.7% in 2025, below the 2.0% pace in 2024 and close to the 10-year average of 1.9%. CMHC describes an environment shaped by trade disruptions, weaker consumer confidence, softer business investment, high household debt, slowing population growth, low productivity growth, and a stalled housing market.</p>
<p>Inflation averaged 2.1%, inside the Bank of Canada's target range. The Bank of Canada cut its policy rate by 100 basis points during the year, ending 2025 at 2.25%. That helped activity at the margin, but CMHC notes that credit conditions remained tight because lenders and borrowers were still dealing with risk premiums and uncertainty.</p>

<h2>Key housing indicators from CMHC</h2>
<table>
  <thead>
    <tr>
      <th>Indicator</th>
      <th>2025 result</th>
      <th>Market read</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Housing starts</td>
      <td>259,000 units</td>
      <td>Up 6% from 2024, but still below the 2021 peak near 270,000 units.</td>
    </tr>
    <tr>
      <td>National home sales</td>
      <td>470,000 units</td>
      <td>Down 2% from 2024 and below the 10-year average of about 510,000 units.</td>
    </tr>
    <tr>
      <td>Average MLS price</td>
      <td>$680,000</td>
      <td>Down 1% from 2024 and below the 2022 peak of roughly $710,000.</td>
    </tr>
    <tr>
      <td>Rental vacancy</td>
      <td>3.1%</td>
      <td>Up from 2.2% in 2024, continuing the rental easing that began the prior year.</td>
    </tr>
    <tr>
      <td>Rent growth</td>
      <td>5.1%</td>
      <td>Still elevated, but slower than 5.4% in 2024.</td>
    </tr>
    <tr>
      <td>Missing middle starts</td>
      <td>Up 10%</td>
      <td>Growth occurred across Canada's seven largest CMAs.</td>
    </tr>
  </tbody>
</table>

<h2>Supply improved, but not enough</h2>
<p>Housing starts increased to 259,000 units in 2025, but the mix matters more than the total. CMHC says starts shifted away from condominium high-rises and toward record purpose-built rental levels, while ground-oriented construction grew only modestly.</p>
<p>That shift is important for underwriting. Condo-led cycles rely heavily on purchaser deposits, investor demand, and pre-sale absorption. Purpose-built rental cycles rely more on long-term debt, operating income, construction cost control, and public or CMHC-supported financing. A market that moves from condo to rental changes who can build, what capital is required, and where risk sits.</p>
<p>The rise in missing middle starts is also worth tracking. A 10% increase across the seven largest CMAs suggests local zoning reform and gentle-density policy are beginning to show up in the data. The absolute scale is still not enough to close the national gap, but the direction matters for infill investors looking at fourplexes, sixplexes, laneway housing, and small apartment formats.</p>

<h2>Rental markets cooled from extreme conditions</h2>
<p>Rental vacancy rose to 3.1% from 2.2%, while rent growth slowed to 5.1%. That is not a weak rental market in historical terms, but it is a clear move away from the most acute scarcity conditions.</p>
<p>For landlords, this means rent growth assumptions should be more conservative than they were during the tightest post-pandemic period. For developers, softer rental markets combine with high construction costs and financing constraints to make feasibility more sensitive. CMHC explicitly links smaller multi-unit project sizes to a market adjusting to softer rents, higher construction costs, and municipal zoning changes aimed at missing middle housing.</p>

<h2>CMHC financing remained central to rental construction</h2>
<p>CMHC's annual report makes clear that federal housing finance was a major part of Canada's rental construction system in 2025. Through multi-unit mortgage loan insurance and the Apartment Construction Loan Program, CMHC says it supported most of the rental construction in Canada during the year.</p>
<p>Commercial products facilitated 361,470 units in 2025, below the 395,600 target but still a large flow of market-facing support. CMHC also insured more than 260,000 rental units, including close to 36% for new construction. MLI Select accounted for more than 154,000 insured rental units, advancing affordability and climate-compatibility commitments through the insurance channel.</p>
<p>Multi-unit residential insurance-in-force rose to $257 billion from $213 billion in 2024. That is a meaningful increase in CMHC exposure and explains why capital, pricing, and risk-management changes around multi-unit insurance are a recurring theme in the report.</p>

<h2>Mortgage insurance signals</h2>
<p>Homeowner mortgage insurance volumes increased in 2025. CMHC facilitated the purchase of more than 64,000 housing units across Canada, up from about 49,000 in 2024, with more than 14% insured in rural areas. CMHC attributes the increase partly to product and policy changes, including expanded 30-year amortization eligibility and a higher insured purchase price limit.</p>
<p>Arrears remained low. CMHC reported an overall arrears rate of 0.32%, with transactional homeowner at 0.41%, portfolio at 0.18%, and multi-unit residential at 0.33%. Claims paid were also low, falling to $34 million from $45 million in 2024. CMHC links the low claims environment to home price appreciation that left many properties with enough equity to sell above the outstanding loan balance.</p>

<h2>Government housing programs</h2>
<p>Through federal National Housing Strategy supply programs, CMHC reported $49.45 billion committed for the creation, repair, or acquisition of 348,240 housing units as of December 31, 2025.</p>
<table>
  <thead>
    <tr>
      <th>Program area</th>
      <th>Commitment reported by CMHC</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Apartment Construction Loan Program</td>
      <td>$29.45 billion committed to support 74,636 new purpose-built rental units.</td>
    </tr>
    <tr>
      <td>Affordable Housing Fund</td>
      <td>$14.44 billion committed to support 56,901 new affordable units and repairs to 174,777 community housing units.</td>
    </tr>
    <tr>
      <td>Co-op Housing Development Program</td>
      <td>$1.21 billion committed to support 2,787 new co-op units after the first intake window.</td>
    </tr>
    <tr>
      <td>Housing Accelerator Fund</td>
      <td>241 agreements worth $4.4 billion with local governments.</td>
    </tr>
    <tr>
      <td>Canada Greener Homes Loan</td>
      <td>More than $3.1 billion committed for nearly 131,000 loans.</td>
    </tr>
  </tbody>
</table>
<p>Budget 2025 also changed the program landscape. CMHC says some programs are being wound down, the Canada Secondary Suite Loan program will not be implemented, and Build Canada Homes will take the lead on more affordable-housing creation. CMHC's forward role is expected to focus more on market housing, finance, data, and commercial products.</p>

<h2>Research and data pipeline</h2>
<p>CMHC continued to expand its housing intelligence role in 2025. It published flagship reports including the Housing Market Outlook, Housing Supply Report, Rental Market Report, and Residential Mortgage Industry Report. It also released the third Housing Supply Gaps report, advanced new datasets on construction timelines and development charges, and launched the full Housing Design Catalogue with 50 standardized designs for rowhouses, fourplexes, sixplexes, and accessory dwelling units.</p>
<p>For market participants, this matters because the housing data stack is improving. More frequent rental data, better construction timing data, pending-starts reporting, accessory-unit starts, and standardized designs all make it easier to evaluate supply response, municipal bottlenecks, and gentle-density feasibility.</p>

<h2>Investor implications</h2>
<p><strong>1. Rental underwriting needs a 2025 reset.</strong> Vacancy is higher and rent growth is slower. Strong operators can still find durable demand, but pro formas should not assume the same scarcity-driven rent acceleration that dominated earlier years.</p>
<p><strong>2. CMHC-backed financing remains a core feasibility variable.</strong> Multi-unit insurance, MLI Select, and ACLP support are not side details. In many purpose-built rental deals, they can determine whether a project clears debt-service and yield thresholds.</p>
<p><strong>3. Missing middle is moving from policy theme to market segment.</strong> The 10% growth in missing middle starts across major CMAs is small relative to the national shortage, but it is a signal that infill formats deserve dedicated tracking.</p>
<p><strong>4. Regional divergence matters.</strong> CMHC flags weaker activity in Ontario and British Columbia and stronger conditions in Alberta and Quebec. National averages can hide very different acquisition, rent, absorption, and exit conditions.</p>
<p><strong>5. Program transitions create execution risk.</strong> As some federal programs wind down and Build Canada Homes takes on more affordable-housing work, developers should monitor intake windows, eligibility criteria, and approval timing before assuming public capital is available.</p>

<h2>Bottom line</h2>
<p>CMHC's 2025 annual report shows a Canadian housing market that is building more, but still not enough; renting with more slack, but still under affordability pressure; and relying heavily on public finance tools to move multi-unit projects forward.</p>
<p>The practical takeaway is straightforward: in 2026, housing-market analysis should be built around financing access, construction feasibility, local supply response, and regional divergence. The market is no longer only a demand story. It is increasingly a delivery story.</p>
`;

const excerpt =
  "CMHC's 2025 annual report shows Canadian housing starts rising to 259,000 units, rental vacancy easing to 3.1%, and federal financing remaining central to multi-unit supply.";

const tags = [
  "CMHC",
  "Annual Report",
  "Canadian Housing Market",
  "Rental Housing",
  "Housing Starts",
  "Mortgage Insurance",
  "Housing Supply",
];

const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;

async function main() {
  await db
    .insert(blogPosts)
    .values({
      title: "CMHC 2025 Annual Report: What It Says About Canada's Housing Market",
      slug,
      excerpt,
      content,
      authorName: "Realist Research",
      category: "market-analysis",
      tags,
      status: "published",
      metaTitle: "CMHC 2025 Annual Report: Canadian Housing Market Signals",
      metaDescription:
        "Market report on CMHC's 2025 Annual Report, covering Canadian housing starts, rental vacancy, mortgage insurance, multi-unit financing, and supply programs.",
      readTimeMinutes: Math.max(5, Math.ceil(wordCount / 200)),
      publishedAt,
    })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        title: "CMHC 2025 Annual Report: What It Says About Canada's Housing Market",
        excerpt,
        content,
        authorName: "Realist Research",
        category: "market-analysis",
        tags,
        status: "published",
        metaTitle: "CMHC 2025 Annual Report: Canadian Housing Market Signals",
        metaDescription:
          "Market report on CMHC's 2025 Annual Report, covering Canadian housing starts, rental vacancy, mortgage insurance, multi-unit financing, and supply programs.",
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
