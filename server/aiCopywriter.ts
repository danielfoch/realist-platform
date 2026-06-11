/**
 * AI message drafting for the CRM — context-aware email/SMS copy.
 *
 * Reads the contact's stage, recent timeline, and their actual deal analyses,
 * and drafts the next outreach message in Dan's voice. The human always
 * reviews and edits before sending — this fills the draft box, it never sends.
 *
 * Requires ANTHROPIC_API_KEY (Replit secret).
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function aiDraftingConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface DraftContext {
  channel: "email" | "sms";
  contact: {
    name: string;
    stage: string;
    contactType: string;
    targetMarket: string | null;
    source: string | null;
    lastTouchAt: Date | null;
  };
  nextStepAction: string;
  nextStepReason: string;
  recentActivity: Array<{ kind: string; body: string | null; createdAt: Date }>;
  analyses: Array<{ title: string | null; city: string | null; listingPrice: number | null; createdAt: Date }>;
}

const SYSTEM_PROMPT = `You draft outreach messages for Dan Foch — real estate broker, co-host of The Canadian Real Estate Investor podcast, and founder of realist.ca (an AI deal analyzer for Canadian rental property investors).

Voice: direct, warm, zero hype, talks numbers like an investor. Sounds like a sharp friend who happens to be a broker — never like a salesperson or a newsletter.

Rules:
- Use ONLY facts present in the provided context. Never invent properties, prices, conversations, or details.
- If the contact has analyzed deals on Realist, reference the most relevant one specifically — that is the strongest hook.
- If recent timeline shows a reply or conversation, continue that thread naturally; do not restart the relationship.
- One clear, low-friction call to action. Usually: reply with a listing link, grab 15 minutes, or look at one specific deal.
- Email: subject under 50 chars, plain-spoken (no clickbait, no emoji); body 60–140 words, short paragraphs, sign off "— Dan".
- SMS: under 320 characters, casual, first-name basis, no links unless one exists in context, no sign-off needed beyond "– Dan" if space allows.
- Canadian spelling. No "I hope this finds you well". No "just checking in" openers — lead with something concrete.`;

export async function draftCrmMessage(ctx: DraftContext): Promise<{ subject: string; body: string }> {
  const timeline = ctx.recentActivity
    .map((a) => `[${a.createdAt.toISOString().slice(0, 10)}] ${a.kind}: ${(a.body || "").slice(0, 240)}`)
    .join("\n") || "(no prior activity)";
  const analyses = ctx.analyses
    .map((a) => `- ${a.title || "Untitled"} | ${a.city || "?"} | ${a.listingPrice ? `$${Math.round(a.listingPrice).toLocaleString()}` : "?"} | analyzed ${a.createdAt.toISOString().slice(0, 10)}`)
    .join("\n") || "(none — they have not analyzed deals on Realist yet)";

  const userPrompt = `Draft the next ${ctx.channel === "sms" ? "SMS text message" : "email"} to this CRM contact.

CONTACT
Name: ${ctx.contact.name}
Type: ${ctx.contact.contactType} | Stage: ${ctx.contact.stage}
Target market: ${ctx.contact.targetMarket || "unknown"}
Source: ${ctx.contact.source || "unknown"}
Last touch: ${ctx.contact.lastTouchAt ? ctx.contact.lastTouchAt.toISOString().slice(0, 10) : "never"}

NEXT STEP (per CRM engine): ${ctx.nextStepAction}
Why now: ${ctx.nextStepReason}

RECENT TIMELINE (newest first)
${timeline}

THEIR DEAL ANALYSES ON REALIST
${analyses}

Return JSON. For SMS set "subject" to an empty string.`;

  const response = await getClient().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["subject", "body"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("AI draft returned no content");
  const parsed = JSON.parse(text.text) as { subject: string; body: string };
  return { subject: parsed.subject || "", body: parsed.body || "" };
}
