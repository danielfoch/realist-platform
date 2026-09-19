import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import MultiplexScene from "./MultiplexScene";
import KnowledgeScene from "./KnowledgeScene";
import "./scrollcraft.css";

export type LandingCta = (name: string, href: string, location: string) => void;
type Props = { onCta?: LandingCta; signedIn?: boolean };
const clamp = (n: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, n));
const STEP_VH = 0.56;
const STILL_FRAMES = [0, 1.62, 2.3, 3.5, 4.5, 5.8, 6.4];

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
      "Start with 400+ free episodes of The Canadian Real Estate Investor. Real conversations about finding deals, funding projects, and building wealth in Canada.",
    tags: ["Free podcast", "Investor guides", "Market insights"],
    cta: "Start listening",
    href: "/insights/podcast",
    note: "Your unfair advantage starts here.",
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
    href: "/meetups",
    note: "A conversation can change the whole project.",
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
    href: "/tools/cap-rates",
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
      "Explore what a Toronto lot could become. Screen zoning, compare unit configurations, and bring a multiplex concept into focus before committing to a project.",
    tags: ["Lot & zoning checks", "Concept massing", "Unit scenarios"],
    cta: "Explore a multiplex concept",
    href: "/tools/multiplex-underwriter",
    note: "Early concepts to discuss with your architect.",
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
      "Bring land, construction costs, and rental assumptions into one pro forma. Compare financing scenarios, then work with a mortgage professional on the next step.",
    tags: ["Development budget", "Rental pro forma", "Financing scenarios"],
    cta: "Run your numbers",
    href: "/tools/multiplex-underwriter",
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
      "Bring your plan to the people who can build it. Connect with a project team and move from diligence and drawings toward foundations, framing, and finishing touches.",
    tags: [
      "Architects & planners",
      "Building professionals",
      "Project support",
    ],
    cta: "Build your project team",
    href: "/work-with-realist",
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
      "Plan the next chapter: lease-up, property management, and long-term ownership. Explore CMHC MLI Select scenarios for eligible projects with five or more units.",
    tags: [
      "Lease-up planning",
      "Management connections",
      "MLI Select scenarios",
    ],
    cta: "Plan your next chapter",
    href: "/book-a-call",
    note: "Financing is subject to program and lender review.",
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
}: {
  children: ReactNode;
  href: string;
  className?: string;
  name: string;
  location?: string;
  onCta?: LandingCta;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => onCta?.(name, href, location)}
    >
      {children}
    </a>
  );
}
const HeroScene = memo(function HeroScene() {
  return <MultiplexScene hero />;
});

function ProjectDocuments({ progress }: { progress: number }) {
  const finance =
    clamp((progress - 3.65) * 3) * (1 - clamp((progress - 4.8) * 4));
  const commitment = clamp((progress - 4.2) * 3);
  const ownership = clamp((progress - 5.7) * 3.4);
  return (
    <div className="rl-documents" aria-hidden="true">
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
  const active = Math.min(6, Math.floor(progress));
  const visualProgress =
    reducedMotion || still ? STILL_FRAMES[active] : progress;

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
      const next = clamp((header - top) / chapterDistance, 0, 6.999);
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
      (index + 0.06) * chapterDistance;
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
        aria-label="The seven-step multiplex journey"
      >
        {CHAPTERS.map((chapter, i) => (
          <article key={chapter.name} className="rl-static-chapter">
            <div className="rl-chapter-copy">
              <div className="rl-chapter-index">
                <span>0{i + 1}</span>
                <span>/ 07</span>
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
                {i < 2 ? (
                  <KnowledgeScene progress={STILL_FRAMES[i]} />
                ) : (
                  <MultiplexScene progress={STILL_FRAMES[i]} />
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
      ref={root}
      aria-label="Seven steps from learning to owning a multiplex"
      style={{ "--chapter-vh": `${STEP_VH * 7 * 100}svh` } as CSSProperties}
    >
      <div className="rl-story-sticky">
        <div className="rl-story-top">
          <span className="rl-eyebrow">
            <span className="rl-status-dot" /> THE MULTIPLEX JOURNEY
          </span>
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
          <div className="rl-chapter-copy">
            <div className="rl-chapter-index">
              <span>0{active + 1}</span>
              <span>/ 07</span>
              <i />
              <span>{CHAPTERS[active].name.toUpperCase()}</span>
            </div>
            {CHAPTERS.map((chapter, i) => (
              <div
                key={chapter.name}
                hidden={i !== active}
                className="rl-chapter-text"
                id={`chapter-${i + 1}`}
              >
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
            ))}
          </div>
          <div
            className="rl-story-visual"
            aria-label={`${CHAPTERS[active].name}: ${CHAPTERS[active].label}`}
            role="img"
          >
            <div className="rl-visual-grid" />
            <div className="rl-scene-label">
              <span>REALIST FIELD NOTES</span>
              <span>FIG. 0{active + 1}</span>
            </div>
            <div
              className="rl-knowledge-scene"
              aria-hidden="true"
              style={{ opacity: 1 - clamp((visualProgress - 1.9) / 0.3) }}
            >
              {visualProgress < 2.2 ? (
                <KnowledgeScene progress={visualProgress} />
              ) : null}
            </div>
            <div
              className="rl-building-scene"
              aria-hidden="true"
              style={{ opacity: clamp((visualProgress - 1.9) / 0.3) }}
            >
              {visualProgress > 1.9 ? (
                <MultiplexScene progress={visualProgress} />
              ) : null}
            </div>
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
              <span className="rl-step-number">0{i + 1}</span>
              <span>{chapter.name}</span>
              <i style={{ transform: `scaleX(${clamp(progress - i)})` }} />
            </button>
          ))}
        </nav>
        <div className="rl-scroll-cue">
          <span>KEEP SCROLLING. WATCH IT COME TOGETHER.</span>
          <span aria-hidden="true">↓</span>
        </div>
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
        href: "/insights/podcast",
      },
      {
        name: "Market intelligence",
        note: "Research that informs your next move.",
        href: "/insights",
      },
      {
        name: "The investor encyclopedia",
        note: "Make the complex feel simple.",
        href: "/insights/encyclopedia",
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
        href: "/tools/cap-rates",
      },
      {
        name: "Multiplex underwriter",
        note: "Lot, concept, costs, and takeout.",
        href: "/tools/multiplex-underwriter",
      },
      {
        name: "Deal analyzer & tools",
        note: "Put every assumption to the test.",
        href: "/tools",
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
        href: "/meetups",
      },
      {
        name: "Co-investing",
        note: "Find the right partners for the plan.",
        href: "/tools/coinvest",
      },
      {
        name: "Work with Realist",
        note: "Experienced people in your corner.",
        href: "/work-with-realist",
      },
    ],
  },
];

export default function ScrollcraftLanding({ onCta, signedIn = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
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
  function startJourney() {
    document.getElementById("journey")?.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "start",
    });
  }
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
              The journey<span>07</span>
            </a>
            <a href="#platform">The platform</a>
            <TrackedLink href="/meetups" name="nav_community" onCta={onCta}>
              Our community
              <Arrow diagonal />
            </TrackedLink>
          </nav>
          <div className="rl-header-actions">
            <TrackedLink
              href={signedIn ? "/dashboard" : "/login"}
              name="nav_login"
              className="rl-sign-in"
              onCta={onCta}
            >
              {signedIn ? "Dashboard" : "Log in"}
            </TrackedLink>
            <TrackedLink
              href="/tools/multiplex-underwriter"
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
            <a href="/meetups">
              Meet the community
              <Arrow />
            </a>
            <a href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? "Dashboard" : "Log in"}
              <Arrow />
            </a>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1}>
        <section className="rl-hero">
          <div className="rl-hero-copy">
            <span className="rl-eyebrow rl-hero-kicker">
              <span className="rl-status-dot" /> BIG IDEAS. SMALL MULTIPLEXES.
            </span>
            <h1>
              Small footprint.
              <br />
              Extraordinary
              <br />
              <em>potential.</em>
            </h1>
            <p>
              From your first listen to your first multiplex.
              <br className="rl-desktop-break" /> The knowledge, people, and
              tools to build
              <br className="rl-desktop-break" /> something that lasts.
            </p>
            <div className="rl-hero-actions">
              <TrackedLink
                href="/tools/multiplex-underwriter"
                name="hero_start"
                location="hero"
                className="rl-button"
                onCta={onCta}
              >
                Find your next possibility
                <Arrow diagonal />
              </TrackedLink>
              <button className="rl-watch-journey" onClick={startJourney}>
                <span>↓</span>See how it comes together
              </button>
            </div>
            <div className="rl-hero-proof">
              <span className="rl-proof-mark">
                CA<span>↗</span>
              </span>
              <span>
                Built for Canadian investors.
                <br />
                <b>From the people behind the podcast.</b>
              </span>
            </div>
          </div>
          <div className="rl-hero-art">
            <div className="rl-hero-orbit" />
            <div className="rl-art-coordinate">43°39′ N &nbsp; 79°23′ W</div>
            <div className="rl-hero-scene">
              <HeroScene />
            </div>
            <div className="rl-hero-project">
              <span className="rl-status-dot" />
              <span>THE MULTIPLEX OPPORTUNITY</span>
              <Arrow diagonal />
              <div>
                <strong>One lot.</strong>
                <em>More possibility.</em>
              </div>
              <span className="rl-project-foot">A CONCEPT WORTH EXPLORING</span>
            </div>
            <span className="rl-hero-annotation">
              <i />
              THE NEXT CHAPTER OF YOUR NEIGHBOURHOOD.
            </span>
            <span className="rl-art-index">FIG. 01 / THE BIGGER PICTURE</span>
          </div>
        </section>
        <div className="rl-proof-strip">
          <div>
            <strong>400+</strong>
            <span>free podcast episodes</span>
          </div>
          <div>
            <strong>150,000+</strong>
            <span>properties across Canada</span>
          </div>
          <div>
            <strong>One connected journey.</strong>
            <span>From learning to long-term ownership.</span>
          </div>
          <button
            onClick={startJourney}
            aria-label="Explore the seven-step journey"
          >
            ↓
          </button>
        </div>
        <div className="rl-journey-intro">
          <span className="rl-eyebrow">THERE’S A WAY TO BUILD THIS.</span>
          <h2>
            Big ambitions.
            <br />
            <em>One step at a time.</em>
          </h2>
          <p>
            A little knowledge becomes a conversation.
            <br />A conversation becomes a project.
            <br />
            Scroll to see what happens next.
          </p>
        </div>
        <Story onCta={onCta} reducedMotion={reducedMotion} />
        <section id="platform" className="rl-platform">
          <div className="rl-section-heading">
            <div>
              <span className="rl-eyebrow">EVERYTHING CONNECTS.</span>
              <h2>
                Your ambition.
                <br />
                <em>A whole platform behind it.</em>
              </h2>
            </div>
            <p>
              Pick up wherever you are.
              <br />
              There’s a next step for that.
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
            <p>Let’s turn that possibility into a plan.</p>
            <div className="rl-closing-actions">
              <TrackedLink
                href="/tools/multiplex-underwriter"
                name="closing_multiplex"
                location="closing"
                className="rl-button rl-button-lime"
                onCta={onCta}
              >
                Explore your multiplex
                <Arrow diagonal />
              </TrackedLink>
              <TrackedLink
                href="/insights/podcast"
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
      </main>
      <footer className="rl-footer">
        <div className="rl-footer-top">
          <a href="/" aria-label="Realist home">
            <Brand />
          </a>
          <p>More homes. More possibility.</p>
          <div>
            <a href="/about">About us</a>
            <a href="/book-a-call">
              Let’s talk
              <Arrow diagonal />
            </a>
            <a href="/insights/podcast">
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
