import type { Metadata } from "next";
import ScrollcraftLanding from "@/components/scrollcraft/ScrollcraftLanding";
import { JsonLd } from "@/components/JsonLd";
import { jsonLdDocument, podcastSeriesNode } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Realist — From your first episode to your first multiplex",
  description:
    "AI-assisted analysis. Real-world expertise. Learn, find Canadian investment properties, plan a multiplex, and connect with the people to build and manage your asset for the long term.",
  alternates: { canonical: "/" },
};

/**
 * The homepage is the eleven-stage multiplex journey (components/scrollcraft):
 * Learn, Education, Connect, Analyze, Find, Design, Offer, Finance, Build, Own, Operate.
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
