import { ImageResponse } from "next/og";

/**
 * The card a Realist link unfurls into — in a group chat, on X, in Slack. One
 * layout for every page so a shared underwrite, a track record and the site
 * itself are recognisably the same thing: the wordmark, one line, up to three
 * numbers. (next/og renders a flexbox subset: every multi-child box is a flex row/column.)
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export interface ShareCard {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  stats?: Array<{ label: string; value: string; tone?: "bad" }>;
  footer?: string;
}

const INK = "#111111";
const SOFT = "#4d4d4d";
const FAINT = "#696969";
const HAIRLINE = "#dadada";
const BRAND = "#be1730";
const MARK = "#ff334b";

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export function shareCard(card: ShareCard): ImageResponse {
  const title = clip(card.title.trim(), 72);
  const titleSize = title.length <= 26 ? 84 : title.length <= 44 ? 68 : 54;
  const stats = (card.stats ?? []).slice(0, 3);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: "64px 72px", color: INK }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 40, fontWeight: 700, letterSpacing: -1.5 }}>
            <span>realist</span>
            <span style={{ color: MARK }}>.</span>
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: BRAND, fontWeight: 600 }}>{clip(card.eyebrow, 60)}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: titleSize, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{title}</div>
          {card.subtitle ? <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: SOFT, lineHeight: 1.3 }}>{clip(card.subtitle, 110)}</div> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {stats.length > 0 ? (
            <div style={{ display: "flex", borderTop: `2px solid ${HAIRLINE}`, paddingTop: 28 }}>
              {stats.map((stat) => (
                <div key={stat.label} style={{ display: "flex", flexDirection: "column", marginRight: 72 }}>
                  <span style={{ fontSize: 20, letterSpacing: 2.5, textTransform: "uppercase", color: FAINT }}>{stat.label}</span>
                  <span style={{ marginTop: 6, fontSize: 60, fontWeight: 700, letterSpacing: -1.5, color: stat.tone === "bad" ? BRAND : INK }}>{stat.value}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 26, fontSize: 24, color: FAINT }}>{card.footer ?? "realist.ca · Every listing in Canada, already underwritten."}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
