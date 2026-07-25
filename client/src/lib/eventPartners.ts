export interface EventPartner {
  slug: string;
  name: string;
  shortName: string;
  logo: string;
  website: string;
  category: string;
  tagline: string;
  description: string[];
  whyPartner: string;
  contactCta?: string;
  event: string;
  eventPath: string;
  keywords: string[];
  relatedTopics: string[];
}

export const EVENT_PARTNERS: EventPartner[] = [
  {
    slug: "cmhc",
    name: "Canada Mortgage and Housing Corporation (CMHC)",
    shortName: "CMHC",
    logo: "/partners/cmhc.png",
    website: "https://www.cmhc-schl.gc.ca",
    category: "Government Housing Agency",
    tagline: "Canada's national housing agency — making housing affordable for Canadians.",
    description: [
      "Canada Mortgage and Housing Corporation (CMHC) is Canada's national housing agency and a Crown corporation of the federal government. For more than 75 years, CMHC has helped Canadians access affordable housing through mortgage insurance, housing research, and financing programs.",
      "For real estate investors and multiplex developers, CMHC is most well-known for its MLI Select program — a purpose-built financing product designed to encourage the construction of affordable, accessible, and energy-efficient rental housing. MLI Select can significantly reduce financing costs and extend amortization periods for qualifying multiplex projects, making projects that might otherwise be unfinanceable pencil out.",
      "CMHC also publishes extensive housing market research, rental market reports, and affordability data that investors use to underwrite deals and track supply trends across Canadian cities. Their Housing Observer and market analysis teams provide some of the most authoritative data on Canadian housing supply and demand.",
      "At Unpacking Multiplexes Toronto, CMHC's Deputy Chief Economist Aled Ab Iorwerth joined the panel to discuss housing supply, missing middle policy, and the economics behind Canada's affordability challenge.",
    ],
    whyPartner: "CMHC's MLI Select program is one of the most powerful financing tools available to multiplex developers in Canada. Understanding how to qualify and structure deals under MLI Select can be the difference between a project that works and one that doesn't.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["CMHC MLI Select", "CMHC mortgage insurance", "CMHC rental housing", "Canada housing agency", "multiplex financing Canada", "affordable housing financing"],
    relatedTopics: ["MLI Select", "Multiplex Financing", "Purpose-Built Rental", "Affordable Housing Policy"],
  },
  {
    slug: "bld-financial",
    name: "BLD Financial",
    shortName: "BLD Financial",
    logo: "/partners/bld-financial.png",
    website: "https://bldfinancial.ca/",
    category: "Construction & Development Finance",
    tagline: "Specialized lenders for multiplex and purpose-built rental development in Canada.",
    description: [
      "BLD Financial is a Toronto-based construction and development finance firm specializing in multiplex and purpose-built rental projects. Founded by Nick Hill and Josh Findlay — co-hosts of The Canadian Real Estate Investor Podcast — BLD Financial brings deep deal expertise and a national lender network to developers navigating Canada's complex construction lending landscape.",
      "The firm specializes in sourcing and structuring CMHC MLI Select loans, conventional construction financing, and bridge loans for small-to-mid-scale residential development projects. Their focus on the 2–8 unit space means they understand the nuances of missing middle development that larger institutional lenders often overlook.",
      "BLD Financial works with developers at every stage of a project — from initial feasibility and lender selection through to drawdown management and takeout financing. Their relationships with CMHC-approved lenders and major Canadian banks give clients access to competitive rates on deals that require creative structuring.",
      "Nick Hill and Josh Findlay are also co-hosts of The Canadian Real Estate Investor Podcast alongside Daniel Foch, giving BLD Financial a unique platform to educate investors on development finance across Canada.",
    ],
    whyPartner: "Financing is the number one reason multiplex projects stall or fail. BLD Financial's expertise in CMHC MLI Select and construction lending for small-to-mid scale development is directly relevant to anyone serious about building multiplexes in Toronto and across Canada.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["BLD Financial", "multiplex construction financing", "CMHC MLI Select Toronto", "development finance Canada", "construction loan Toronto", "Nick Hill Josh Findlay"],
    relatedTopics: ["Construction Financing", "MLI Select", "Multiplex Development", "Purpose-Built Rental"],
  },
  {
    slug: "reside-properties",
    name: "Reside Properties",
    shortName: "Reside Properties",
    logo: "https://www.resideproperties.ca/assets/logo.svg",
    website: "https://www.resideproperties.ca/",
    category: "Real Estate Development & Investment",
    tagline: "Active multiplex developer and investor building the next generation of rental housing in the GTA.",
    description: [
      "Reside Properties is a Toronto-based real estate development and investment firm founded by Ryan Valente, a hands-on multiplex developer and investor actively building and operating multi-unit residential properties across the Greater Toronto Area.",
      "Reside Properties focuses on the full development lifecycle — from sourcing undervalued sites and navigating Toronto's zoning landscape through to construction management and long-term portfolio operations. Their projects include as-of-right multiplex conversions, infill development, and new-build purpose-built rental units in Toronto's inner suburbs.",
      "Ryan Valente and the Reside Properties team bring real-world operator experience to every project. Rather than purely theoretical development knowledge, Reside Properties has skin in the game on live projects — a perspective that is invaluable for investors trying to understand what multiplex development actually looks like on the ground.",
      "At Unpacking Multiplexes Toronto, Ryan Valente spoke on the execution side of multiplex development — covering site acquisition strategy, contractor relationships, timeline management, and the real costs that developers encounter on the path from raw land to tenanted property.",
    ],
    whyPartner: "Ryan Valente and Reside Properties represent the practitioner's perspective on multiplex development. Real-world project experience — including the hard lessons — is exactly what the Unpacking Multiplexes Toronto audience came to hear.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["Reside Properties Toronto", "Ryan Valente Toronto", "multiplex developer Toronto", "GTA infill development", "purpose built rental Toronto", "Toronto fourplex developer"],
    relatedTopics: ["Infill Development", "GTA Real Estate", "Multiplex Investment", "Site Acquisition"],
  },
  {
    slug: "noam-hazan-design-studio",
    name: "Noam Hazan Design Studio",
    shortName: "Noam Hazan Design Studio",
    logo: "/partners/noam-hazan-design-studio.png",
    website: "https://www.noamhazan.com/",
    category: "Architecture & Design",
    tagline: "Award-winning Toronto architects specializing in multiplex, infill, and cost-effective residential design.",
    description: [
      "Noam Hazan Design Studio is a Toronto-based architecture practice led by Principal Architect Noam Hazan, with deep expertise in multiplex design, infill residential development, and cost-effective construction detailing for small and mid-scale housing projects.",
      "The studio has built a reputation for designing multiplexes and infill homes that are both architecturally considered and buildable within realistic construction budgets — a balance that is critical for investors and developers who need projects to pencil out. Their work spans as-of-right fourplexes, garden suites, laneway houses, and multi-unit additions across Toronto's diverse residential neighbourhoods.",
      "Noam Hazan Design Studio is intimately familiar with Toronto's zoning bylaws, Ontario Building Code requirements, and the practical constraints of building on infill sites — narrow lots, heritage overlays, angular plane restrictions, and parkland dedication requirements. This regulatory fluency translates directly into faster approvals and fewer costly redesigns for developer clients.",
      "At Unpacking Multiplexes Toronto, Noam Hazan spoke on the architecture and design side of multiplex development — covering design strategies that maximize unit yield, cost-efficient construction detailing, and how to work with the city's planning process to get projects approved efficiently.",
    ],
    whyPartner: "Good design is not just aesthetics — it directly affects construction cost, unit count, rental premiums, and approval timelines. Noam Hazan Design Studio's expertise in buildable, cost-effective multiplex architecture is essential knowledge for anyone developing in Toronto.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["Noam Hazan Design Studio", "Toronto multiplex architect", "infill architecture Toronto", "fourplex design Toronto", "laneway house architect Toronto", "multiplex building design"],
    relatedTopics: ["Multiplex Architecture", "Infill Design", "Toronto Zoning", "Construction Costs"],
  },
  {
    slug: "alliance-reit",
    name: "Alliance REIT",
    shortName: "Alliance REIT",
    logo: "/partners/alliance-reit.jpg",
    website: "https://www.alliancereit.com/",
    category: "Real Estate Investment Trust",
    tagline: "Boutique multifamily REIT building premium rental residences in the Toronto core.",
    description: [
      "Alliance REIT is a Toronto-based private real estate investment trust focused on developing and operating premium boutique multifamily residential properties in the Toronto core. Founded by Hooman Tabesh, Alliance REIT brings over 20 years of experience developing and managing residential rental real estate in one of North America's most competitive urban markets.",
      "Alliance REIT's portfolio focuses on high-quality, design-forward rental residences in Toronto's most desirable neighbourhoods. Their approach combines institutional-grade asset management with a boutique operator's attention to tenant experience — a model that has produced strong occupancy rates and rental premiums relative to competing stock.",
      "Hooman Tabesh and the Alliance REIT team have navigated every phase of Toronto's real estate cycle, giving them hard-won insight into market timing, financing strategy, construction risk, and long-term portfolio optimization that is directly applicable to investors building their own multiplex portfolios.",
      "At Unpacking Multiplexes Toronto, Hooman Tabesh joined the panel to share his perspective on scaling from single-asset development into portfolio operations — how to think about holding versus selling, how to structure investor capital, and what separates successful long-term operators from one-time developers.",
    ],
    whyPartner: "Alliance REIT's track record of developing and operating premium rental housing in the Toronto core offers a master class in what successful long-term multifamily investment looks like in Canada's most competitive market.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["Alliance REIT Toronto", "Hooman Tabesh", "Toronto multifamily REIT", "boutique rental Toronto", "Toronto rental investment", "private REIT Canada"],
    relatedTopics: ["Multifamily Investment", "REIT Structure", "Toronto Rental Market", "Portfolio Operations"],
  },
  {
    slug: "sr-law",
    name: "SR Law",
    shortName: "SR Law",
    logo: "/partners/sr-law-2025.png",
    website: "https://www.srlaw.ca/",
    category: "Real Estate Law",
    tagline: "Commercial real estate lawyers serving investors, developers, and builders across Ontario.",
    description: [
      "SR Law is a Toronto-based commercial real estate law firm with deep experience serving real estate investors, developers, and builders across Ontario. The firm handles acquisitions, dispositions, construction financing, title matters, and development agreements for clients ranging from individual investors to institutional developers.",
      "Ben Singer, a partner at SR Law, brings over eight years of transactional real estate experience to investor clients navigating complex multiplex acquisitions and new development projects. SR Law's practice covers the full spectrum of real estate transactions — from simple resale closings to complex condominium and subdivision development matters that require coordination across planning, financing, and regulatory approvals.",
      "For multiplex investors and developers, having experienced real estate counsel is not optional — title defects, restrictive covenants, easements, and development agreement obligations can derail projects that look clean on the surface. SR Law's due diligence process is designed to identify and resolve these issues before they become deal-breaking problems.",
      "At Unpacking Multiplexes Toronto, Ben Singer joined the panel to discuss the legal considerations specific to multiplex development — from purchase agreement clauses that protect developer interests, to financing conditions, title insurance, and the documentation required for CMHC-approved construction loans.",
    ],
    whyPartner: "Real estate transactions for multiplex development are legally complex. SR Law's combination of transactional expertise and development experience means investors can rely on their counsel to protect deals from the offer stage through to title transfer.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["SR Law Toronto", "Ben Singer real estate lawyer", "Toronto real estate lawyer", "commercial real estate law Ontario", "development law Toronto", "multiplex purchase lawyer"],
    relatedTopics: ["Real Estate Law", "Property Acquisition", "Development Agreements", "Title Insurance"],
  },
  {
    slug: "landlord",
    name: "LandLord",
    shortName: "LandLord",
    logo: "/partners/landlord-2025.png",
    website: "https://www.landlord.ca/",
    category: "Property Management & Investment Advisory",
    tagline: "Helping Toronto investors acquire, operate, and optimize income properties.",
    description: [
      "LandLord is a Toronto-based property management and real estate investment advisory firm helping investors acquire, operate, and maximize the performance of income-producing properties across the Greater Toronto Area. Led by investment advisor Brandon Sage, LandLord works with landlords at every stage of their journey — from first-time rental property owners to seasoned multi-unit operators.",
      "LandLord's advisory services cover deal sourcing, property analysis, financing strategy, tenant placement, and ongoing property management — giving investors a full-service solution that removes the friction from building and managing a residential rental portfolio. Their market knowledge spans Toronto's diverse rental sub-markets, including the inner suburbs where multiplex development opportunity is most concentrated.",
      "Brandon Sage and the LandLord team understand what separates properties that generate real cash flow from those that merely break even. Their underwriting discipline and deep knowledge of Toronto's rental market — vacancy trends, achievable rents by unit type and location, and operating cost benchmarks — gives investor clients the data they need to make confident acquisition decisions.",
      "At Unpacking Multiplexes Toronto, Brandon Sage joined the panel to discuss the landlord and property management side of multiplex investment — how to position units to attract high-quality tenants, how to structure operations for a multi-unit property, and what investors should budget for ongoing maintenance and professional management.",
    ],
    whyPartner: "Buying a multiplex is only the beginning. LandLord's expertise in property management and income optimization helps investors understand what it actually takes to operate a rental portfolio successfully — and how to maximize returns over the long term.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["LandLord Toronto", "Brandon Sage", "Toronto property management", "income property Toronto", "rental property management GTA", "landlord services Toronto"],
    relatedTopics: ["Property Management", "Rental Income Optimization", "Toronto Landlord", "Multi-Unit Operations"],
  },
  {
    slug: "valery",
    name: "Valery",
    shortName: "Valery",
    logo: "/partners/valery.png",
    website: "https://www.valery.ca/",
    category: "Real Estate Technology",
    tagline: "The smarter way to buy and sell real estate in Canada.",
    description: [
      "Valery is a Canadian real estate technology platform redefining how buyers, sellers, and investors transact property. Built for a market that demands speed, transparency, and data-driven decision-making, Valery brings together modern technology and real estate expertise to simplify every stage of a property transaction.",
      "The Valery platform streamlines the process of buying and selling real estate by combining intuitive digital tools with access to qualified real estate professionals — removing the friction that has historically made Canadian real estate transactions opaque and slow. Their approach puts more control in the hands of consumers while preserving the professional guidance that complex transactions require.",
      "For real estate investors, Valery's technology provides a faster path to actionable market data, comparable sales, and transaction management tools — capabilities that are particularly valuable for multiplex investors and developers who need to move quickly on acquisition opportunities and manage multiple transactions simultaneously.",
      "At Unpacking Multiplexes Toronto, Valery joined as a technology partner supporting the event's mission to equip the next generation of multiplex investors with the tools, data, and professional networks they need to execute confidently in the GTA market.",
    ],
    whyPartner: "Real estate technology is reshaping how investors discover, analyze, and transact on properties. Valery's platform represents the kind of modern tooling that gives today's active investors a meaningful edge in a competitive market.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["Valery real estate", "valery.ca", "Canadian real estate technology", "PropTech Canada", "buy sell real estate Canada", "real estate platform Toronto"],
    relatedTopics: ["PropTech", "Real Estate Transactions", "Property Technology", "Market Data"],
  },
  {
    slug: "platform-insurance",
    name: "Platform Insurance",
    shortName: "Platform Insurance",
    logo: "https://www.platforminsurance.com/wp-content/uploads/2024/02/Platform-Logo-RGB-Digital-Glacier.png",
    website: "https://www.platforminsurance.com/",
    category: "Real Estate Insurance",
    tagline: "Specialized insurance solutions for real estate investors, developers, and construction projects.",
    description: [
      "Platform Insurance is a Canadian insurance brokerage specializing in coverage solutions for real estate investors, property developers, and construction projects. Their team understands the specific risks that come with income property ownership and residential development — from vacant property exposure during construction to liability coverage for multi-unit rental buildings.",
      "Real estate investors often underestimate insurance as a line item and as a risk management tool. The right coverage protects against catastrophic losses — fire, flood, liability claims — while also providing construction all-risk protection during the development phase, when assets are most exposed and financing requirements are most demanding.",
      "Platform Insurance works with investors owning single properties through to developers managing active construction projects, providing tailored coverage solutions that match the risk profile of each stage of the real estate investment lifecycle. Their expertise includes rental income replacement coverage, builder's risk policies, commercial general liability, and umbrella policies for portfolio-level protection.",
      "At Unpacking Multiplexes Toronto, Brendan Farrow joined the panel to discuss insurance considerations for multiplex investors — what coverage is required by lenders, what investors commonly miss, and how to structure insurance cost-effectively across a growing rental portfolio.",
    ],
    whyPartner: "Insurance is a non-negotiable cost of real estate investment — but most investors don't think strategically about coverage until something goes wrong. Platform Insurance's expertise in real estate and development risk helps multiplex investors protect their assets at every stage.",
    event: "Unpacking Multiplexes Toronto",
    eventPath: "/community/events/unpacking-multiplexes-toronto",
    keywords: ["Platform Insurance Canada", "real estate investor insurance", "rental property insurance Toronto", "construction insurance Canada", "multiplex insurance Ontario", "builder's risk insurance Canada"],
    relatedTopics: ["Property Insurance", "Construction Risk", "Builder's Risk", "Landlord Insurance"],
  },
];

export function getEventPartner(slug: string): EventPartner | undefined {
  return EVENT_PARTNERS.find((p) => p.slug === slug);
}

export const TORONTO_EVENT_PARTNER_SLUGS = EVENT_PARTNERS.map((p) => p.slug);
