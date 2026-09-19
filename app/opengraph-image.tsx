import { OG_CONTENT_TYPE, OG_SIZE, shareCard } from "@/lib/og/card";

export const alt = "Realist — every listing in Canada, already underwritten";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return shareCard({
    eyebrow: "For Canadian real estate investors",
    title: "Every listing in Canada, already underwritten.",
    subtitle: "Change any number. See the price that makes the deal work. Free.",
    footer: "realist.ca · From the hosts of The Canadian Real Estate Investor",
  });
}
