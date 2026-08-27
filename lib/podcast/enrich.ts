/**
 * Episode enrichment writer: turns a fresh RSS episode into the extra blog
 * material its page renders — an SEO summary, key takeaways, and related
 * research links. Runs from the podcast cron (Tue/Fri after release);
 * idempotent per slug. The RSS feed remains the source of truth for the
 * episode itself; enrichment only ever adds.
 */

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { episodeEnrichments } from "@/lib/db/schema";
import { STATS_BASE_URL } from "@/lib/brand";
import { getPodcastEpisodes, sanitizeShowNotesHtml, stripShowNotes } from "./feed";
import { deriveEpisodeTopics } from "./episodes";

interface ResearchOption {
  href: string;
  label: string;
  tags: string[];
}

/** Candidate related-research links; report slugs load lazily if present. */
async function researchOptions(): Promise<ResearchOption[]> {
  const options: ResearchOption[] = [
    {
      href: `${STATS_BASE_URL}`,
      label: "Live Canadian housing market dashboards",
      tags: ["Housing Market", "Economy", "Interest Rates", "Cap Rates"],
    },
    { href: "/listings", label: "Pre-underwritten listings across Canada", tags: ["Cap Rates", "Rentals", "Investing Strategy"] },
    { href: "/multiplex", label: "Toronto multiplex underwriter", tags: ["Multiplex", "Development", "CMHC", "Financing"] },
    { href: "/deals", label: "Power of sale & VTB deal feed", tags: ["Power of Sale"] },
  ];
  try {
    const { reportIndex } = await import("@/content/reports");
    for (const report of reportIndex) {
      options.push({
        href: `/research/${report.slug}`,
        label: report.title,
        tags: report.tags ?? [],
      });
    }
  } catch {
    // Report index not present — the static options above are enough.
  }
  return options;
}

function pickRelatedResearch(
  topics: string[],
  options: ResearchOption[],
): Array<{ href: string; label: string }> {
  const topicSet = new Set(topics);
  const scored = options
    .map((option) => ({
      option,
      score: option.tags.filter((tag) => topicSet.has(tag)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => ({ href: entry.option.href, label: entry.option.label }));
  return scored.length > 0
    ? scored
    : [{ href: options[0].href, label: options[0].label }];
}

const SUMMARY_SYSTEM = `You write short episode briefings for The Canadian Real Estate Investor podcast's website. Input: an episode title and its show notes. Output strict JSON: {"summaryHtml": string, "keyTakeaways": string[]}.
Rules:
- summaryHtml: 2 short <p> paragraphs (plain HTML, no headings/links/scripts) describing what the episode covers and why a Canadian real estate investor should care. Write in third person ("Daniel and Nick discuss…"). No hype.
- keyTakeaways: 3-5 single-sentence bullets, concrete and specific to the episode.
- Never invent statistics, prices, or rates that are not in the show notes.`;

async function writeSummary(
  title: string,
  showNotes: string,
): Promise<{ summaryHtml: string; keyTakeaways: string[] } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system: SUMMARY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\nShow notes:\n${stripShowNotes(showNotes, 3000)}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              summaryHtml: { type: "string" },
              keyTakeaways: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
            },
            required: ["summaryHtml", "keyTakeaways"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { summaryHtml: string; keyTakeaways: string[] };
    return {
      summaryHtml: sanitizeShowNotesHtml(parsed.summaryHtml),
      keyTakeaways: parsed.keyTakeaways.slice(0, 5),
    };
  } catch (error) {
    console.error("[podcast-enrich] summary generation failed:", (error as Error).message);
    return null;
  }
}

export async function enrichNewEpisodes(limit = 3): Promise<{
  checked: number;
  enriched: string[];
  skipped: string[];
}> {
  const episodes = (await getPodcastEpisodes()).slice(0, 6);
  const db = getDb();
  const enriched: string[] = [];
  const skipped: string[] = [];

  for (const episode of episodes) {
    if (enriched.length >= limit) break;
    const existing = await db
      .select({ slug: episodeEnrichments.slug })
      .from(episodeEnrichments)
      .where(eq(episodeEnrichments.slug, episode.slug))
      .limit(1);
    if (existing.length > 0) {
      skipped.push(episode.slug);
      continue;
    }

    const topics = deriveEpisodeTopics(episode.title);
    const relatedResearch = pickRelatedResearch(topics, await researchOptions());
    const summary = await writeSummary(episode.title, episode.description);

    await db
      .insert(episodeEnrichments)
      .values({
        slug: episode.slug,
        summaryHtml: summary?.summaryHtml ?? null,
        keyTakeaways: summary?.keyTakeaways ?? null,
        relatedResearch,
        episodeTitle: episode.title,
        episodePubDate: episode.pubDate,
      })
      .onConflictDoNothing();
    enriched.push(episode.slug);
  }

  return { checked: episodes.length, enriched, skipped };
}
