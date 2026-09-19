"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AccountLinkLabel, accountLink } from "@/components/auth/AccountLinkLabel";
import { useViewer } from "@/components/auth/useViewer";
import MultiplexScene from "./MultiplexScene";
import KnowledgeScene from "./KnowledgeScene";
import OperatingScene from "./OperatingScene";
import "./scrollcraft.css";

export type LandingCta = (name: string, href: string, location: string) => void;
type Props = { onCta?: LandingCta };
const clamp = (n: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, n));
const STEP_VH = 0.37;
const STILL_FRAMES = [0, 1.55, 2.62, 3.65, 4.3, 5.5, 6.5, 7.5, 8.8, 9.4, 10.5];
// The offer holds the concept in place before finance and construction continue.
const projectProgress = (progress: number) =>
  progress < 6 ? Math.max(2, progress - 2) : progress < 7 ? 3.5 : progress - 3;

export const CHAPTERS = [
  {
    name: "Learn",
    label: "A little curiosity goes a long way.",
    title: (
      <>
        Build your knowledge.
        <br />
        <em>Before your building.</em>
      </>
    ),
    description:
      "Learn for free with Canada’s #1 real estate podcast. Join Daniel Foch and Nick Hill for 400+ episodes of The Canadian Real Estate Investor—real conversations about deals, financing, and building wealth.",
    tags: ["Canada’s #1 real estate podcast", "400+ free episodes"],
    cta: "Start listening",
    href: "/podcast",
    note: "The Canadian Real Estate Investor · Daniel Foch & Nick Hill",
  },
  {
    name: "Education",
    label: "100+ hours. Zero tuition.",
    title: (
      <>
        Your multiplex education.
        <br />
        <em>On the house.</em>
      </>
    ),
    description:
      "Go deeper with 100+ hours of free multiplex education. Learn how to assess a site, plan a project, understand financing, and build with more confidence—one episode at a time.",
    tags: ["100+ hours of free education", "Multiplex fundamentals"],
    cta: "Explore free multiplex education",
    href: "/podcast",
    note: "Learn the fundamentals. Put AI to work with confidence.",
  },
  {
    name: "Connect",
    label: "Good people make great projects.",
    title: (
      <>
        Compound more
        <br />
        than <em>knowledge.</em>
      </>
    ),
    description:
      "Meet the investors, partners, and professionals who turn ideas into action. Share what you know, build your network, and find your next capital partner.",
    tags: ["Investor meetups", "Live events", "Co-investing"],
    cta: "Find your people",
    href: "/community",
    note: "A conversation can change the whole project.",
  },
  {
    name: "Analyze",
    label: "Fast calculations. AI insights. Your next move.",
    title: (
      <>
        Find your next investment.
        <br />
        <em>Analyze it with AI.</em>
      </>
    ),
    description:
      "Find promising properties and compare cash flow and cap rates. Take a Toronto site into the AI Multiplex Underwriter to understand the scenarios, risks, and questions behind your next move.",
    tags: [
      "150,000+ Canadian properties",
      "AI deal insights",
      "Ranked opportunities",
    ],
    cta: "Find your next investment",
    href: "/listings",
    note: "Modeled estimates. Your assumptions, your due diligence.",
  },
  {
    name: "Find",
    label: "See what others scroll past.",
    title: (
      <>
        Find the lot.
        <br />
        <em>See the possibility.</em>
      </>
    ),
    description:
      "Explore 150,000+ properties across Canada. Go beyond the listing to screen lot dimensions, location, and the potential for something more.",
    tags: ["National property search", "Lot screening", "Saved deals"],
    cta: "Explore properties",
    href: "/listings",
    note: "Canada-wide discovery. Local due diligence.",
  },
  {
    name: "Design",
    label: "Turn a parcel into a possibility.",
    title: (
      <>
        A blank lot.
        <br />
        <em>A better blueprint.</em>
      </>
    ),
    description:
      "Explore what a Toronto lot could become with the AI Multiplex Underwriter. Screen zoning, compare unit configurations, and surface site risks before bringing the concept to your architect.",
    tags: ["AI multiplex underwriter", "Lot & zoning checks", "Unit scenarios"],
    cta: "Explore a multiplex concept",
    href: "/multiplex",
    note: "AI-assisted feasibility. Your architect takes it from here.",
  },
  {
    name: "Offer",
    label: "The next move is yours.",
    title: (
      <>
        Make your move.
        <br />
        <em>Keep more capital.</em>
      </>
    ),
    description:
      "Found the right site? Make an offer with investor-focused representation, then explore cashback on eligible purchases. Keep more capital for the project you’re about to build.",
    tags: ["Offer strategy", "Negotiation support", "Eligible buyer cashback"],
    cta: "Make an offer",
    href: "/work-with-us",
    note: "Cashback through partner brokerages. Eligibility and agreement terms apply.",
  },
  {
    name: "Finance",
    label: "Make the vision work on paper.",
    title: (
      <>
        Good design.
        <br />
        <em>Better numbers.</em>
      </>
    ),
    description:
      "Bring land, costs, and rents into one pro forma. Use AI to explain the tradeoffs, compare financing scenarios, and prepare better questions for your mortgage professional.",
    tags: ["Development budget", "AI-assisted insights", "Financing scenarios"],
    cta: "Run your numbers",
    href: "/multiplex",
    note: "Model first. Validate with your financing team.",
  },
  {
    name: "Build",
    label: "From linework to real life.",
    title: (
      <>
        Less imagining.
        <br />
        <em>More ground-breaking.</em>
      </>
    ),
    description:
      "Bring your AI-assisted analysis to the people who can build it. Connect with a project team and move from diligence and drawings toward foundations, framing, and finishing touches.",
    tags: [
      "Architects & planners",
      "Building professionals",
      "Project support",
    ],
    cta: "Build your project team",
    href: "/team?roles=contractor,architect#request",
    note: "One plan. The right people around it.",
  },
  {
    name: "Own",
    label: "The finish line is a new beginning.",
    title: (
      <>
        Fill the homes.
        <br />
        <em>Build the future.</em>
      </>
    ),
    description:
      "Turn a completed project into a rental asset. Plan lease-up and explore CMHC MLI Select scenarios for eligible projects with five or more units, with your financing team beside you.",
    tags: ["Lease-up planning", "Long-term ownership", "MLI Select scenarios"],
    cta: "Plan your next chapter",
    href: "/work-with-us",
    note: "Financing is subject to program and lender review.",
  },
  {
    name: "Operate",
    label: "A long-term asset. A team for the long run.",
    title: (
      <>
        Owned today.
        <br />
        <em>Managed for tomorrow.</em>
      </>
    ),
    description:
      "Stay with Realist beyond completion. Plan your asset’s long-term performance with property management partners, AI-assisted tenant support, maintenance, leasing, and reporting.",
    tags: ["Asset strategy", "Property management", "AI-assisted operations"],
    cta: "Build your management team",
    href: "/team?roles=property_manager#request",
    note: "Real people and specialist partners. Working alongside you.",
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Brand() {
  return (
    <span className="rl-brand">
      <svg
        width="27"
        height="30"
        viewBox="0 0 27 30"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 29V12l7-4v21H1Zm9 0V4l7-4v29h-7Zm9 0V16l7-4v17h-7Z"
          fill="currentColor"
        />
      </svg>
      <span>
        realist<span className="rl-brand-dot">.</span>
      </span>
    </span>
  );
}
function TrackedLink({
  children,
  href,
  className,
  name,
  location = "landing",
  onCta,
  tabIndex,
}: {
  children: ReactNode;
  href: string;
  className?: string;
  name: string;
  location?: string;
  onCta?: LandingCta;
  tabIndex?: number;
}) {
  return (
    <a
      href={href}
      tabIndex={tabIndex}
      className={className}
      onClick={() => onCta?.(name, href, location)}
    >
      {children}
    </a>
  );
}
function ProjectDocuments({ progress }: { progress: number }) {
  const finance =
    clamp((progress - 6.95) * 5) * (1 - clamp((progress - 7.8) * 4));
  const commitment = clamp((progress - 7.2) * 3);
  const offer =
    clamp((progress - 5.9) * 5) * (1 - clamp((progress - 6.85) * 6));
  const ownership =
    clamp((progress - 8.7) * 3.4) * (1 - clamp((progress - 9.65) / 0.4));
  return (
    <div className="rl-documents" aria-hidden="true">
      <div
        className="rl-offer-document rl-document"
        style={{
          opacity: offer,
          transform: `translate(${(1 - offer) * -75}px, ${(1 - offer) * 85}px) rotate(-6deg)`,
        }}
      >
        <div className="rl-doc-brand">
          realist. <span>YOUR NEXT MOVE</span>
        </div>
        <span className="rl-eyebrow">AGREEMENT OF PURCHASE & SALE</span>
        <h3>
          Make an offer.
          <br />
          Get cash back.
        </h3>
        <div className="rl-doc-rule" />
        <div className="rl-budget-row">
          <span>The right site</span>
          <b>Found.</b>
        </div>
        <div className="rl-budget-row">
          <span>Offer strategy</span>
          <b>Let’s make a plan.</b>
        </div>
        <div className="rl-budget-row">
          <span>Representation</span>
          <b>In your corner.</b>
        </div>
        <span className="rl-cashback-label">
          MORE CAPITAL FOR WHAT’S NEXT ↗
        </span>
        <p>Explore cashback on eligible purchases.</p>
        <span className="rl-doc-fine">
          PARTNER BROKERAGE CASHBACK · TERMS APPLY
        </span>
      </div>
      <div
        className="rl-budget rl-document"
        style={{
          opacity: finance * (1 - commitment * 0.9),
          transform: `translate(${(1 - finance) * -90}px, ${(1 - finance) * 80}px) rotate(-7deg)`,
        }}
      >
        <div className="rl-doc-brand">
          realist. <span>PROJECT 001</span>
        </div>
        <span className="rl-eyebrow">THE DEVELOPMENT BUDGET</span>
        <h3>
          Room for
          <br />
          the numbers.
        </h3>
        <div className="rl-budget-row">
          <span>Land acquisition</span>
          <b>$1,100,000</b>
        </div>
        <div className="rl-budget-row">
          <span>Construction</span>
          <b>$1,500,000</b>
        </div>
        <div className="rl-budget-row">
          <span>Other costs & reserves</span>
          <b>$400,000</b>
        </div>
        <div className="rl-budget-row total">
          <span>Total project</span>
          <b>$3,000,000</b>
        </div>
        <div className="rl-budget-bars">
          <i />
          <i />
          <i />
        </div>
        <span className="rl-doc-fine">ILLUSTRATIVE BUDGET · CAD</span>
      </div>
      <div
        className="rl-commitment rl-document"
        style={{
          opacity: finance * commitment,
          transform: `translateY(${(1 - commitment) * 80}px) rotate(5deg)`,
        }}
      >
        <div className="rl-doc-brand">
          realist. <span>FINANCING PATHWAY</span>
        </div>
        <div className="rl-paper-icon">↗</div>
        <h3>
          Mortgage
          <br />
          commitment.
        </h3>
        <p>
          From a considered pro forma
          <br />
          to a conversation with your lender.
        </p>
        <div className="rl-doc-rule" />
        <div className="rl-budget-row">
          <span>Project type</span>
          <b>6-unit multiplex</b>
        </div>
        <div className="rl-budget-row">
          <span>Next step</span>
          <b>Lender review</b>
        </div>
        <div className="rl-signature">A plan worth building.</div>
        <span className="rl-doc-fine">ILLUSTRATIVE · NOT A LOAN OFFER</span>
      </div>
      <div
        className="rl-lease rl-document"
        style={{
          opacity: ownership,
          transform: `translate(${(1 - ownership) * -110}px, ${(1 - ownership) * 100}px) rotate(-8deg)`,
        }}
      >
        <div className="rl-doc-brand">
          realist. <span>THE NEXT CHAPTER</span>
        </div>
        <span className="rl-eyebrow">RESIDENTIAL</span>
        <h3>
          Welcome
          <br />
          home.
        </h3>
        <div className="rl-doc-rule" />
        <div className="rl-budget-row">
          <span>Lease agreement</span>
          <b>Unit 01</b>
        </div>
        <div className="rl-fake-lines">
          <i />
          <i />
          <i />
        </div>
        <span className="rl-lease-stamp">A PLACE TO CALL HOME</span>
        <span className="rl-doc-fine">ILLUSTRATIVE LEASE-UP PLAN</span>
      </div>
      <div
        className="rl-refinance"
        style={{
          opacity: ownership,
          transform: `translateY(${(1 - ownership) * 90}px)`,
        }}
      >
        <span className="rl-status-dot" />
        <div>
          <b>Built for the long term.</b>
          <span>Explore CMHC MLI Select</span>
        </div>
        <Arrow diagonal />
      </div>
    </div>
  );
}

function Story({
  onCta,
  reducedMotion,
}: {
  onCta?: LandingCta;
  reducedMotion: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [still, setStill] = useState(false);
  const [shortViewport, setShortViewport] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-height: 540px)");
    const sync = () => setShortViewport(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const active = Math.min(CHAPTERS.length - 1, Math.floor(progress + 0.5));
  const visualProgress =
    reducedMotion || still
      ? STILL_FRAMES[active]
      : Math.min(progress + 0.5, CHAPTERS.length - 0.001);
  const textProgress =
    reducedMotion || still ? active : Math.min(progress, CHAPTERS.length - 1);

  useEffect(() => {
    if (shortViewport) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!root.current) return;
      const top = root.current.getBoundingClientRect().top;
      const header = window.innerWidth <= 700 ? 64 : 80;
      const sticky =
        root.current.querySelector<HTMLElement>(".rl-story-sticky");
      const chapterDistance = Math.max(
        1,
        (root.current.offsetHeight - (sticky?.offsetHeight ?? 0)) /
          CHAPTERS.length,
      );
      const next = clamp(
        (header - top) / chapterDistance,
        0,
        CHAPTERS.length - 0.001,
      );
      setProgress((previous) =>
        Math.abs(previous - next) > 0.002 ? next : previous,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [shortViewport]);

  useEffect(() => {
    const nav = root.current?.querySelector<HTMLElement>(".rl-chapter-nav");
    const selected = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && selected && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft =
        selected.offsetLeft -
        nav.offsetLeft -
        (nav.clientWidth - selected.offsetWidth) / 2;
    }
  }, [active, shortViewport]);

  function goToChapter(index: number) {
    if (!root.current) return;
    const header = window.innerWidth <= 700 ? 64 : 80;
    const sticky = root.current.querySelector<HTMLElement>(".rl-story-sticky");
    const chapterDistance = Math.max(
      1,
      (root.current.offsetHeight - (sticky?.offsetHeight ?? 0)) /
        CHAPTERS.length,
    );
    const top =
      window.scrollY +
      root.current.getBoundingClientRect().top -
      header +
      index * chapterDistance;
    window.scrollTo({
      top,
      behavior: reducedMotion || still ? "instant" : "smooth",
    });
    onCta?.(
      `chapter_${CHAPTERS[index].name.toLowerCase()}`,
      "#journey",
      "chapter_navigation",
    );
  }

  // On short screens, normal document flow gives every chapter room to breathe.
  if (shortViewport)
    return (
      <section
        id="journey"
        className="rl-static-journey"
        aria-label="The eleven-step multiplex journey"
      >
        <h1 className="rl-eyebrow rl-static-title">The multiplex journey</h1>
        {CHAPTERS.map((chapter, i) => (
          <article key={chapter.name} className="rl-static-chapter">
            <div className="rl-chapter-copy">
              <div className="rl-chapter-index">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <span>/ {CHAPTERS.length}</span>
                <i />
                <span>{chapter.name.toUpperCase()}</span>
              </div>
              <div className="rl-chapter-text">
                <h2>{chapter.title}</h2>
                <p>{chapter.description}</p>
                <ul className="rl-tags">
                  {chapter.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                <TrackedLink
                  href={chapter.href}
                  name={`journey_${chapter.name.toLowerCase()}`}
                  location="journey"
                  className="rl-text-link"
                  onCta={onCta}
                >
                  {chapter.cta}
                  <Arrow diagonal />
                </TrackedLink>
                <span className="rl-chapter-note">{chapter.note}</span>
              </div>
            </div>
            <div
              className="rl-story-visual"
              aria-label={chapter.label}
              role="img"
            >
              <div className="rl-visual-grid" />
              <div className="rl-building-scene" aria-hidden="true">
                {i < 4 ? (
                  <KnowledgeScene
                    progress={STILL_FRAMES[i]}
                    animate={!reducedMotion}
                  />
                ) : i === CHAPTERS.length - 1 ? (
                  <OperatingScene progress={1} />
                ) : (
                  <MultiplexScene progress={projectProgress(STILL_FRAMES[i])} />
                )}
              </div>
              <ProjectDocuments progress={STILL_FRAMES[i]} />
              <div className="rl-scene-caption">
                <span className="rl-cross">+</span>
                {chapter.label}
                <span className="rl-cross">+</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    );

  return (
    <section
      id="journey"
      className="rl-journey"
      data-motion={reducedMotion || still ? "reduced" : "full"}
      ref={root}
      aria-label="Eleven steps from learning to operating a multiplex"
      style={
        {
          "--chapter-vh": `${STEP_VH * CHAPTERS.length * 100}svh`,
          "--chapter-count": CHAPTERS.length,
        } as CSSProperties
      }
    >
      {CHAPTERS.map((chapter, i) => (
        <span
          key={chapter.name}
          className="rl-chapter-snap"
          aria-hidden="true"
          style={{ top: `${i * STEP_VH * 100}svh` }}
        />
      ))}
      <div className="rl-story-sticky">
        <div className="rl-story-top">
          <h1 className="rl-eyebrow">
            <span className="rl-status-dot" /> The multiplex journey
          </h1>
          {progress < 0.12 && (
            <button
              type="button"
              className="rl-entry-scroll"
              onClick={() => goToChapter(1)}
            >
              <span>Scroll to explore</span>
              <span className="rl-scroll-arrow" aria-hidden="true">
                ↓
              </span>
            </button>
          )}
          <button
            className="rl-motion-toggle"
            onClick={() => setStill(!still)}
            aria-pressed={still}
          >
            {still ? "Resume animation" : "Simplify motion"}
            <span aria-hidden="true">{still ? "▷" : "Ⅱ"}</span>
          </button>
        </div>
        <div className="rl-story-body">
          <div className="rl-chapter-copy rl-chapter-flow">
            {CHAPTERS.map((chapter, i) => (
              <div
                key={chapter.name}
                className="rl-flow-card"
                aria-hidden={i !== active}
                style={{
                  transform: `translateY(${(i - textProgress) * 100}%)`,
                  pointerEvents: i === active ? "auto" : "none",
                }}
              >
                <div className="rl-chapter-index">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>/ {CHAPTERS.length}</span>
                  <i />
                  <span>{chapter.name.toUpperCase()}</span>
                </div>
                <div className="rl-chapter-text" id={`chapter-${i + 1}`}>
                  <h2>{chapter.title}</h2>
                  <p>{chapter.description}</p>
                  <ul className="rl-tags">
                    {chapter.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <TrackedLink
                    href={chapter.href}
                    name={`journey_${chapter.name.toLowerCase()}`}
                    location="journey"
                    className="rl-text-link"
                    onCta={onCta}
                    tabIndex={i === active ? 0 : -1}
                  >
                    {chapter.cta}
                    <Arrow diagonal />
                  </TrackedLink>
                  <span className="rl-chapter-note">{chapter.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div
            className="rl-story-visual"
            aria-label={`${CHAPTERS[active].name}: ${CHAPTERS[active].label}`}
            role="img"
          >
            <div className="rl-visual-grid" />
            <div className="rl-scene-label">
              <span>REALIST / AI + HUMAN EXPERTISE</span>
              <span>FIG. {String(active + 1).padStart(2, "0")}</span>
            </div>
            <div
              className="rl-knowledge-scene"
              aria-hidden="true"
              style={{ opacity: 1 - clamp((visualProgress - 3.85) / 0.35) }}
            >
              {visualProgress < 4.2 ? (
                <KnowledgeScene
                  progress={visualProgress}
                  animate={!reducedMotion && !still}
                />
              ) : null}
            </div>
            <div
              className="rl-building-scene"
              aria-hidden="true"
              style={{
                opacity:
                  clamp((visualProgress - 3.85) / 0.35) *
                  (1 - clamp((visualProgress - 9.65) / 0.45)),
              }}
            >
              {visualProgress > 3.85 && visualProgress < 10.1 ? (
                <MultiplexScene progress={projectProgress(visualProgress)} />
              ) : null}
            </div>
            {visualProgress > 9.65 && (
              <div
                className="rl-operating-scene rl-building-scene"
                aria-hidden="true"
                style={{ opacity: clamp((visualProgress - 9.65) / 0.35) }}
              >
                <OperatingScene
                  progress={clamp((visualProgress - 9.65) / 0.85)}
                />
              </div>
            )}
            <ProjectDocuments progress={visualProgress} />
            <div className="rl-scene-caption">
              <span className="rl-cross">+</span>
              {CHAPTERS[active].label}
              <span className="rl-cross">+</span>
            </div>
          </div>
        </div>
        <nav className="rl-chapter-nav" aria-label="Jump to a journey chapter">
          {CHAPTERS.map((chapter, i) => (
            <button
              key={chapter.name}
              onClick={() => goToChapter(i)}
              aria-current={active === i ? "step" : undefined}
              aria-controls={`chapter-${i + 1}`}
              className={i <= active ? "is-reached" : ""}
            >
              <span className="rl-step-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{chapter.name}</span>
              <i style={{ transform: `scaleX(${clamp(progress - i)})` }} />
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={`rl-scroll-cue${progress < 0.12 ? " is-intro" : ""}`}
          aria-label={
            active < CHAPTERS.length - 1
              ? "Scroll to the next chapter"
              : "Explore all platform features"
          }
          onClick={() =>
            active < CHAPTERS.length - 1
              ? goToChapter(active + 1)
              : document.getElementById("platform")?.scrollIntoView({
                  behavior: reducedMotion || still ? "instant" : "smooth",
                })
          }
        >
          <span className="rl-scroll-label">
            {progress < 0.12
              ? "SCROLL TO BEGIN — YOUR JOURNEY STARTS HERE"
              : "KEEP SCROLLING. WATCH IT COME TOGETHER."}
          </span>
          <span className="rl-scroll-arrow" aria-hidden="true">
            ↓
          </span>
        </button>
      </div>
    </section>
  );
}

const TOOL_GROUPS = [
  {
    label: "KNOW MORE",
    number: "01",
    items: [
      {
        name: "The podcast",
        note: "400+ episodes. Always free.",
        href: "/podcast",
      },
      {
        name: "Market intelligence",
        note: "Research that informs your next move.",
        href: "/research",
      },
      {
        name: "The investor encyclopedia",
        note: "Make the complex feel simple.",
        href: "/encyclopedia",
      },
    ],
  },
  {
    label: "BUILD SMARTER",
    number: "02",
    items: [
      {
        name: "Property discovery",
        note: "A national search. An investor lens.",
        href: "/listings",
      },
      {
        name: "Underwrite any deal",
        note: "Cash flow, returns, and the price that works.",
        href: "/underwrite",
      },
      {
        name: "AI multiplex underwriter",
        note: "Site risks, scenarios, and AI-written insights.",
        href: "/multiplex",
      },
      {
        name: "Make an offer + cashback",
        note: "Your next move. More capital for the project.",
        href: "/work-with-us",
      },
      {
        name: "Motivated deals",
        note: "Power of sale, VTB, and sellers who need to move.",
        href: "/deals",
      },
    ],
  },
  {
    label: "GO FURTHER, TOGETHER",
    number: "03",
    items: [
      {
        name: "Meetups & events",
        note: "Your people are already here.",
        href: "/community",
      },
      {
        name: "Power team",
        note: "Introductions to the nine people around a deal.",
        href: "/team",
      },
      {
        name: "Leaderboard",
        note: "Who's underwriting the most deals this week.",
        href: "/community/leaderboard",
      },
      {
        name: "Work with Realist",
        note: "From your first project to long-term asset strategy.",
        href: "/work-with-us",
      },
      {
        name: "AI property management",
        note: "Meet PropCare, our property technology partner.",
        href: "https://realist.ca/community/events/partners/propcare",
      },
    ],
  },
];

export default function ScrollcraftLanding({ onCta }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewer = useViewer();
  const account = accountLink(viewer);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("rl-menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  return (
    <div className="rl-page">
      <a href="#main" className="rl-skip-link">
        Skip to content
      </a>
      <header className="rl-header">
        <div className="rl-header-inner">
          <a href="/" aria-label="Realist home">
            <Brand />
          </a>
          <nav className="rl-desktop-nav" aria-label="Main navigation">
            <a href="#journey">
              The journey<span>{CHAPTERS.length}</span>
            </a>
            <a href="#platform">The platform</a>
            <TrackedLink href="/community" name="nav_community" onCta={onCta}>
              Our community
              <Arrow diagonal />
            </TrackedLink>
          </nav>
          <div className="rl-header-actions">
            <TrackedLink
              href={account.href}
              name={viewer ? "nav_account" : "nav_login"}
              className="rl-sign-in"
              onCta={onCta}
            >
              <AccountLinkLabel viewer={viewer} />
            </TrackedLink>
            <TrackedLink
              href="/multiplex"
              name="nav_start"
              className="rl-button rl-button-small"
              onCta={onCta}
            >
              Start building
              <Arrow diagonal />
            </TrackedLink>
            <button
              id="rl-menu-toggle"
              className="rl-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="rl-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span>{menuOpen ? "×" : "="}</span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="rl-mobile-menu"
            className="rl-mobile-menu"
            aria-label="Mobile navigation"
            onClick={() => setMenuOpen(false)}
          >
            <a href="#journey">
              Explore the journey
              <Arrow />
            </a>
            <a href="#platform">
              All features
              <Arrow />
            </a>
            <a href="/community">
              Meet the community
              <Arrow />
            </a>
            <a href={account.href}>
              {account.label}
              <Arrow />
            </a>
          </nav>
        )}
      </header>
      <div id="main" tabIndex={-1}>
        <Story onCta={onCta} reducedMotion={reducedMotion} />
        <section id="platform" className="rl-platform">
          <div className="rl-section-heading">
            <div>
              <span className="rl-eyebrow">
                THE INTELLIGENCE BEHIND YOUR INVESTMENT.
              </span>
              <h2>
                Artificial intelligence.
                <br />
                <em>Real-world expertise.</em>
              </h2>
            </div>
            <p>
              AI to make sense of the numbers. People to move the project
              forward. One connected journey, from your first question to
              long-term operations.
            </p>
          </div>
          <div className="rl-tool-groups">
            {TOOL_GROUPS.map((group) => (
              <div key={group.label} className="rl-tool-group">
                <div className="rl-tool-heading">
                  <span>{group.number}</span>
                  <h3>{group.label}</h3>
                </div>
                {group.items.map((item) => (
                  <TrackedLink
                    key={item.name}
                    href={item.href}
                    name={`platform_${item.name}`}
                    location="platform"
                    onCta={onCta}
                    className="rl-tool-link"
                  >
                    <span>
                      <b>{item.name}</b>
                      <small>{item.note}</small>
                    </span>
                    <Arrow diagonal />
                  </TrackedLink>
                ))}
              </div>
            ))}
          </div>
        </section>
        <section className="rl-closing">
          <div className="rl-closing-grid" />
          <div>
            <span className="rl-eyebrow">
              <span className="rl-status-dot" /> YOUR NEXT CHAPTER STARTS HERE.
            </span>
            <h2>
              Some see a lot.
              <br />
              <em>You see what’s next.</em>
            </h2>
            <p>
              AI-assisted analysis. Experienced people. A plan for the long run.
            </p>
            <div className="rl-closing-actions">
              <TrackedLink
                href="/multiplex"
                name="closing_multiplex"
                location="closing"
                className="rl-button rl-button-lime"
                onCta={onCta}
              >
                Explore your multiplex
                <Arrow diagonal />
              </TrackedLink>
              <TrackedLink
                href="/podcast"
                name="closing_learn"
                location="closing"
                className="rl-closing-learn"
                onCta={onCta}
              >
                Start with a free episode
                <Arrow />
              </TrackedLink>
            </div>
          </div>
          <div className="rl-closing-symbol" aria-hidden="true">
            ↗
          </div>
        </section>
      </div>
      <footer className="rl-footer">
        <div className="rl-footer-top">
          <a href="/" aria-label="Realist home">
            <Brand />
          </a>
          <p>More homes. More possibility.</p>
          <div>
            <a href="/about">About us</a>
            <a href="/work-with-us">
              Let’s talk
              <Arrow diagonal />
            </a>
            <a href="/podcast">
              The podcast
              <Arrow diagonal />
            </a>
          </div>
        </div>
        <div className="rl-footer-bottom">
          <span>© {new Date().getFullYear()} Realist.ca</span>
          <span>Made for the Canadian real estate investor.</span>
          <div>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <span className="rl-made-canada">
              CA <span>✳</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
