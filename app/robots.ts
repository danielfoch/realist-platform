import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Explicit public tool surfaces must also be fetchable by LLM web clients.
        allow: ["/", "/api/underwriting", "/api/property"],
        disallow: ["/api/", "/multiplex/r/", "/login", "/account", "/admin", "/unsubscribe", "/a/"],
      },
    ],
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}
