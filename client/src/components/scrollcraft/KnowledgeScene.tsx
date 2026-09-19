import { useId } from "react";

const ink = "#212b25";
const forest = "#285542";
const paper = "#f5f3eb";
const lime = "#c8f16a";
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

type Profile = {
  x: number;
  y: number;
  label: string;
  number: string;
  type: number;
};
const profiles: Profile[] = [
  { x: 183, y: 222, label: "INVESTOR", number: "01", type: 0 },
  { x: 353, y: 126, label: "ARCHITECT", number: "02", type: 1 },
  { x: 567, y: 172, label: "BUILDER", number: "03", type: 2 },
  { x: 608, y: 341, label: "CAPITAL", number: "04", type: 3 },
  { x: 314, y: 330, label: "MENTOR", number: "05", type: 4 },
];

function Portrait({ type }: { type: number }) {
  if (type === 3) {
    return (
      <g fill="none" stroke={forest} strokeWidth="1.4">
        <path d="M-17 13V-5l17-9 17 9v18M-21 14h42M-21-5h42M-11-1v12M0-1v12M11-1v12" />
        <path d="M-24 18h48" opacity=".35" />
      </g>
    );
  }
  return (
    <g
      stroke={ink}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M-25 30c1-15 8-22 19-24h12c12 2 19 10 21 24"
        fill={
          type === 1
            ? "#b7c4ad"
            : type === 2
              ? forest
              : type === 4
                ? "#d1c7b4"
                : "#c5ccbe"
        }
      />
      <path d="M-5 1v8l5 5 5-5V1" fill="#d8c6ac" />
      <ellipse
        cx="0"
        cy="-10"
        rx="11"
        ry="15"
        fill={type === 0 ? "#cbaa86" : "#e0cbb0"}
      />
      {type === 0 && (
        <path
          d="M-11-10c-1-13 2-19 12-18 10 1 12 8 10 17L5-18l-15 6"
          fill={ink}
        />
      )}
      {type === 1 && (
        <path
          d="M-11-6c-10-17 0-27 11-27 15 0 19 15 12 28L7-24c-4 8-10 9-18 9"
          fill={ink}
        />
      )}
      {type === 2 && (
        <g fill={lime}>
          <path d="M-16-17c1-11 7-16 16-16 9 0 15 5 16 16z" />
          <path d="M-19-17h38v4h-38zM-3-31v14M3-31v14" />
        </g>
      )}
      {type === 4 && (
        <g>
          <path
            d="M-12-12c-3-12 4-19 13-18 9 0 13 8 11 16L6-23l-17 7"
            fill="#d8d9ce"
          />
          <path d="M-10-1C-6 10 8 11 11-3L5 0H-5Z" fill={ink} />
          <path
            d="M-10-11h8v5h-8zM2-11h8v5H2zM-2-9h4"
            fill="none"
            strokeWidth="1"
          />
        </g>
      )}
      <path d="M-4-8h.1M5-8h.1M0-6v5h2" fill="none" strokeWidth="1" />
      <path d="M-5 9l-7 8 12 9 12-9-7-8" fill="none" opacity=".5" />
    </g>
  );
}

/** The opening two chapters: an investor's knowledge becomes their network. */
export default function KnowledgeScene({
  progress = 0,
}: {
  progress?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const network = smooth((progress - 1.0) / 0.6);
  const departing = smooth((progress - 1.9) / 0.3);
  const bookScale = 1 - network * 0.43;
  const bookY = network * 110;
  const waveform = [
    8, 17, 28, 14, 41, 54, 30, 69, 48, 23, 56, 81, 61, 39, 72, 49, 25, 54, 34,
    65, 43, 18, 31, 12,
  ];

  return (
    <svg
      viewBox="0 0 800 620"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={
        progress < 0.5
          ? "An open book filled with 400 plus free Canadian Real Estate Investor podcast episodes"
          : "A network of investors, architects, builders, mentors and capital growing from shared knowledge"
      }
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${uid}-left`} x1="0" x2="1" y1="0" y2=".3">
          <stop offset="0" stopColor="#fffef7" />
          <stop offset=".85" stopColor={paper} />
          <stop offset="1" stopColor="#d9dbc9" />
        </linearGradient>
        <linearGradient id={`${uid}-right`} x1="0" x2="1" y1="0" y2=".15">
          <stop offset="0" stopColor="#dfe0d0" />
          <stop offset=".09" stopColor="#fbfaf1" />
          <stop offset="1" stopColor="#fffdf4" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`}>
          <stop stopColor={ink} stopOpacity=".14" />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </radialGradient>
        {profiles.map((_, i) => (
          <clipPath id={`${uid}-portrait-${i}`} key={i}>
            <circle r="29" />
          </clipPath>
        ))}
      </defs>

      <g opacity={1 - departing}>
        <g
          stroke={forest}
          fill="none"
          opacity={0.15 * (1 - network)}
          strokeWidth=".7"
        >
          <path d="M61 169v295M50 184h26M50 449h26M730 145v312M717 160h26M717 442h26M88 490h620M105 478v25M692 478v25" />
          <path
            d="M61 183l45 17M61 449l53-31M731 160l-45 27M731 442l-29-57"
            strokeDasharray="3 5"
          />
          <circle cx="391" cy="236" r="116" strokeDasharray="2 7" />
        </g>
        <g
          fill={forest}
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="1.3"
          opacity={0.5 * (1 - network)}
        >
          <text x="55" y="151">
            FIG. 01 — KNOWLEDGE
          </text>
          <text x="354" y="505">
            OPEN TO EVERYONE
          </text>
          <text x="734" y="335" transform="rotate(-90 734 335)">
            A BETTER PLACE TO START
          </text>
        </g>

        {/* Every connection has a useful next step. */}
        <g opacity={network}>
          <g fill="none" stroke={forest} strokeWidth="1">
            <path
              d="M183 222L353 126 567 172 608 341 314 330 183 222M353 126L314 330M183 222L567 172M314 330L567 172M353 126L608 341"
              strokeDasharray="900"
              strokeDashoffset={900 * (1 - network)}
              opacity=".34"
            />
            <path
              d="M183 222Q199 398 400 460M314 330L400 460M608 341Q566 430 400 460M353 126Q433 280 400 460"
              opacity=".19"
              strokeDasharray="3 6"
            />
            <circle
              cx="421"
              cy="253"
              r="202"
              strokeDasharray="2 9"
              opacity=".15"
            />
          </g>
          <g
            fontFamily="monospace"
            fontSize="8"
            letterSpacing="1"
            fill={forest}
            opacity=".6"
          >
            <text x="108" y="106">
              THE POWER OF PROXIMITY
            </text>
            <path d="M108 117h65" stroke={forest} strokeWidth=".8" />
            <text x="651" y="257" transform="rotate(90 651 257)">
              BUILT TOGETHER
            </text>
          </g>
          {[
            { x: 441, y: 153, s: 16 },
            { x: 450, y: 304, s: 22 },
            { x: 234, y: 351, s: 13 },
          ].map((node, index) => {
            const appear = smooth((network - 0.27 - index * 0.07) / 0.5);
            return (
              <g
                key={index}
                transform={`translate(${400 + (node.x - 400) * appear} ${436 + (node.y - 436) * appear}) scale(${0.2 + appear * 0.8})`}
                opacity={appear}
              >
                <circle r={node.s + 5} fill={paper} />
                <circle
                  r={node.s}
                  fill={lime}
                  stroke={forest}
                  strokeWidth=".75"
                />
                <text
                  y="5"
                  textAnchor="middle"
                  fontFamily="Georgia, serif"
                  fontSize={node.s + 1}
                  fill={forest}
                >
                  $
                </text>
              </g>
            );
          })}
          {profiles.map((profile, index) => {
            const appear = smooth((network - index * 0.055) / 0.72);
            const x = 400 + (profile.x - 400) * appear;
            const y = 434 + (profile.y - 434) * appear;
            return (
              <g
                key={profile.label}
                transform={`translate(${x} ${y}) scale(${0.3 + appear * 0.7})`}
                opacity={appear}
              >
                <circle r="39" fill={paper} stroke={forest} strokeWidth=".7" />
                <circle
                  r="34"
                  fill="none"
                  stroke={forest}
                  strokeWidth=".5"
                  opacity=".25"
                />
                <circle r="29" fill={profile.type === 3 ? lime : "#e7e9dd"} />
                <g clipPath={`url(#${uid}-portrait-${index})`}>
                  <Portrait type={profile.type} />
                </g>
                <circle
                  cx="28"
                  cy="-27"
                  r="8"
                  fill={forest}
                  stroke={paper}
                  strokeWidth="2"
                />
                <path
                  d="m25-27 2 2 4-4"
                  stroke={lime}
                  strokeWidth="1.2"
                  fill="none"
                />
                <rect
                  x="-48"
                  y="44"
                  width="96"
                  height="19"
                  rx="9.5"
                  fill={paper}
                />
                <text
                  y="56"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="9"
                  letterSpacing="1.2"
                  fill={forest}
                >
                  {profile.label}
                </text>
              </g>
            );
          })}
        </g>

        <g
          transform={`translate(400 ${344 + bookY}) scale(${bookScale}) translate(-400 -344)`}
        >
          <ellipse
            cx="407"
            cy="444"
            rx="337"
            ry="57"
            fill={`url(#${uid}-shadow)`}
          />
          {/* The staggered edges make the book feel like a physical object. */}
          <path
            d="M92 208 389 242 689 183 709 391 413 473 100 414Z"
            fill={forest}
            stroke={ink}
            strokeWidth="1.2"
          />
          <path d="m100 402 313 60 287-77v8l-287 78-313-58Z" fill="#1b392c" />
          <path
            d="m105 200 285 31 296-48 14 202-288 76-302-56Z"
            fill="#d8dbca"
            stroke={ink}
            strokeWidth=".8"
          />
          <path
            d="m107 208 284 33 295-48 13 187-287 76-300-56"
            fill="none"
            stroke="#81907c"
            strokeWidth=".75"
          />
          <path
            d="m109 213 282 34 296-48 10 177-284 74-300-55"
            fill="none"
            stroke="#8c9785"
            strokeWidth=".6"
          />
          <path
            d="m111 219 281 33 294-47 9 166-282 73-298-53"
            fill="none"
            stroke="#8c9785"
            strokeWidth=".6"
          />
          <path
            d="M103 191C195 196 300 204 391 236L412 447C315 412 211 395 114 386Z"
            fill={`url(#${uid}-left)`}
            stroke={ink}
            strokeWidth="1"
          />
          <path
            d="M391 236C477 205 575 185 683 181L694 368C585 383 497 412 412 447Z"
            fill={`url(#${uid}-right)`}
            stroke={ink}
            strokeWidth="1"
          />
          <path
            d="M391 236 412 447"
            fill="none"
            stroke={forest}
            strokeWidth="1.1"
          />
          <path
            d="M396 237 416 439"
            fill="none"
            stroke="#c6cbb9"
            strokeWidth=".8"
          />
          <path
            d="M377 238 397 435"
            fill="none"
            stroke="#d5d9ca"
            strokeWidth=".8"
          />
          {/* Typesetting follows each page's perspective. */}
          <g transform="matrix(.89 .125 .059 .84 133 216)" fill={ink}>
            <text
              y="6"
              fontFamily="monospace"
              fontSize="7.3"
              letterSpacing="1.8"
            >
              THE REALIST FIELD GUIDE
            </text>
            <path d="M0 17h247" stroke={forest} strokeWidth=".75" />
            <text
              y="47"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="27"
            >
              Great projects
            </text>
            <text
              y="77"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="27"
            >
              start with
            </text>
            <text
              y="107"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="27"
              fontStyle="italic"
            >
              a little curiosity.
            </text>
            <text
              y="132"
              fontFamily="monospace"
              fontSize="6.8"
              letterSpacing=".8"
            >
              THE CANADIAN REAL ESTATE INVESTOR
            </text>
            <g transform="translate(0 153)">
              <circle cx="16" cy="16" r="16" fill={forest} />
              <path d="m12 9 12 7-12 7Z" fill={lime} />
              <text
                x="44"
                y="13"
                fontFamily="Arial, sans-serif"
                fontSize="9.5"
                fontWeight="600"
              >
                Your next chapter starts here.
              </text>
              <text
                x="44"
                y="27"
                fontFamily="monospace"
                fontSize="6.8"
                letterSpacing=".5"
                fill={forest}
              >
                PRESS PLAY. BUILD CONFIDENCE.
              </text>
            </g>
            <path
              d="M0 201h247"
              stroke={forest}
              strokeWidth=".5"
              opacity=".3"
            />
            <text y="213" fontFamily="monospace" fontSize="6.5">
              001
            </text>
            <text
              x="247"
              y="213"
              textAnchor="end"
              fontFamily="monospace"
              fontSize="6.5"
            >
              KNOWLEDGE IS YOUR FOUNDATION
            </text>
          </g>
          <g transform="matrix(.86 -.181 .057 .827 418 252)">
            <text
              x="1"
              y="4"
              fontFamily="monospace"
              fontSize="7.4"
              letterSpacing="1.5"
              fill={forest}
            >
              LESS GUESSWORK. MORE KNOW-HOW.
            </text>
            <text
              x="-1"
              y="75"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="77"
              letterSpacing="-5"
              fill={forest}
            >
              400
              <tspan fontSize="43" dy="-23">
                +
              </tspan>
            </text>
            <rect x="2" y="86" width="118" height="18" rx="2" fill={lime} />
            <text
              x="10"
              y="98.5"
              fontFamily="monospace"
              fontSize="8"
              letterSpacing="1.5"
              fill={forest}
            >
              FREE EPISODES
            </text>
            <g
              transform="translate(4 112)"
              stroke={forest}
              strokeLinecap="round"
            >
              {waveform.map((height, index) => (
                <path
                  key={index}
                  d={`M${index * 9.8} ${38 - height * 0.39}v${height * 0.78}`}
                  strokeWidth={index % 4 === 0 ? "3.2" : "2.2"}
                  opacity={index % 5 === 0 ? ".4" : ".8"}
                />
              ))}
            </g>
            <path
              d="M1 193h244"
              stroke={forest}
              strokeWidth=".5"
              opacity=".3"
            />
            <text
              x="1"
              y="207"
              fontFamily="monospace"
              fontSize="6.4"
              letterSpacing=".55"
              fill={forest}
            >
              REAL EXPERIENCE. SHARED FREELY.
            </text>
            <text
              x="247"
              y="207"
              textAnchor="end"
              fontFamily="monospace"
              fontSize="6.5"
              fill={forest}
            >
              002
            </text>
          </g>
          <path
            d="m404 392 12 2 10 77-9-4-7 8Z"
            fill={lime}
            stroke={forest}
            strokeWidth=".65"
          />
        </g>

        <g opacity={network} textAnchor="middle" fill={forest}>
          <text
            x="400"
            y="565"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontSize="21"
          >
            Good people. Better projects.
          </text>
          <text
            x="400"
            y="584"
            fontFamily="monospace"
            fontSize="8"
            letterSpacing="1.5"
          >
            YOUR KNOWLEDGE. MULTIPLIED.
          </text>
        </g>
      </g>
    </svg>
  );
}
