import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./lib/seo/redirects";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nobody else gets to put these pages (and their forms) inside a frame.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
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
      { source: "/tools/analyzer", destination: "/underwrite", permanent: true },
      { source: "/deal-analyzer", destination: "/underwrite", permanent: true },
      { source: "/power-team", destination: "/team", permanent: true },
      { source: "/experts", destination: "/team", permanent: true },
      { source: "/my-performance", destination: "/account", permanent: true },
      { source: "/community/meetups", destination: "/community", permanent: true },
      { source: "/meetups", destination: "/community", permanent: true },
      // The old app's partner pages (the homepage still links PropCare's). Temporary on
      // purpose: a real partner page can take the URL back without fighting browser caches.
      { source: "/community/events/partners/:partner", destination: "/team?roles=property_manager#request", permanent: false },
    ];
  },
};

export default nextConfig;
