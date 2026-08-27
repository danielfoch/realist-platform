import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/brand";
import { getPodcastEpisodes } from "@/lib/podcast/feed";
import { encyclopediaGuides } from "@/lib/encyclopedia";
import { sortedConfigReports } from "@/content/reports";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_BASE_URL}/listings`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_BASE_URL}/multiplex`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_BASE_URL}/deals`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_BASE_URL}/podcast`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_BASE_URL}/research`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_BASE_URL}/encyclopedia`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_BASE_URL}/community`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_BASE_URL}/work-with-us`, changeFrequency: "monthly", priority: 0.6 },
  ];

  for (const report of sortedConfigReports) {
    entries.push({
      url: `${SITE_BASE_URL}/research/${report.slug}`,
      lastModified: new Date(report.publishDate),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const guide of encyclopediaGuides) {
    entries.push({
      url: `${SITE_BASE_URL}/encyclopedia/${guide.slug}`,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  try {
    const episodes = await getPodcastEpisodes();
    for (const episode of episodes) {
      entries.push({
        url: `${SITE_BASE_URL}/podcast/${episode.slug}`,
        lastModified: episode.pubDate ? new Date(episode.pubDate) : undefined,
        changeFrequency: "yearly",
        priority: 0.6,
      });
    }
  } catch {
    // Feed down — ship the sitemap without episodes rather than failing.
  }

  return entries;
}
