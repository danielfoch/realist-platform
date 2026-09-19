import { useId } from "react";

type Point = [number, number];
type Props = { progress?: number; hero?: boolean };
const C = {
  ink: "#212b25",
  forest: "#285542",
  lime: "#c8f16a",
  ivory: "#f5f3eb",
  line: "#748175",
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ramp = (n: number, a: number, b: number) => {
  const v = clamp((n - a) / (b - a));
  return v * v * (3 - 2 * v);
};
const P = (x: number, y: number, z = 0): Point => [
  415 + (x - y) * 12,
  509 - (x + y) * 6 - z * 20,
];
const points = (v: Point[]) => v.map((p) => p.join(",")).join(" ");
const top = (x1: number, y1: number, x2: number, y2: number, z = 0) =>
  points([P(x1, y1, z), P(x2, y1, z), P(x2, y2, z), P(x1, y2, z)]);
const front = (x1: number, x2: number, y: number, z1: number, z2: number) =>
  points([P(x1, y, z1), P(x2, y, z1), P(x2, y, z2), P(x1, y, z2)]);
const side = (x: number, y1: number, y2: number, z1: number, z2: number) =>
  points([P(x, y1, z1), P(x, y2, z1), P(x, y2, z2), P(x, y1, z2)]);

function Line({
  a,
  b,
  color = C.line,
  width = 0.7,
  dash,
}: {
  a: Point;
  b: Point;
  color?: string;
  width?: number;
  dash?: string;
}) {
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dash}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const [cx, cy] = P(x, y);
  return (
    <g transform={`translate(${cx},${cy}) scale(${size})`}>
      <ellipse cx="10" cy="0" rx="28" ry="10" fill={C.ink} opacity=".08" />
      <path d="M-2 1 L-2 -48 L2 -48 L2 0 Z" fill="#5d6850" />
      <path
        d="M0 -21 L-12 -39 M0 -30 L12 -48"
        stroke="#5d6850"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M-27 -48 C-34 -64 -18 -78 -10 -82 C-9 -97 13 -98 20 -85 C36 -82 39 -64 29 -55 C31 -38 8 -30 -2 -36 C-17 -30 -31 -36 -27 -48Z"
        fill="#739569"
      />
      <path
        d="M-10 -82 C-20 -68 -16 -48 -2 -36 C-17 -30 -31 -36 -27 -48 C-34 -64 -18 -78 -10 -82Z"
        fill="#50765a"
      />
      <path
        d="M0 -88 C14 -90 24 -78 24 -65 C16 -68 3 -72 0 -88Z"
        fill="#9bb17b"
        opacity=".7"
      />
      <path
        d="M0 -44 L0 -69 M0 -53 L12 -64 M0 -61 L-9 -73"
        fill="none"
        stroke="#365b45"
        strokeWidth=".7"
        opacity=".5"
      />
    </g>
  );
}

/** A continuous, reversible architectural drawing, driven entirely by scroll progress. */
export default function MultiplexScene({ progress = 6, hero = false }: Props) {
  const id = useId().replace(/:/g, "");
  const q = hero ? 6 : progress;
  const plan = ramp(q, 2.65, 3.35);
  const height = 0.025 + 0.2 * ramp(q, 3.5, 4.25) + 0.775 * ramp(q, 4.7, 5.38);
  const shell = ramp(q, 5.08, 5.85);
  const landscape = ramp(q, 5.3, 5.95);
  const dimensionOpacity = hero ? 0.48 : 0.84 - shell * 0.4;
  const floors = [0, 1, 2];
  const titleId = `multiplex-title-${id}`;
  const descId = `multiplex-desc-${id}`;
  return (
    <svg
      viewBox="0 0 800 620"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      style={{
        width: "100%",
        height: "100%",
        overflow: "visible",
        display: "block",
      }}
    >
      <title id={titleId}>
        A six-unit multiplex, from parcel to completed property
      </title>
      <desc id={descId}>
        An isometric architectural illustration develops from a measured parcel
        and floor plan through the structure to a three-storey building, with
        balconies, landscaping, and a shared entrance.
      </desc>
      <defs>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#3c5046" />
          <stop offset="1" stopColor="#1d3026" />
        </linearGradient>
        <linearGradient id={`paper-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#faf9f3" />
          <stop offset="1" stopColor="#e7e7dc" />
        </linearGradient>
        <filter
          id={`shadow-${id}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* A quiet cadastral context keeps the architecture attached to a real place. */}
      <g stroke="#a9afa1" strokeWidth=".7" opacity=".28">
        <polygon points={top(-7, -9, 26, 35)} strokeDasharray="3 5" />
        <polygon
          points={top(-7, -9, 26, -3)}
          fill="#d9ddd1"
          fillOpacity=".28"
        />
        <polygon
          points={top(24, -9, 29, 35)}
          fill="#d9ddd1"
          fillOpacity=".28"
        />
        {[-5, 7, 19, 31].map((y) => (
          <Line key={y} a={P(-7, y)} b={P(-2, y)} color="#a9afa1" />
        ))}
        <Line a={P(-7, -6)} b={P(29, -6)} color="#afb4a6" dash="7 8" />
        <Line a={P(26.5, -9)} b={P(26.5, 35)} color="#afb4a6" dash="7 8" />
        <polygon points={top(-8, 7, -3, 16)} />
        <polygon points={top(-8, 20, -3, 29)} />
        <polygon points={top(3, 32, 16, 37)} />
      </g>
      <g
        transform="translate(0,9)"
        opacity={0.1 + shell * 0.05}
        filter={`url(#shadow-${id})`}
      >
        <polygon points={top(0, 0, 21, 30)} fill={C.ink} />
      </g>
      <polygon points={front(0, 21, 0, -0.42, 0)} fill="#d3d7c7" />
      <polygon points={side(0, 0, 30, -0.42, 0)} fill="#bcc6b1" />
      <polygon
        points={top(0, 0, 21, 30)}
        fill="#e7ebdc"
        stroke="#b3bea4"
        strokeWidth=".8"
      />
      <polygon
        points={top(0.7, 0.7, 20.3, 29.3)}
        stroke="#83986e"
        strokeWidth=".65"
        strokeDasharray="3 4"
        opacity=".6"
      />
      <g opacity={0.35 + 0.65 * landscape}>
        <polygon points={top(2, 1.6, 19, 5.8)} fill="#f5f4eb" />
        <polygon points={top(8.7, 0, 11.5, 7)} fill="#f5f4eb" />
        <polygon points={top(17.5, 6, 19.4, 26)} fill="#f5f4eb" />
        {[3.1, 4.7, 6.3, 13.8, 15.4, 17].map((x) => (
          <Line
            key={x}
            a={P(x, 1.6)}
            b={P(x, 5.8)}
            color="#d5d8cb"
            width={0.5}
          />
        ))}
        {[8, 10, 12, 14, 16, 18, 20, 22, 24].map((y) => (
          <Line
            key={y}
            a={P(17.5, y)}
            b={P(19.4, y)}
            color="#d5d8cb"
            width={0.5}
          />
        ))}
      </g>

      {/* Far-side planting is behind the building in the isometric depth order. */}
      <g opacity={landscape}>
        <Tree x={19.4} y={26.6} size={0.62} />
        <Tree x={19.4} y={12.9} size={0.77} />
      </g>

      {/* Ground floor plan: room divisions, stairs, door arcs and glazing. */}
      <g
        opacity={plan * (1 - ramp(q, 5.12, 5.5))}
        stroke={C.forest}
        strokeWidth="1.2"
      >
        <polygon
          points={top(3, 7, 17, 22, 0.045)}
          fill="#f6f6ec"
          fillOpacity=".54"
        />
        <polygon
          points={top(3.35, 7.35, 16.65, 21.65, 0.045)}
          strokeWidth=".65"
        />
        <Line
          a={P(10, 7, 0.05)}
          b={P(10, 22, 0.05)}
          color={C.forest}
          width={1.2}
        />
        <Line
          a={P(3, 14.5, 0.05)}
          b={P(17, 14.5, 0.05)}
          color={C.forest}
          width={1.2}
        />
        <Line
          a={P(6.5, 14.5, 0.05)}
          b={P(6.5, 22, 0.05)}
          color={C.forest}
          width={1.2}
        />
        <Line
          a={P(13.4, 14.5, 0.05)}
          b={P(13.4, 22, 0.05)}
          color={C.forest}
          width={1.2}
        />
        <polygon points={top(8.7, 8.3, 11.2, 13.6, 0.06)} strokeWidth=".65" />
        {[8.8, 9.4, 10, 10.6, 11.2, 11.8, 12.4, 13].map((y) => (
          <Line
            key={y}
            a={P(8.7, y, 0.06)}
            b={P(11.2, y, 0.06)}
            color={C.forest}
            width={0.55}
          />
        ))}
        {[4.2, 11.6].map((x) => (
          <polygon
            key={x}
            points={top(x, 8.2, x + 3.1, 10.1, 0.06)}
            strokeWidth=".55"
            fill="#c8d4b7"
            fillOpacity=".3"
          />
        ))}
        {[4.1, 14.1].map((x) => (
          <polygon
            key={x}
            points={top(x, 17.8, x + 1.8, 20.7, 0.06)}
            strokeWidth=".55"
          />
        ))}
      </g>

      {/* The restrained wire structure rises first, then acquires floors and a facade. */}
      <g opacity={plan * (1 - shell * 0.94)}>
        {[0, 3.2, 6.4, 9.6].map((z, i) => (
          <g key={z}>
            <polygon
              points={top(3, 7, 17, 22, z * height)}
              fill={i === 0 ? "#e2e5d7" : "#e9ecdf"}
              fillOpacity={
                0.15 + ramp(q, 4.95 + i * 0.08, 5.2 + i * 0.08) * 0.48
              }
              stroke={C.forest}
              strokeWidth={i === 0 ? 1.2 : 0.8}
            />
            {i > 0 && (
              <polygon
                points={front(3, 17, 7, (z - 0.15) * height, z * height)}
                fill="#a4b298"
                opacity={ramp(q, 4.95 + i * 0.08, 5.2 + i * 0.08)}
              />
            )}
          </g>
        ))}
        {[3, 10, 17].map((x) =>
          [7, 14.5, 22].map((y) => (
            <Line
              key={`${x}-${y}`}
              a={P(x, y)}
              b={P(x, y, 9.6 * height)}
              color={C.forest}
              width={1.6}
            />
          )),
        )}
        {[0, 1, 2].map((f) => (
          <g key={f} opacity={ramp(q, 4.7, 5.15)}>
            {[4.6, 6.2, 7.8, 9.4, 11, 12.6, 14.2, 15.8].map((x) => (
              <Line
                key={x}
                a={P(x, 7, f * 3.2 * height)}
                b={P(x, 7, (f * 3.2 + 3.05) * height)}
                color="#9c996f"
                width={1}
              />
            ))}
            {[8.6, 10.2, 11.8, 13.4, 15, 16.6, 18.2, 19.8, 21.4].map((y) => (
              <Line
                key={y}
                a={P(3, y, f * 3.2 * height)}
                b={P(3, y, (f * 3.2 + 3.05) * height)}
                color="#9c996f"
                width={1}
              />
            ))}
          </g>
        ))}
      </g>

      {/* Each storey resolves in sequence, with crisp architectural details. */}
      {floors.map((f) => {
        const z = f * 3.2;
        const visible = hero ? 1 : ramp(q, 5.1 + f * 0.2, 5.52 + f * 0.16);
        return (
          <g key={f} opacity={visible}>
            <polygon
              points={side(3, 7, 22, z, z + 3.2)}
              fill={f === 0 ? "#355943" : C.forest}
            />
            <polygon
              points={front(3, 17, 7, z, z + 3.2)}
              fill={`url(#paper-${id})`}
            />
            <polygon
              points={side(3, 7, 22, z, z + 0.1)}
              fill="#183b2b"
              opacity=".5"
            />
            <polygon
              points={front(3, 17, 7, z, z + 0.1)}
              fill="#bfc6b4"
              opacity=".5"
            />
            {[
              8.2, 8.8, 9.4, 10, 10.6, 11.2, 11.8, 12.4, 13, 13.6, 14.2, 14.8,
              15.4, 16, 16.6, 17.2, 17.8, 18.4, 19, 19.6, 20.2, 20.8, 21.4,
            ].map((y) => (
              <Line
                key={y}
                a={P(3, y, z + 0.15)}
                b={P(3, y, z + 3.1)}
                color="#779076"
                width={0.4}
              />
            ))}
            {[8.4, 13.2, 18].map((y) => (
              <g key={y}>
                <polygon
                  points={side(2.97, y, y + 2.5, z + 0.78, z + 2.54)}
                  fill="#122c20"
                />
                <polygon
                  points={side(2.94, y + 0.11, y + 2.39, z + 0.9, z + 2.43)}
                  fill="#577263"
                />
                <polygon
                  points={side(2.91, y + 0.14, y + 1.14, z + 0.93, z + 2.4)}
                  fill="#294837"
                />
                <Line
                  a={P(2.9, y + 1.24, z + 0.86)}
                  b={P(2.9, y + 1.24, z + 2.5)}
                  color="#b0b9a1"
                  width={0.6}
                />
                <Line
                  a={P(2.9, y, z + 0.76)}
                  b={P(2.9, y + 2.55, z + 0.76)}
                  color="#82967b"
                  width={1}
                />
              </g>
            ))}
            {[4.05, 11.45].map((x, idx) => (
              <g key={x}>
                <polygon
                  points={front(x, x + 4.1, 6.97, z + 0.61, z + 2.59)}
                  fill="#c4cabb"
                />
                <polygon
                  points={front(x + 0.11, x + 3.99, 6.92, z + 0.74, z + 2.5)}
                  fill={`url(#glass-${id})`}
                />
                <polygon
                  points={front(x + 0.17, x + 1.83, 6.9, z + 0.79, z + 2.45)}
                  fill={f === 1 && idx === 0 ? "#d8cf9f" : "#678475"}
                  fillOpacity={f === 1 && idx === 0 ? ".7" : ".32"}
                />
                <Line
                  a={P(x + 1.96, 6.86, z + 0.73)}
                  b={P(x + 1.96, 6.86, z + 2.5)}
                  color="#b5bda9"
                  width={1}
                />
                <Line
                  a={P(x + 0.14, 6.85, z + 0.73)}
                  b={P(x + 3.97, 6.85, z + 0.73)}
                  color="#455447"
                  width={1.3}
                />
                <polygon
                  points={front(x + 0.16, x + 3.96, 6.86, z + 2.36, z + 2.47)}
                  fill="#c7cebb"
                  fillOpacity=".35"
                />
                {f > 0 && (
                  <g>
                    <polygon
                      points={top(x - 0.2, 5.8, x + 4.3, 7, z + 0.51)}
                      fill="#ebece1"
                    />
                    <polygon
                      points={front(x - 0.2, x + 4.3, 5.8, z + 0.4, z + 0.51)}
                      fill="#b4bdac"
                    />
                    <polygon
                      points={side(x - 0.2, 5.8, 7, z + 0.4, z + 0.51)}
                      fill="#879982"
                    />
                    <polygon
                      points={front(
                        x - 0.12,
                        x + 4.22,
                        5.87,
                        z + 0.56,
                        z + 1.42,
                      )}
                      fill="#dfe7d3"
                      fillOpacity=".14"
                      stroke="#536851"
                      strokeWidth=".7"
                    />
                    <polygon
                      points={side(x - 0.12, 5.87, 6.94, z + 0.56, z + 1.42)}
                      fill="#dfe7d3"
                      fillOpacity=".12"
                      stroke="#536851"
                      strokeWidth=".7"
                    />
                    <Line
                      a={P(x + 2.08, 5.84, z + 0.56)}
                      b={P(x + 2.08, 5.84, z + 1.42)}
                      color="#536851"
                      width={0.65}
                    />
                  </g>
                )}
              </g>
            ))}
            <polygon
              points={front(9.05, 10.75, 6.99, z, z + 3.2)}
              fill="#d9dccd"
            />
            {[9.2, 9.42, 9.64, 9.86, 10.08, 10.3, 10.52].map((x) => (
              <Line
                key={x}
                a={P(x, 6.94, z + 0.1)}
                b={P(x, 6.94, z + 3.15)}
                color="#b9c0af"
                width={0.65}
              />
            ))}
            {f === 0 && (
              <g>
                <polygon
                  points={front(9.13, 10.67, 6.88, 0.06, 2.45)}
                  fill="#203e2b"
                />
                <polygon
                  points={front(9.28, 10.52, 6.84, 0.22, 2.3)}
                  fill="#536e57"
                />
                <Line
                  a={P(10.3, 6.8, 0.94)}
                  b={P(10.3, 6.8, 1.25)}
                  color="#d2d5c0"
                  width={1.5}
                />
                <polygon
                  points={top(8.76, 5.95, 11.03, 7, 2.54)}
                  fill="#3b5140"
                />
                <polygon
                  points={front(8.76, 11.03, 5.95, 2.47, 2.54)}
                  fill="#244131"
                />
                <polygon points={top(8.9, 6.3, 10.9, 7, 0.12)} fill="#c8cdbd" />
                <polygon
                  points={top(8.9, 5.95, 10.9, 6.3, 0.06)}
                  fill="#d6dacb"
                />
              </g>
            )}
          </g>
        );
      })}

      <g opacity={hero ? 1 : ramp(q, 5.64, 5.91)}>
        <polygon points={top(2.85, 6.85, 17.15, 22.15, 9.64)} fill="#697c68" />
        <polygon points={top(3.42, 7.42, 16.58, 21.58, 9.65)} fill="#9aa78e" />
        <polygon points={top(4.1, 8.1, 15.9, 20.9, 9.66)} fill="#87987f" />
        <polygon points={side(2.85, 6.85, 22.15, 9.45, 9.8)} fill="#274735" />
        <polygon points={front(2.85, 17.15, 6.85, 9.45, 9.8)} fill="#e4e6da" />
        <polygon points={top(2.85, 6.85, 17.15, 7.08, 9.8)} fill="#f5f4ed" />
        <polygon points={top(2.85, 7.08, 3.09, 22.15, 9.8)} fill="#b9c4b0" />
        <polygon points={top(3.09, 21.91, 17.15, 22.15, 9.8)} fill="#d8decf" />
        <polygon points={top(16.91, 7.08, 17.15, 21.91, 9.8)} fill="#d8decf" />
        <polygon points={side(7.7, 14.4, 17.8, 9.68, 10.08)} fill="#697e65" />
        <polygon points={front(7.7, 12.4, 14.4, 9.68, 10.08)} fill="#b8c2ab" />
        <polygon points={top(7.7, 14.4, 12.4, 17.8, 10.08)} fill="#d1d8c4" />
        {[8.2, 9, 9.8, 10.6, 11.4].map((x) => (
          <Line
            key={x}
            a={P(x, 14.7, 10.1)}
            b={P(x, 17.5, 10.1)}
            color="#84927b"
            width={0.65}
          />
        ))}
        <polygon
          points={top(5.1, 10.3, 7.4, 12.5, 9.7)}
          fill="#465f4a"
          stroke="#bbc5ae"
          strokeWidth=".65"
        />
        <Line a={P(6.25, 10.3, 9.72)} b={P(6.25, 12.5, 9.72)} color="#92a28b" />
      </g>

      <g opacity={landscape}>
        <polygon points={top(3, 3.9, 7.5, 5.7, 0.15)} fill="#a5b78c" />
        <polygon points={top(12.5, 3.9, 17, 5.7, 0.15)} fill="#a5b78c" />
        {[3.7, 5.1, 6.5, 13.2, 14.6, 16].map((x) => {
          const [cx, cy] = P(x, 4.8, 0.2);
          return (
            <g key={x}>
              <ellipse cx={cx} cy={cy - 3} rx="9" ry="5" fill="#718d5e" />
              <ellipse cx={cx - 2} cy={cy - 5} rx="6" ry="4" fill="#8aa36e" />
            </g>
          );
        })}
        <Tree x={1.4} y={26.8} size={0.83} />
      </g>

      {/* Survey annotations remain legible at compact viewport sizes. */}
      <g opacity={dimensionOpacity}>
        <Line a={P(0, -2.4)} b={P(21, -2.4)} color={C.forest} width={0.6} />
        <Line a={P(0, -3.05)} b={P(0, -1.75)} color={C.forest} width={0.8} />
        <Line a={P(21, -3.05)} b={P(21, -1.75)} color={C.forest} width={0.8} />
        <Line a={P(-2.4, 0)} b={P(-2.4, 30)} color={C.forest} width={0.6} />
        <Line a={P(-3.05, 0)} b={P(-1.75, 0)} color={C.forest} width={0.8} />
        <Line a={P(-3.05, 30)} b={P(-1.75, 30)} color={C.forest} width={0.8} />
        <text
          x={P(10.5, -3.8)[0]}
          y={P(10.5, -3.8)[1]}
          textAnchor="middle"
          fill={C.forest}
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1.1"
          transform={`rotate(-26.565 ${P(10.5, -3.8).join(" ")})`}
        >
          15.2 M
        </text>
        <text
          x={P(-3.8, 15)[0]}
          y={P(-3.8, 15)[1]}
          textAnchor="middle"
          fill={C.forest}
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="1.1"
          transform={`rotate(26.565 ${P(-3.8, 15).join(" ")})`}
        >
          36.6 M
        </text>
        {[P(0, 0), P(21, 0), P(21, 30), P(0, 30)].map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="3.1"
              fill={C.ivory}
              stroke={C.forest}
              strokeWidth=".85"
            />
            <circle cx={x} cy={y} r="1" fill={C.forest} />
          </g>
        ))}
      </g>
      <g opacity={1 - shell} transform="translate(583 158)">
        <path d="M0 29V0M0 0L-4 9M0 0L4 9" stroke={C.forest} strokeWidth="1" />
        <text
          y="-8"
          textAnchor="middle"
          fill={C.forest}
          fontFamily="monospace"
          fontSize="9"
        >
          N
        </text>
      </g>
    </svg>
  );
}
