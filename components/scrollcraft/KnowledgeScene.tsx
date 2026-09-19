import { useId } from "react";
import podcastCover from "./assets/crei-podcast-cover.jpg";

const ink = "#202020";
const graphite = "#363636";
const paper = "#f1f1ef";
const red = "#ff334b";
const darkRed = "#be1730";
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
      <g fill="none" stroke="white" strokeWidth="1.4">
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
            ? "#bcbcbc"
            : type === 2
              ? graphite
              : type === 4
                ? "#b6b6b6"
                : "#d1d1d1"
        }
      />
      <path d="M-5 1v8l5 5 5-5V1" fill="#c7c7c7" />
      <ellipse
        cx="0"
        cy="-10"
        rx="11"
        ry="15"
        fill={type === 0 ? "#a6a6a6" : "#d3d3d3"}
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
        <g fill="#d7d7d7">
          <path d="M-16-17c1-11 7-16 16-16 9 0 15 5 16 16z" />
          <path d="M-19-17h38v4h-38zM-3-31v14M3-31v14" />
        </g>
      )}
      {type === 4 && (
        <g>
          <path
            d="M-12-12c-3-12 4-19 13-18 9 0 13 8 11 16L6-23l-17 7"
            fill="#d8d8d8"
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

type Props = {
  progress?: number;
  animate?: boolean;
};

/** Listening becomes education, connections, then a property worth investigating. */
export default function KnowledgeScene({
  progress = 0,
  animate = true,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const network = smooth((progress - 2.0) / 0.6);
  const capDrop = smooth((progress - 0.95) / 0.5);
  const education =
    smooth((progress - 1.0) / 0.45) * (1 - smooth((progress - 1.85) / 0.3));
  const analyze = smooth((progress - 3.0) / 0.6);
  const mapReveal = smooth((progress - 3.15) / 0.45);
  const parcelGrow = smooth((progress - 3.75) / 0.45);
  const departing = smooth((progress - 3.85) / 0.35);
  const phoneScale = 1 - network * 0.65 + analyze * 0.55 - education * 0.08;
  const phoneY = network * 145 * (1 - analyze) + analyze * 46 + education * 35;
  const networkOpacity = network * (1 - analyze);
  const analysisOpacity = mapReveal * (1 - parcelGrow);
  const parcelScale = 0.025 + parcelGrow * 0.975;
  const parcelPoints = [
    [415, 509],
    [667, 383],
    [307, 203],
    [55, 329],
  ]
    .map(
      ([x, y]) =>
        `${361 + (x - 361) * parcelScale},${356 + (y - 356) * parcelScale}`,
    )
    .join(" ");
  const waveform = [
    16, 27, 19, 36, 48, 31, 53, 38, 25, 45, 58, 40, 27, 51, 34, 21, 43, 54, 33,
    46, 24, 38, 20, 12,
  ];

  return (
    <svg
      viewBox="0 0 800 620"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={
        analyze > 0.5
          ? "A phone opens a property map, analyzes illustrative investment scenarios, ranks opportunities, and expands a selected property into a measured parcel"
          : education > 0.5
            ? "A graduation cap lands on the podcast phone, representing more than 100 hours of free multiplex education"
            : network < 0.5
              ? "A phone beside white wireless earbuds playing The Canadian Real Estate Investor, Canada’s number one real estate podcast, with 400 plus free episodes"
              : "The Canadian Real Estate Investor podcast connects a network of investors, architects, builders, mentors and capital"
      }
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${uid}-phone-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6e6e6e" />
          <stop offset=".2" stopColor="#202020" />
          <stop offset=".55" stopColor="#737373" />
          <stop offset="1" stopColor="#171717" />
        </linearGradient>
        <linearGradient id={`${uid}-earbuds`} x1="0" y1="0" x2="1" y2=".35">
          <stop stopColor="#cecece" />
          <stop offset=".28" stopColor="white" />
          <stop offset=".67" stopColor="#fafafa" />
          <stop offset="1" stopColor="#bfbfbf" />
        </linearGradient>
        <linearGradient id={`${uid}-screen`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#262626" />
          <stop offset=".68" stopColor="#141414" />
          <stop offset="1" stopColor="#1c1c1c" />
        </linearGradient>
        <clipPath id={`${uid}-map-screen`}>
          <rect x="290" y="87" width="220" height="455" rx="18" />
        </clipPath>
        <clipPath id={`${uid}-cover`}>
          <rect x="308" y="148" width="184" height="184" rx="9" />
        </clipPath>
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

      <style>{`
        @keyframes ${uid}-soundbar {
          0%, 100% { transform: scaleY(.44); }
          42% { transform: scaleY(1); }
          72% { transform: scaleY(.68); }
        }
        .${uid}-soundbar {
          transform-box: fill-box;
          transform-origin: center;
          animation: ${uid}-soundbar 1.25s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .${uid}-soundbar { animation: none; }
        }
      `}</style>

      <g opacity={1 - departing}>
        <g
          stroke={graphite}
          fill="none"
          opacity={0.15 * (1 - network)}
          strokeWidth=".7"
        >
          <path d="M61 169v295M50 184h26M50 449h26M730 145v312M717 160h26M717 442h26M88 490h620M105 478v25M692 478v25" />
          <path
            d="M61 183l45 17M61 449l53-31M731 160l-45 27M731 442l-29-57"
            strokeDasharray="3 5"
          />
          <circle cx="400" cy="310" r="230" strokeDasharray="2 7" />
        </g>
        <g
          fill={graphite}
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="1.3"
          opacity={0.5 * (1 - network)}
        >
          <text x="55" y="151">
            FIG. 01 — KNOWLEDGE
          </text>
          <text x="552" y="477">
            OPEN TO EVERYONE
          </text>
          <text x="734" y="335" transform="rotate(-90 734 335)">
            A BETTER PLACE TO START
          </text>
        </g>

        {/* Every connection has a useful next step. */}
        <g opacity={networkOpacity}>
          <g fill="none" stroke={graphite} strokeWidth="1">
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
            fill={graphite}
            opacity=".6"
          >
            <text x="108" y="106">
              THE POWER OF PROXIMITY
            </text>
            <path d="M108 117h65" stroke={graphite} strokeWidth=".8" />
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
                  fill={red}
                  stroke={darkRed}
                  strokeWidth=".75"
                />
                <text
                  y="5"
                  textAnchor="middle"
                  fontFamily="Georgia, serif"
                  fontSize={node.s + 1}
                  fill="white"
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
                <circle
                  r="39"
                  fill={paper}
                  stroke={graphite}
                  strokeWidth=".7"
                />
                <circle
                  r="34"
                  fill="none"
                  stroke={graphite}
                  strokeWidth=".5"
                  opacity=".25"
                />
                <circle r="29" fill={profile.type === 3 ? red : "#dededc"} />
                <g clipPath={`url(#${uid}-portrait-${index})`}>
                  <Portrait type={profile.type} />
                </g>
                <circle
                  cx="28"
                  cy="-27"
                  r="8"
                  fill={darkRed}
                  stroke={paper}
                  strokeWidth="2"
                />
                <path
                  d="m25-27 2 2 4-4"
                  stroke="white"
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
                  fill={graphite}
                >
                  {profile.label}
                </text>
              </g>
            );
          })}
        </g>

        <g
          opacity={1 - parcelGrow}
          transform={`translate(${400 - analyze * 39} ${310 + phoneY}) rotate(${-22 * analyze}) skewX(${5 * analyze}) scale(${phoneScale} ${phoneScale * (1 - analyze * 0.11)}) translate(-400 -310)`}
        >
          <ellipse
            cx="365"
            cy="575"
            rx="252"
            ry="34"
            fill={`url(#${uid}-shadow)`}
          />

          {/* Polished wireless earbuds keep the scene unmistakably about listening. */}
          <g opacity={(1 - analyze) * (1 - education * 0.6)}>
            <g transform="translate(147 245) rotate(-18)">
              <ellipse
                cx="15"
                cy="127"
                rx="34"
                ry="11"
                fill={`url(#${uid}-shadow)`}
              />
              <path
                d="M8 13h22v93c0 9-4 14-11 14s-11-5-11-14Z"
                fill={`url(#${uid}-earbuds)`}
                stroke="#bdbdbd"
                strokeWidth=".8"
              />
              <ellipse
                cx="14"
                cy="11"
                rx="32"
                ry="24"
                fill={`url(#${uid}-earbuds)`}
                stroke="#c5c5c5"
                strokeWidth=".9"
                transform="rotate(-15 14 11)"
              />
              <ellipse
                cx="-5"
                cy="10"
                rx="7"
                ry="12"
                fill="#252525"
                transform="rotate(-20 -5 10)"
              />
              <ellipse
                cx="-5"
                cy="10"
                rx="4"
                ry="8"
                fill="#474747"
                transform="rotate(-20 -5 10)"
              />
              <path
                d="M25 48v44"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path d="M11 109h15" stroke="#a5a5a5" strokeWidth="1.2" />
              <circle cx="28" cy="18" r="3" fill="#555" />
            </g>
            <g transform="translate(225 248) rotate(17)">
              <path
                d="M-10 12h22v95c0 8-4 13-11 13s-11-5-11-13Z"
                fill={`url(#${uid}-earbuds)`}
                stroke="#bdbdbd"
                strokeWidth=".8"
              />
              <ellipse
                cx="6"
                cy="9"
                rx="31"
                ry="24"
                fill={`url(#${uid}-earbuds)`}
                stroke="#c5c5c5"
                strokeWidth=".9"
                transform="rotate(12 6 9)"
              />
              <ellipse
                cx="23"
                cy="9"
                rx="7"
                ry="12"
                fill="#252525"
                transform="rotate(18 23 9)"
              />
              <ellipse
                cx="23"
                cy="9"
                rx="4"
                ry="8"
                fill="#474747"
                transform="rotate(18 23 9)"
              />
              <path
                d="M-4 48v44"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path d="M-7 109H8" stroke="#a5a5a5" strokeWidth="1.2" />
              <circle cx="-6" cy="18" r="3" fill="#555" />
            </g>
            <g transform="translate(106 405) rotate(-9 72 39)">
              <ellipse
                cx="73"
                cy="79"
                rx="78"
                ry="16"
                fill={`url(#${uid}-shadow)`}
              />
              <rect
                width="144"
                height="77"
                rx="29"
                fill={`url(#${uid}-earbuds)`}
                stroke="#c1c1c1"
                strokeWidth="1"
              />
              <path
                d="M3 27c39 4 99 4 138 0"
                fill="none"
                stroke="#c3c3c3"
                strokeWidth="1.3"
              />
              <path
                d="M14 14c24-10 76-10 114 0"
                fill="none"
                stroke="white"
                strokeWidth="2"
                opacity=".85"
              />
              <circle cx="72" cy="45" r="2.3" fill={red} />
            </g>
          </g>

          {/* Machined edge, inset glass and a readable, recognisable podcast player. */}
          <rect x="276" y="135" width="5" height="27" rx="2" fill="#424242" />
          <rect x="276" y="175" width="5" height="48" rx="2" fill="#424242" />
          <rect x="519" y="166" width="5" height="61" rx="2" fill="#424242" />
          <rect
            x="280"
            y="39"
            width="240"
            height="521"
            rx="39"
            fill={`url(#${uid}-phone-edge)`}
            stroke="#111"
            strokeWidth="1.5"
          />
          <rect
            x="284"
            y="43"
            width="232"
            height="513"
            rx="36"
            fill="#080808"
          />
          <rect
            x="290"
            y="52"
            width="220"
            height="490"
            rx="30"
            fill={`url(#${uid}-screen)`}
            stroke="#414141"
            strokeWidth=".8"
          />
          <path
            d="M292 151V84c0-16 10-28 25-29"
            fill="none"
            stroke="white"
            strokeWidth="1"
            opacity=".21"
          />
          <rect x="370" y="61" width="60" height="17" rx="8.5" fill="#060606" />
          <circle cx="420" cy="69.5" r="3" fill="#242424" />
          <circle cx="420" cy="69.5" r="1.1" fill="#505050" />
          <text
            x="307"
            y="74"
            fill="#f5f5f5"
            fontFamily="Arial, sans-serif"
            fontSize="9"
            fontWeight="700"
          >
            9:41
          </text>
          <path d="M464 72v-3m4 3v-5m4 5v-7" stroke="#f5f5f5" strokeWidth="2" />
          <rect
            x="480"
            y="65"
            width="13"
            height="7"
            rx="2"
            fill="none"
            stroke="#f5f5f5"
            strokeWidth=".8"
          />
          <rect x="482" y="67" width="9" height="3" rx=".7" fill="#f5f5f5" />
          <path d="M494 67v3" stroke="#f5f5f5" strokeWidth="1.4" />

          <g opacity={1 - mapReveal}>
            <text
              x="400"
              y="106"
              fill={red}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="13"
              fontWeight="800"
              letterSpacing="1.5"
            >
              CANADA’S #1
            </text>
            <text
              x="400"
              y="125"
              fill="white"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="11"
              fontWeight="700"
              letterSpacing="1"
            >
              REAL ESTATE PODCAST
            </text>
            <image
              href={podcastCover.src}
              x="308"
              y="148"
              width="184"
              height="184"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${uid}-cover)`}
            />
            <rect
              x="308"
              y="148"
              width="184"
              height="184"
              rx="9"
              fill="none"
              stroke="#fff"
              strokeOpacity=".16"
            />
            <text
              x="308"
              y="352"
              fill="white"
              fontFamily="Arial, sans-serif"
              fontSize="12.5"
              fontWeight="800"
              letterSpacing=".25"
            >
              THE CANADIAN REAL
            </text>
            <text
              x="308"
              y="369"
              fill="white"
              fontFamily="Arial, sans-serif"
              fontSize="12.5"
              fontWeight="800"
              letterSpacing=".25"
            >
              ESTATE INVESTOR
            </text>
            <text
              x="308"
              y="388"
              fill="#bbb"
              fontFamily="Arial, sans-serif"
              fontSize="9.3"
            >
              Daniel Foch &amp; Nick Hill
            </text>
            <g aria-hidden="true" fill={red}>
              {waveform.map((height, index) => (
                <rect
                  key={index}
                  x={310 + index * 7.6}
                  y={420 - height * 0.29}
                  width="3.6"
                  height={height * 0.58}
                  rx="1.8"
                  className={animate ? `${uid}-soundbar` : undefined}
                  style={{
                    animationDelay: `${-index * 0.17}s`,
                    animationDuration: `${1.05 + (index % 5) * 0.17}s`,
                  }}
                  opacity={index % 4 === 0 ? 0.62 : 1}
                />
              ))}
            </g>
            <path
              d="M308 449h184"
              stroke="#4a4a4a"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M308 449h82"
              stroke={red}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="390" cy="449" r="3" fill={red} />
            <g aria-hidden="true">
              <path
                d="M348 479v14m14-14-11 7 11 7zM452 479v14m-14-14 11 7-11 7z"
                fill="white"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="400" cy="486" r="22" fill={red} />
              <path d="m395 477 14 9-14 9z" fill="white" />
            </g>
            <text
              x="400"
              y="524"
              fill="#d5d5d5"
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="8.7"
              letterSpacing="1.3"
            >
              400+ EPISODES. ALL FREE.
            </text>
            <rect x="371" y="535" width="58" height="3" rx="1.5" fill="#aaa" />
          </g>

          {/* The same screen becomes a property map before one selection becomes the site. */}
          <g opacity={mapReveal} clipPath={`url(#${uid}-map-screen)`}>
            <rect x="290" y="87" width="220" height="455" fill="#e7e7e5" />
            <path
              d="M288 174h224M288 238h224M288 302h224M288 366h224M288 430h224M336 136v339M405 136v339M474 136v339"
              stroke="white"
              strokeWidth="12"
              fill="none"
            />
            <path
              d="M287 395 512 206"
              stroke="white"
              strokeWidth="19"
              fill="none"
            />
            <path
              d="M287 395 512 206"
              stroke="#c6c6c4"
              strokeWidth=".7"
              strokeDasharray="3 4"
              fill="none"
            />
            {[155, 196, 260, 324, 388, 446].map((y, row) =>
              [304, 351, 421, 489].map((x, column) => (
                <g
                  key={`${row}-${column}`}
                  fill={(row + column) % 3 === 0 ? "#d0d0ce" : "#d8d8d6"}
                  stroke="#bdbdbb"
                  strokeWidth=".6"
                >
                  <rect
                    x={x}
                    y={y}
                    width={column === 3 ? 14 : 25}
                    height="14"
                    rx="1"
                  />
                  <path
                    d={`M${x + 12} ${y - 2}v18`}
                    fill="none"
                    stroke="#c1c1bf"
                  />
                </g>
              )),
            )}
            <path
              d="M292 447c58-43 84-13 114 16 33 31 69 20 104 2v78H290Z"
              fill="#d1d1cf"
            />
            <path
              d="M291 461c60-43 84-12 111 13 32 31 69 21 111 6"
              stroke="#f7f7f5"
              strokeWidth="3"
              fill="none"
            />
            <g
              fill="#808080"
              fontFamily="monospace"
              fontSize="6"
              letterSpacing=".8"
            >
              <text x="350" y="177">
                KING STREET
              </text>
              <text x="350" y="370">
                QUEEN STREET
              </text>
              <text x="475" y="425" transform="rotate(-90 475 425)">
                MAIN AVENUE
              </text>
            </g>
            {[
              [322, 157],
              [365, 202],
              [443, 158],
              [490, 219],
              [309, 265],
              [371, 280],
              [449, 278],
              [489, 326],
              [324, 345],
              [356, 389],
              [427, 398],
              [488, 416],
              [305, 414],
              [438, 218],
              [451, 342],
              [383, 448],
            ].map(([x, y], index) => (
              <g key={index}>
                <circle cx={x} cy={y} r="7" fill="white" opacity=".9" />
                <circle
                  cx={x}
                  cy={y}
                  r={index % 3 === 0 ? 4 : 3}
                  fill={index % 3 === 0 ? red : "#555"}
                />
              </g>
            ))}
            <path
              d="m383 310 17-9 17 9-17 9Z"
              fill={red}
              fillOpacity=".12"
              stroke={red}
              strokeWidth="1.4"
            />
            <circle cx="400" cy="310" r="22" fill={red} opacity=".12" />
            <circle
              cx="400"
              cy="310"
              r="13"
              fill={red}
              stroke="white"
              strokeWidth="3"
            />
            <text
              x="400"
              y="314"
              fill="white"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize="11"
              fontWeight="800"
            >
              1
            </text>

            <rect
              x="299"
              y="96"
              width="202"
              height="48"
              rx="8"
              fill="white"
              stroke="#d4d4d4"
              strokeWidth=".6"
            />
            <text
              x="310"
              y="114"
              fill={ink}
              fontFamily="Arial, sans-serif"
              fontSize="13"
              fontWeight="800"
            >
              realist<tspan fill={red}>.ca</tspan>
            </text>
            <text
              x="310"
              y="132"
              fill="#707070"
              fontFamily="Arial, sans-serif"
              fontSize="8"
            >
              Find your next investment.
            </text>
            <circle cx="483" cy="117" r="8" fill={red} />
            <path d="m480 114 6 6m0-6-6 6" stroke="white" strokeWidth="1.2" />
            <rect x="300" y="473" width="200" height="54" rx="8" fill="#222" />
            <circle cx="317" cy="490" r="5" fill={red} />
            <text
              x="329"
              y="493"
              fill="white"
              fontFamily="Arial, sans-serif"
              fontSize="9"
              fontWeight="700"
            >
              MULTIPLEX POTENTIAL
            </text>
            <text
              x="311"
              y="513"
              fill="#cacaca"
              fontFamily="monospace"
              fontSize="7.2"
              letterSpacing=".4"
            >
              SELECT A PROPERTY. SEE THE MATH.
            </text>
            <rect x="371" y="535" width="58" height="3" rx="1.5" fill="#666" />
          </g>

          <path
            d="M372 550h15m26 0h15"
            stroke="#353535"
            strokeWidth="2"
            strokeDasharray="1 3"
          />
          <g
            opacity={(1 - network) * (1 - education)}
            fontFamily="monospace"
            fill={graphite}
          >
            <path
              d="M552 214h54v47"
              fill="none"
              stroke="#aaa"
              strokeWidth=".8"
            />
            <circle cx="552" cy="214" r="3" fill={red} />
            <text x="575" y="282" fontSize="36" fontFamily="Georgia, serif">
              400<tspan fill={red}>+</tspan>
            </text>
            <text x="575" y="300" fontSize="9" letterSpacing="1.5">
              FREE EPISODES
            </text>
            <text x="575" y="321" fontSize="8" fill="#777">
              PRESS PLAY.
            </text>
            <text x="575" y="337" fontSize="8" fill="#777">
              BUILD CONFIDENCE.
            </text>
          </g>
          {/* A mortarboard drops into place as listening becomes a structured education. */}
          <g
            opacity={education}
            transform={`translate(0 ${-125 * (1 - capDrop)})`}
          >
            <path
              d="M335 36v32c38 20 92 20 130 0V36Z"
              fill="#242424"
              stroke="#111"
              strokeWidth="1.2"
            />
            <path
              d="M335 54v14c38 20 92 20 130 0V54c-36 17-95 17-130 0Z"
              fill="#383838"
            />
            <path
              d="m272 23 128-47 128 47-128 49Z"
              fill="#252525"
              stroke="#111"
              strokeWidth="1.5"
            />
            <path
              d="m276 23 124-43 124 43-124 45Z"
              fill="none"
              stroke="#595959"
              strokeWidth=".7"
            />
            <path
              d="m400 22 103 37v54"
              stroke={red}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <circle
              cx="400"
              cy="22"
              r="5"
              fill="#454545"
              stroke="#171717"
              strokeWidth="1"
            />
            <circle cx="503" cy="111" r="4" fill={darkRed} />
            <path d="m503 113-7 23h14Z" fill={red} />
            <path d="M501 117v16m4-16v16" stroke={darkRed} strokeWidth=".7" />
          </g>
        </g>

        <g opacity={education} transform={`translate(0 ${(1 - capDrop) * 20})`}>
          <path
            d="M553 230h52v35"
            fill="none"
            stroke="#b7b7b7"
            strokeWidth=".8"
          />
          <circle cx="553" cy="230" r="3" fill={red} />
          <text
            x="572"
            y="291"
            fill={ink}
            fontFamily="Georgia, serif"
            fontSize="40"
          >
            100<tspan fill={red}>+</tspan>
          </text>
          <text
            x="572"
            y="313"
            fill={ink}
            fontFamily="monospace"
            fontSize="10"
            letterSpacing="2"
          >
            HOURS
          </text>
          <text
            x="572"
            y="339"
            fill="#626262"
            fontFamily="Arial, sans-serif"
            fontSize="12"
            fontWeight="700"
          >
            FREE MULTIPLEX
          </text>
          <text
            x="572"
            y="357"
            fill="#626262"
            fontFamily="Arial, sans-serif"
            fontSize="12"
            fontWeight="700"
          >
            EDUCATION
          </text>
          <path d="M574 374h72" stroke={red} strokeWidth="2" />
        </g>

        <g opacity={networkOpacity} textAnchor="middle" fill={graphite}>
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
        {/* Ranked examples sit above the map as the underwriting resolves. */}
        <g opacity={analysisOpacity}>
          <g transform={`translate(0 ${(1 - mapReveal) * 22})`}>
            <text
              x="126"
              y="91"
              fill={ink}
              fontFamily="Georgia, serif"
              fontSize="25"
            >
              A map. Then the math.
            </text>
            <text
              x="127"
              y="113"
              fill="#737373"
              fontFamily="monospace"
              fontSize="8.7"
              letterSpacing="1.2"
            >
              FIND YOUR NEXT INVESTMENT
            </text>
            <path
              d="M361 356C460 356 466 205 519 205"
              fill="none"
              stroke={red}
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity=".75"
            />
            <circle cx="519" cy="205" r="3" fill={red} />
            <text
              x="526"
              y="158"
              fill={ink}
              fontFamily="monospace"
              fontSize="9"
              fontWeight="700"
              letterSpacing="1.2"
            >
              OPPORTUNITIES, RANKED.
            </text>
            {[
              {
                title: "Multiplex potential",
                metric: "6.2%",
                detail: "MODELED CAP RATE",
                subtitle: "Illustrative scenario",
                primary: true,
              },
              {
                title: "Cashflow candidate",
                metric: "+$420",
                detail: "/ MONTH SCENARIO",
                subtitle: "Illustrative scenario",
                primary: false,
              },
              {
                title: "Value-add opportunity",
                metric: "3 → 6",
                detail: "POTENTIAL UNITS",
                subtitle: "Illustrative • approvals required",
                primary: false,
              },
            ].map((deal, index) => (
              <g
                key={deal.title}
                transform={`translate(518 ${176 + index * 100})`}
              >
                <rect
                  x="3"
                  y="5"
                  width="229"
                  height="88"
                  rx="11"
                  fill="#202020"
                  opacity=".05"
                />
                <rect
                  width="229"
                  height="88"
                  rx="11"
                  fill={deal.primary ? "#252525" : "#fbfbfa"}
                  stroke={deal.primary ? "#252525" : "#cececc"}
                  strokeWidth=".8"
                />
                <circle
                  cx="19"
                  cy="20"
                  r="9"
                  fill={deal.primary ? red : "#e4e4e2"}
                />
                <text
                  x="19"
                  y="23.5"
                  textAnchor="middle"
                  fill={deal.primary ? "white" : "#424242"}
                  fontFamily="Arial, sans-serif"
                  fontSize="9"
                  fontWeight="800"
                >
                  {index + 1}
                </text>
                <text
                  x="36"
                  y="24"
                  fill={deal.primary ? "white" : ink}
                  fontFamily="Arial, sans-serif"
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {deal.title}
                </text>
                <text
                  x="14"
                  y="58"
                  fill={deal.primary ? red : ink}
                  fontFamily="Arial, sans-serif"
                  fontSize="26"
                  fontWeight="700"
                  letterSpacing="-1"
                >
                  {deal.metric}
                </text>
                <text
                  x={index === 1 ? 107 : 93}
                  y="55"
                  fill={deal.primary ? "#ddd" : "#555"}
                  fontFamily="monospace"
                  fontSize="7.1"
                  letterSpacing=".25"
                >
                  {deal.detail}
                </text>
                <text
                  x="14"
                  y="75"
                  fill={deal.primary ? "#b8b8b8" : "#777"}
                  fontFamily="Arial, sans-serif"
                  fontSize="8.5"
                >
                  {deal.subtitle}
                </text>
              </g>
            ))}
            <g transform="translate(116 470)">
              <rect
                width="166"
                height="54"
                rx="9"
                fill="white"
                stroke="#d1d1cf"
                strokeWidth=".7"
              />
              <circle cx="17" cy="17" r="4" fill={red} />
              <text
                x="29"
                y="20"
                fill={ink}
                fontFamily="Arial, sans-serif"
                fontSize="10.5"
                fontWeight="700"
              >
                Analyze deals instantly.
              </text>
              <text
                x="12"
                y="39"
                fill="#777"
                fontFamily="monospace"
                fontSize="7.4"
              >
                PRICE + RENT + FINANCING
              </text>
            </g>
            <text
              x="526"
              y="492"
              fill="#737373"
              fontFamily="monospace"
              fontSize="7.5"
              letterSpacing=".7"
            >
              ILLUSTRATIVE ANALYSIS • NOT LIVE LISTINGS
            </text>
          </g>
        </g>

        {/* This projected outline exactly matches the parcel in MultiplexScene. */}
        <g opacity={mapReveal * smooth((progress - 3.75) / 0.08)}>
          <polygon
            points={parcelPoints}
            fill="#e9e9e9"
            stroke={red}
            strokeWidth={2 - parcelGrow * 1.2}
          />
          <circle
            cx="361"
            cy="356"
            r={10 * (1 - parcelGrow)}
            fill={red}
            opacity={1 - parcelGrow}
          />
        </g>
      </g>
    </svg>
  );
}
