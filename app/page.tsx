import type { Metadata } from "next";
import ScrollcraftLanding from "@/components/scrollcraft/ScrollcraftLanding";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, podcastSeriesNode } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Realist — From your first episode to your first multiplex",
  description:
    "Learn with Canada's #1 real estate podcast, find and analyze properties across Canada, design and underwrite a multiplex, make your offer, and build — one platform for the whole journey.",
  alternates: { canonical: "/" },
};

/**
 * The homepage is the ten-stage multiplex journey (components/scrollcraft):
 * Learn, Education, Connect, Analyze, Find, Design, Offer, Finance, Build, Own.
 * It renders its own header, chapter navigation and footer; the shared nav and
 * footer step aside on this route (SiteNav / HideOnHome).
 */
export default function HomePage() {
  return (
    <>
      <JsonLd json={jsonLdDocument(podcastSeriesNode())} />
      <ScrollcraftLanding />
    </>
  );
}
