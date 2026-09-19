import type { Metadata } from "next";
import { getPodcastEpisodes } from "@/lib/podcast/feed";
import { Terminal } from "@/components/home/Terminal";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Deal Map — Motivated Sellers and Rents Across Canada",
  description:
    "Browse power-of-sale, VTB, and motivated-seller listings on a map of Canada with average rents by city, and underwrite a Toronto multiplex site without leaving the page.",
  alternates: { canonical: "/deals/map" },
};

export default async function DealMapPage() {
  const episodes = await getPodcastEpisodes().catch(() => []);
  const latest = episodes[0] ?? null;

  return (
    <Terminal
      episode={
        latest
          ? {
              slug: latest.slug,
              title: latest.title,
              audioUrl: latest.audioUrl,
              imageUrl: latest.imageUrl,
            }
          : null
      }
    />
  );
}
