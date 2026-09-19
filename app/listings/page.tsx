import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbNode, jsonLdDocument } from "@/lib/seo/jsonld";
import { ListingsExplorer } from "@/components/listings/ListingsExplorer";

export const metadata: Metadata = {
  title: "Real Estate Listings Across Canada, Pre-Underwritten",
  description:
    "Every MLS® listing scored before you book a showing: rent estimate, gross and net yield, and monthly cash flow at 20% down — powered by the REALTOR.ca DDF® and Realist's national rent database.",
  alternates: { canonical: "/listings" },
};

export default function ListingsPage() {
  return (
    <>
      <JsonLd
        json={jsonLdDocument(
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Listings", path: "/listings" },
          ]),
        )}
      />

      {/* No hero: like the listing sites people already know, the page is the map and the list. The
          H1 lives inside the list pane. */}
      <ListingsExplorer />
    </>
  );
}
