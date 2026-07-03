/**
 * Deal Room transactional emails — confirmation, reminder, and replay
 * delivery. Sent via the existing Resend connector. All sends are
 * best-effort; callers catch and log.
 *
 * Copy rules: plain and factual. No exclamation marks, no hype.
 */

import { getResendClient } from "./resend";
import type { DealRoomSession } from "@shared/schema";

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://realist.ca";

function formatSessionTime(scheduledAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
    timeZoneName: "short",
  }).format(scheduledAt);
}

function googleCalendarUrl(session: DealRoomSession): string {
  const start = session.scheduledAt;
  const end = new Date(start.getTime() + (session.durationMinutes ?? 60) * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Realist ${session.title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Free live deal review with the Realist team.${session.meetUrl ? `\n\nJoin: ${session.meetUrl}` : ""}\n\n${SITE_URL}/deal-room`,
    location: session.meetUrl ?? `${SITE_URL}/deal-room`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function shell(title: string, bodyHtml: string): string {
  return `
  <div style="max-width: 560px; margin: 0 auto; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
    <div style="background: #111827; padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${title}</h1>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
      ${bodyHtml}
    </div>
    <div style="text-align: center; padding: 16px;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">Realist.ca — Canadian real estate, underwritten</p>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 15px;">${label}</a>`;
}

const RECORDING_NOTE = `<p style="color: #6b7280; font-size: 13px; line-height: 1.5;">Sessions are recorded. Replays are published on realist.ca and recordings are used to improve Realist's analysis tools.</p>`;

export async function sendDealRoomConfirmation(params: {
  to: string;
  name: string;
  session: DealRoomSession;
}): Promise<void> {
  const { client, fromEmail } = await getResendClient();
  const when = formatSessionTime(params.session.scheduledAt);
  const joinBlock = params.session.meetUrl
    ? `<p style="margin: 20px 0;">${button(params.session.meetUrl, "Join on Google Meet")}</p>`
    : `<p style="margin: 20px 0;">The join link arrives in your reminder email before the session.</p>`;

  const { error } = await client.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `You're registered — ${params.session.title}, ${when}`,
    html: shell(
      "You're registered",
      `
      <p style="font-size: 15px; color: #111827;">Hi ${params.name},</p>
      <p style="font-size: 15px; color: #111827; line-height: 1.6;">You're in for the <strong>${params.session.title}</strong> — <strong>${when}</strong>. Live deal review, real numbers, direct answers.</p>
      ${joinBlock}
      <p style="margin: 8px 0 20px;"><a href="${googleCalendarUrl(params.session)}" style="color: #16a34a; font-size: 14px;">Add to Google Calendar</a></p>
      <p style="font-size: 14px; color: #374151; line-height: 1.6;">Want your own deal reviewed live on the call? <a href="${SITE_URL}/tools/deal-desk?src=deal-room" style="color: #16a34a;">Submit it here</a> and we'll pull it up.</p>
      ${RECORDING_NOTE}
      `,
    ),
  });
  if (error) throw error;
}

export async function sendDealRoomReminder(params: {
  to: string;
  name: string;
  session: DealRoomSession;
}): Promise<void> {
  const { client, fromEmail } = await getResendClient();
  const when = formatSessionTime(params.session.scheduledAt);
  const { error } = await client.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Tomorrow — ${params.session.title}, ${when}`,
    html: shell(
      "See you on the call",
      `
      <p style="font-size: 15px; color: #111827;">Hi ${params.name},</p>
      <p style="font-size: 15px; color: #111827; line-height: 1.6;"><strong>${params.session.title}</strong> runs <strong>${when}</strong>.</p>
      ${params.session.meetUrl ? `<p style="margin: 20px 0;">${button(params.session.meetUrl, "Join on Google Meet")}</p>` : ""}
      <p style="font-size: 14px; color: #374151; line-height: 1.6;">Bring a deal you're weighing. If you want it reviewed on screen, <a href="${SITE_URL}/tools/deal-desk?src=deal-room" style="color: #16a34a;">submit it before the call</a>.</p>
      ${RECORDING_NOTE}
      `,
    ),
  });
  if (error) throw error;
}

export async function sendDealRoomReplay(params: {
  to: string;
  name: string;
  session: DealRoomSession;
}): Promise<void> {
  const { client, fromEmail } = await getResendClient();
  const when = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(params.session.scheduledAt);
  const watchUrl = params.session.recordingUrl ?? `${SITE_URL}/deal-room`;
  const summaryBlock = params.session.aiSummary
    ? `<p style="font-size: 14px; color: #374151; line-height: 1.6;"><strong>On this session:</strong> ${params.session.aiSummary}</p>`
    : "";

  const { error } = await client.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Replay — ${params.session.title}, ${when}`,
    html: shell(
      "The replay is up",
      `
      <p style="font-size: 15px; color: #111827;">Hi ${params.name},</p>
      <p style="font-size: 15px; color: #111827; line-height: 1.6;">The recording of the <strong>${params.session.title}</strong> (${when}) is ready. No signup needed.</p>
      <p style="margin: 20px 0;">${button(watchUrl, "Watch the replay")}</p>
      ${summaryBlock}
      <p style="font-size: 14px; color: #374151; line-height: 1.6;">Have a deal like the ones reviewed? <a href="${SITE_URL}/tools/analyzer" style="color: #16a34a;">Run your numbers</a>, or <a href="${SITE_URL}/book-a-call" style="color: #16a34a;">book a call</a> to talk it through with the team.</p>
      <p style="font-size: 14px; color: #374151;"><a href="${SITE_URL}/deal-room" style="color: #16a34a;">Register for the next session</a></p>
      `,
    ),
  });
  if (error) throw error;
}
