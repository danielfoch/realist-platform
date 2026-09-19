import ScrollcraftLanding from "@/components/scrollcraft/ScrollcraftLanding";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/analytics";
import { SHARED_ROUTE_META } from "@shared/routeMeta";

const schema = {
  "@context": "https://schema.org",
  "@graph": [organizationSchema, websiteSchema],
};
function trackLandingCta(cta: string, destination: string, location: string) {
  track({ event: "homepage.cta_clicked", cta, destination, location });
}

export default function Landing() {
  const { user } = useAuth();
  return (
    <>
      <SEO
        title={SHARED_ROUTE_META["/"].title}
        description={SHARED_ROUTE_META["/"].description}
        canonicalUrl="/"
        structuredData={schema}
      />
      <ScrollcraftLanding signedIn={Boolean(user)} onCta={trackLandingCta} />
    </>
  );
}
