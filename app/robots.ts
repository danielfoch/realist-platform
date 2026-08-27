import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/multiplex/r/"],
      },
    ],
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}
