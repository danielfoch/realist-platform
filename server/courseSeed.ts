import { db } from "./db";
import { courseModules, courseLessons } from "@shared/schema";
import { count } from "drizzle-orm";

const MODULES = [
  {
    title: "Getting Started",
    description: "Introduction to the Multiplex Masterclass and the opportunity in Canadian real estate.",
    lessons: [
      { title: "Introduction", description: "Welcome to the Multiplex Masterclass, where instructors Nick Hill and Jayden Haywood guide you through the comprehensive journey of multiplex development. In this episode, we introduce the major topics covered in the series, including missing middle housing, property acquisition, design and regulatory frameworks, financing options, energy efficiency, financial analysis, construction management, and legal considerations.", videoDuration: "2:06" },
      { title: "Setting the Stage", description: "Understanding the current Canadian real estate landscape and why multiplexes represent a unique opportunity for investors.", videoDuration: null },
      { title: "The Missing Middle", description: "What is missing middle housing, why it matters for Canada's housing crisis, and how you can capitalize on the demand.", videoDuration: null },
      { title: "Why Multiplexes Work", description: "The financial and strategic case for multiplex development over other real estate investment strategies.", videoDuration: null },
    ],
  },
  {
    title: "Site Selection & Acquisition",
    description: "How to find, evaluate, and acquire the right lot for your multiplex project.",
    lessons: [
      { title: "Site Selection", description: "Key factors to consider when selecting a site for multiplex development, including location, demand, and growth potential.", videoDuration: null },
      { title: "Physical Lot Criteria", description: "Lot dimensions, setbacks, FSI calculations, and the physical requirements for a successful multiplex build.", videoDuration: null },
      { title: "Initial Planning", description: "First steps after identifying a potential site — feasibility checks, preliminary budgets, and professional consultations.", videoDuration: null },
      { title: "Acquisition Process", description: "From offer to closing — navigating the purchase of land or existing structures for multiplex conversion.", videoDuration: null },
    ],
  },
  {
    title: "Zoning & Regulations",
    description: "Navigate zoning bylaws, building codes, permits, and development charges across Canadian municipalities.",
    lessons: [
      { title: "Zoning Bylaws", description: "Understanding municipal zoning bylaws and how they affect what you can build on your lot.", videoDuration: null },
      { title: "Garden Suites", description: "Exploring garden suite regulations and opportunities as part of multiplex development strategies.", videoDuration: null },
      { title: "Zoning & Upzoning", description: "How upzoning works, where it's happening, and how to leverage zoning changes for your project.", videoDuration: null },
      { title: "Committee of Adjustment", description: "When and how to apply for minor variances and the Committee of Adjustment process.", videoDuration: null },
      { title: "Part 9 vs Part 11 of the Building Code", description: "Understanding the key differences between Part 9 and Part 11 of the Ontario Building Code and which applies to your project.", videoDuration: null },
      { title: "Fire Code", description: "Fire code requirements for multiplex buildings — separation, exits, alarms, and compliance.", videoDuration: null },
      { title: "Site Plan Considerations", description: "Site plan approval process, requirements, and how to prepare a successful submission.", videoDuration: null },
      { title: "Development Charges & Exemptions", description: "Understanding development charges, available exemptions, and how to minimize costs.", videoDuration: null },
      { title: "Building Permits", description: "The building permit application process, required documents, timelines, and common pitfalls.", videoDuration: null },
    ],
  },
  {
    title: "Financing",
    description: "Master CMHC financing, construction loans, interest rates, and the full financing stack for multiplex projects.",
    lessons: [
      { title: "CMHC Benefits & Challenges", description: "Overview of CMHC's role in multiplex financing — the advantages and hurdles you'll encounter.", videoDuration: null },
      { title: "DSCR & Net Operating Income", description: "Understanding Debt Service Coverage Ratio and Net Operating Income — the metrics lenders care about most.", videoDuration: null },
      { title: "CMHC Application & COI", description: "Step-by-step walkthrough of the CMHC application process and Certificate of Insurance requirements.", videoDuration: null },
      { title: "Getting CMHC Financing", description: "Practical strategies for securing CMHC financing for your multiplex project.", videoDuration: null },
      { title: "Personal Net Worth (PNW) Requirements", description: "CMHC's personal net worth requirements and how to meet them.", videoDuration: null },
      { title: "Construction Financing", description: "How construction financing works — draws, holdbacks, and managing cash flow during the build.", videoDuration: null },
      { title: "Interest Rates", description: "Understanding interest rate structures, fixed vs variable, and how rates impact your project economics.", videoDuration: null },
      { title: "Interest Rates (Part 2)", description: "Advanced interest rate strategies and hedging for multiplex construction projects.", videoDuration: null },
      { title: "Financing Fees", description: "Breakdown of all financing fees — application fees, commitment fees, legal fees, and how to budget for them.", videoDuration: null },
      { title: "Commitment Letters", description: "What to expect in a commitment letter, how to negotiate terms, and red flags to watch for.", videoDuration: null },
      { title: "Insurance Requirements", description: "Insurance requirements during construction and for the completed multiplex — coverage types and costs.", videoDuration: null },
      { title: "Construction Draw Schedules", description: "How draw schedules work, inspection requirements, and managing the draw process with your lender.", videoDuration: null },
      { title: "CMHC Financing", description: "Deep dive into CMHC's MLI Select program and how to maximize your financing terms.", videoDuration: null },
    ],
  },
  {
    title: "Energy Efficiency",
    description: "MLI Select scoring, mechanical systems, and energy efficiency strategies that unlock better financing terms.",
    lessons: [
      { title: "Energy Efficiency Overview", description: "Why energy efficiency matters for multiplex development — beyond the environment, it's about better financing.", videoDuration: null },
      { title: "MLI Select & Energy Efficiency", description: "How energy efficiency scoring works under MLI Select and how to maximize your points for better loan terms.", videoDuration: null },
      { title: "Mechanical Features", description: "Mechanical systems selection — HVAC, HRV, plumbing — and their impact on energy efficiency scoring.", videoDuration: null },
      { title: "Energy Efficiency Deep Dive", description: "Advanced energy efficiency strategies, building envelope design, and achieving higher EnerGuide ratings.", videoDuration: null },
    ],
  },
  {
    title: "Financial Analysis",
    description: "Underwriting, pro forma modeling, budgeting, and financial metrics for multiplex projects.",
    lessons: [
      { title: "Planning & Budgeting", description: "Building your project budget from the ground up — accounting for every cost category.", videoDuration: null },
      { title: "Estimating Income", description: "How to estimate rental income accurately — market research, comparable analysis, and conservative projections.", videoDuration: null },
      { title: "Planning & Budgeting (Part 2)", description: "Advanced budgeting techniques and contingency planning for multiplex development.", videoDuration: null },
      { title: "OPEX (Operating Expenses)", description: "Understanding and estimating operating expenses — property management, maintenance, utilities, insurance, and taxes.", videoDuration: null },
      { title: "Financial Metrics", description: "Key financial metrics for evaluating multiplex investments — cap rate, cash-on-cash return, and more.", videoDuration: null },
      { title: "Financial Intricacies", description: "Advanced financial considerations — tax implications, depreciation, and optimizing your investment structure.", videoDuration: null },
      { title: "Internal Rate of Return", description: "Understanding and calculating IRR for multiplex projects — the metric sophisticated investors rely on.", videoDuration: null },
      { title: "Pro Forma", description: "Building a comprehensive pro forma for your multiplex project — from acquisition through stabilization.", videoDuration: null },
      { title: "Pro Forma II", description: "Advanced pro forma techniques — sensitivity analysis, multiple scenarios, and investor-ready presentations.", videoDuration: null },
      { title: "Soft & Hard Costs", description: "Complete breakdown of soft costs and hard costs in multiplex construction — what to expect and how to manage them.", videoDuration: null },
    ],
  },
  {
    title: "Construction Management",
    description: "Managing contractors, construction processes, utilities, and the physical build of your multiplex.",
    lessons: [
      { title: "Construction Management", description: "Overview of the construction management process for multiplex projects — roles, responsibilities, and timelines.", videoDuration: null },
      { title: "Construction Contracts", description: "Types of construction contracts, key terms to negotiate, and protecting yourself legally.", videoDuration: null },
      { title: "Working with a General Contractor", description: "How to find, vet, and work effectively with a general contractor on your multiplex build.", videoDuration: null },
      { title: "Hydro Capacity & Upgrades", description: "Understanding electrical capacity requirements and how to manage hydro upgrades for multiplex projects.", videoDuration: null },
      { title: "Upgrading Water Connections", description: "Water and sewer connection requirements and the upgrade process for multi-unit buildings.", videoDuration: null },
      { title: "Seamless Internet Setup & Drilling", description: "Planning telecommunications infrastructure — internet, cable, and drilling for multiplex buildings.", videoDuration: null },
      { title: "Leverage Flood Protection Rebates", description: "Available rebates and incentives for flood protection measures in your multiplex design.", videoDuration: null },
      { title: "Building Smart: Planning Wall Assemblies", description: "Wall assembly design for energy efficiency, fire separation, and sound insulation in multiplexes.", videoDuration: null },
      { title: "Construction Management Essentials", description: "Essential construction management practices — scheduling, quality control, and problem-solving on site.", videoDuration: null },
    ],
  },
  {
    title: "Bonus Content",
    description: "Additional expert sessions covering specialized topics for multiplex developers.",
    lessons: [
      { title: "HST with Rami Miransky", description: "Expert session on HST implications for multiplex developers — rebates, compliance, and tax optimization strategies.", videoDuration: null },
    ],
  },
];

export async function seedCourseContent() {
  const [existing] = await db.select({ total: count(courseModules.id) }).from(courseModules);
  if (Number(existing?.total || 0) > 0) {
    console.log(`[course-seed] ${existing.total} modules already exist, skipping seed`);
    return;
  }

  console.log("[course-seed] Seeding course content...");
  let totalLessons = 0;

  for (let mi = 0; mi < MODULES.length; mi++) {
    const mod = MODULES[mi];
    const [inserted] = await db.insert(courseModules).values({
      title: mod.title,
      description: mod.description,
      sortOrder: mi,
    }).returning();

    for (let li = 0; li < mod.lessons.length; li++) {
      const lesson = mod.lessons[li];
      await db.insert(courseLessons).values({
        moduleId: inserted.id,
        title: lesson.title,
        description: lesson.description,
        videoUrl: null,
        videoDuration: lesson.videoDuration,
        sortOrder: li,
      });
      totalLessons++;
    }
  }

  console.log(`[course-seed] Seeded ${MODULES.length} modules, ${totalLessons} lessons`);
}
