import { useId } from "react";

type Props = { progress: number };

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const reveal = (value: number, start: number, end: number) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

const INK = "#282828";
const RED = "#be1730";
const MUTED = "#696969";

function OperationIcon({ kind }: { kind: "leasing" | "care" | "reporting" }) {
  if (kind === "leasing") {
    return (
      <g
        stroke={RED}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 13 13 3l11 10M5 11v15h16V11M10 26V16h6v10" />
        <path d="m26 9 3 3 5-6" />
      </g>
    );
  }
  if (kind === "care") {
    return (
      <g
        stroke={RED}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 2 28 7v9c0 7-12 13-12 13S4 23 4 16V7L16 2Z" />
        <path d="m10 15 4 4 8-9" />
      </g>
    );
  }
  return (
    <g
      stroke={RED}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2h17l6 6v22H6ZM22 2v7h7M12 22v-4m6 4v-8m6 8V12" />
    </g>
  );
}

/** An illustrative operating dashboard, drawn and undone with the native scroll. */
export default function OperatingScene({ progress }: Props) {
  const id = useId().replace(/:/g, "");
  const enter = reveal(progress, 0, 0.24);
  const chart = reveal(progress, 0.12, 0.86);
  const insight = reveal(progress, 0.56, 0.98);
  const chartPath =
    "M304 321 C333 321 335 312 359 310 S389 315 414 294 S446 296 466 278 S493 279 518 257 S546 262 571 235 S604 238 627 212 S659 216 693 177";
  const operations = [
    {
      kind: "leasing" as const,
      title: "Leasing & renewals",
      detail: "Keep the right tenants.",
      label: "PROPERTY MANAGEMENT",
    },
    {
      kind: "care" as const,
      title: "Care & maintenance",
      detail: "Protect what you built.",
      label: "LONG-TERM STEWARDSHIP",
    },
    {
      kind: "reporting" as const,
      title: "Insight & reporting",
      detail: "Make informed decisions.",
      label: "ASSET MANAGEMENT",
    },
  ];

  return (
    <svg
      viewBox="0 0 800 620"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`operating-title-${id} operating-desc-${id}`}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        overflow: "visible",
      }}
    >
      <title id={`operating-title-${id}`}>
        Long-term property and asset management
      </title>
      <desc id={`operating-desc-${id}`}>
        A multiplex becomes an operating dashboard. A rising illustrative
        performance chart connects leasing and renewals, care and maintenance,
        and asset reporting. AI-assisted insights work alongside human support.
        The chart uses an illustrative index, not actual or guaranteed
        investment returns.
      </desc>
      <defs>
        <filter
          id={`operating-shadow-${id}`}
          x="-25%"
          y="-25%"
          width="150%"
          height="160%"
        >
          <feDropShadow
            dx="0"
            dy="13"
            stdDeviation="15"
            floodColor="#242424"
            floodOpacity=".09"
          />
        </filter>
        <linearGradient id={`operating-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={RED} stopOpacity=".13" />
          <stop offset="1" stopColor={RED} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`operating-chart-${id}`}>
          <rect x="303" y="162" width={391 * chart} height="179" />
        </clipPath>
      </defs>

      <g
        opacity={enter}
        transform={`translate(0 ${30 * (1 - enter)})`}
        fontFamily="Inter, Arial, sans-serif"
      >
        <path
          d="M45 584H755M44 578v12M756 578v12"
          stroke="#d3d3d3"
          strokeWidth=".8"
        />
        <text
          x="400"
          y="604"
          textAnchor="middle"
          fill={MUTED}
          fontFamily="'JetBrains Mono', monospace"
          fontSize="8"
          letterSpacing="1.5"
        >
          YOUR TEAM. THROUGH EVERY CHAPTER.
        </text>

        <g filter={`url(#operating-shadow-${id})`}>
          <rect
            x="58"
            y="66"
            width="684"
            height="418"
            rx="13"
            fill="#fff"
            stroke="#d9d9d9"
          />
        </g>
        <path
          d="M72 66H728a14 14 0 0 1 14 14v42H58V80a14 14 0 0 1 14-14Z"
          fill={INK}
        />
        <rect x="79" y="85" width="20" height="20" rx="4" fill={RED} />
        <path
          d="M84 100V90h5c5 0 5 6 0 6h-5m5 0 5 4"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="110"
          y="99"
          fill="white"
          fontSize="14"
          fontWeight="650"
          letterSpacing="-.4"
        >
          realist
        </text>
        <path d="M155 85v20" stroke="#5b5b5b" />
        <text x="169" y="98" fill="#d8d8d8" fontSize="9" letterSpacing="1.5">
          ASSET MANAGEMENT
        </text>
        <circle cx="641" cy="95" r="3" fill="#ff334b" />
        <text x="652" y="98" fill="#e7e7e7" fontSize="9" letterSpacing="1">
          OPERATE
        </text>

        <text x="82" y="155" fill={MUTED} fontSize="8" letterSpacing="1.5">
          THE COMPLETED MULTIPLEX
        </text>
        <text
          x="82"
          y="180"
          fill={INK}
          fontSize="19"
          fontWeight="650"
          letterSpacing="-.6"
        >
          Built for the long run.
        </text>

        {/* A miniature of the completed asset anchors the dashboard to the journey. */}
        <g transform="translate(94 205)">
          <ellipse
            cx="78"
            cy="134"
            rx="90"
            ry="21"
            fill="#242424"
            opacity=".055"
          />
          <path
            d="m-8 127 83 38 95-50-84-38Z"
            fill="#f0f0f0"
            stroke="#d9d9d9"
          />
          <path
            d="m14 43 65 29v77l-65-30Z"
            fill="#b8b8b8"
            stroke="#555"
            strokeWidth=".8"
          />
          <path
            d="m79 72 65-36v76l-65 37Z"
            fill="#e1e1e1"
            stroke="#555"
            strokeWidth=".8"
          />
          <path
            d="m14 43 64-36 66 29-65 36Z"
            fill="#ededed"
            stroke="#555"
            strokeWidth=".8"
          />
          <path
            d="m20 42 59-30 58 25-58 30Z"
            fill="#a4a4a4"
            stroke="#555"
            strokeWidth=".6"
          />
          {[0, 1, 2].map((floor) => (
            <g key={floor} transform={`translate(0 ${floor * 25})`}>
              <path
                d="m24 54 16 7v16l-16-7Zm27 12 16 7v16l-16-7Z"
                fill="#494949"
              />
              <path
                d="m89 78 17-10v16L89 94Zm28-15 17-9v16l-17 9Z"
                fill="#5e5e5e"
              />
              <path
                d="m23 72 45 20m21 5 46-26"
                stroke="#808080"
                strokeWidth=".6"
              />
              <path
                d="m28 57 1 11m28 1 1 11m37 1v9m28-24v9"
                stroke="#d0d0d0"
                strokeWidth=".8"
              />
            </g>
          ))}
          <path d="m65 120 14 7v22l-14-7Z" fill={RED} />
          <path d="m61 144 18 8 17-10v5l-17 10-18-8Z" fill="#aaa" />
          <path
            d="M14 69 79 98l65-36M14 94l65 29 65-36"
            stroke="#999"
            strokeWidth=".6"
          />
        </g>
        <rect x="85" y="375" width="167" height="25" rx="12.5" fill="#f2f2f2" />
        <circle cx="102" cy="387.5" r="6" fill="#e9e9e9" />
        <path
          d="m99 387 2 2 4-4"
          stroke={RED}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="114" y="391" fill={INK} fontSize="8.5" fontWeight="500">
          Supported. Year after year.
        </text>

        <path d="M277 152V400" stroke="#e9e9e9" />
        <text
          x="306"
          y="154"
          fill={INK}
          fontSize="10"
          fontWeight="650"
          letterSpacing=".7"
        >
          LONG-TERM PERFORMANCE
        </text>
        <text
          x="697"
          y="154"
          textAnchor="end"
          fill={MUTED}
          fontSize="7.5"
          letterSpacing=".9"
        >
          ILLUSTRATIVE INDEX
        </text>
        {[185, 231, 276, 322].map((y, i) => (
          <g key={y}>
            <path
              d={`M303 ${y}H700`}
              stroke="#e6e6e6"
              strokeWidth=".8"
              strokeDasharray={i === 3 ? undefined : "3 5"}
            />
            <text
              x="297"
              y={y + 2.5}
              textAnchor="end"
              fill="#858585"
              fontSize="7"
              fontFamily="'JetBrains Mono', monospace"
            >
              {130 - i * 10}
            </text>
          </g>
        ))}
        <g clipPath={`url(#operating-chart-${id})`}>
          <path
            d={`${chartPath} L693 323H304Z`}
            fill={`url(#operating-fill-${id})`}
          />
        </g>
        <path
          d={chartPath}
          stroke={RED}
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - chart}
        />
        <circle
          cx="304"
          cy="321"
          r="3.5"
          fill="#fff"
          stroke={RED}
          strokeWidth="1.5"
          opacity={chart}
        />
        <g opacity={insight}>
          <circle cx="693" cy="177" r="9" fill={RED} opacity=".1" />
          <circle
            cx="693"
            cy="177"
            r="4"
            fill={RED}
            stroke="white"
            strokeWidth="2"
          />
        </g>
        <text x="304" y="342" fill={MUTED} fontSize="7.5" letterSpacing=".5">
          TODAY
        </text>
        <text
          x="695"
          y="342"
          textAnchor="end"
          fill={MUTED}
          fontSize="7.5"
          letterSpacing=".5"
        >
          THE LONG VIEW
        </text>

        <g opacity={insight} transform={`translate(0 ${7 * (1 - insight)})`}>
          <rect
            x="304"
            y="362"
            width="393"
            height="39"
            rx="7"
            fill="#f6f6f6"
            stroke="#e7e7e7"
          />
          <path
            d="m322 370 2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Zm12-1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"
            fill={RED}
          />
          <text x="346" y="378" fill={INK} fontSize="9" fontWeight="600">
            AI-assisted insights. Human support.
          </text>
          <text x="346" y="391" fill={MUTED} fontSize="8">
            A clearer picture of your asset, over time.
          </text>
        </g>

        {operations.map((operation, index) => {
          const visible = reveal(
            progress,
            0.25 + index * 0.12,
            0.63 + index * 0.12,
          );
          return (
            <g
              key={operation.kind}
              opacity={visible}
              transform={`translate(${78 + index * 218} ${425 + 22 * (1 - visible)})`}
            >
              <rect
                width="208"
                height="137"
                rx="10"
                fill="#fff"
                stroke="#d9d9d9"
                filter={`url(#operating-shadow-${id})`}
              />
              <path d="M17 0h31" stroke={RED} strokeWidth="2" />
              <g transform="translate(17 16)">
                <OperationIcon kind={operation.kind} />
              </g>
              <text
                x="18"
                y="71"
                fill={INK}
                fontSize="12.5"
                fontWeight="650"
                letterSpacing="-.3"
              >
                {operation.title}
              </text>
              <text x="18" y="90" fill={MUTED} fontSize="9">
                {operation.detail}
              </text>
              <text
                x="18"
                y="118"
                fill={MUTED}
                fontSize="6.8"
                letterSpacing="1"
              >
                {operation.label}
              </text>
              <path
                d="m181 113 5 3-5 3m-7-3h12"
                stroke={RED}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
