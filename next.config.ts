import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./lib/seo/redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy URLs from the old realist.ca app keep their equity.
      ...LEGACY_REDIRECTS,
      { source: "/insights/podcast", destination: "/podcast", permanent: true },
      { source: "/insights/podcast/:slug", destination: "/podcast/:slug", permanent: true },
      { source: "/insights/motivated-report", destination: "/deals", permanent: true },
      { source: "/insights/distress-report", destination: "/deals", permanent: true },
      { source: "/tools/cap-rates", destination: "/listings", permanent: true },
      { source: "/tools/multiplex-underwriter", destination: "/multiplex", permanent: true },
      { source: "/tools/multiplex-feasibility", destination: "/multiplex", permanent: true },
      { source: "/tools/analyzer", destination: "/listings", permanent: true },
      { source: "/community/meetups", destination: "/community", permanent: true },
      { source: "/meetups", destination: "/community", permanent: true },
    ];
  },
};

export default nextConfig;
