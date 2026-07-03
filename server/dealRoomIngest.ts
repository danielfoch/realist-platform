/**
 * Deal Room recording ingest — Google Meet → Drive → realist.ca.
 *
 * Meet saves the recording (mp4) and, when transcription is on, a Google Doc
 * transcript into the organizer's "Meet Recordings" Drive folder. Share that
 * folder with the service account and this job does the rest:
 *
 *   1. find sessions that have ended but have no recording attached
 *   2. match the newest mp4 (+ transcript doc) created around the session time
 *   3. make the file link-viewable and store the /preview embed URL
 *   4. export the transcript text
 *   5. write an AI summary + chapters (Claude; skipped when no API key)
 *   6. mark the session completed and append a call_sessions ledger row
 *
 * Env:
 *   DEAL_ROOM_GOOGLE_SA_JSON   service-account JSON (raw or base64)
 *   DEAL_ROOM_DRIVE_FOLDER_ID  the shared "Meet Recordings" folder id
 *
 * Everything degrades gracefully: with no env config the ingest reports
 * "not configured" and does nothing.
 */

import { google, type drive_v3 } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "./db";
import { dealRoomSessions, callSessions } from "@shared/schema";

interface IngestReport {
  configured: boolean;
  sessionsChecked: number;
  ingested: Array<{ sessionId: string; recordingFileId: string; transcript: boolean; summarized: boolean }>;
  pending: Array<{ sessionId: string; reason: string }>;
}

function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.DEAL_ROOM_GOOGLE_SA_JSON;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    console.error("[deal-room-ingest] DEAL_ROOM_GOOGLE_SA_JSON is not valid JSON/base64:", err instanceof Error ? err.message : err);
    return null;
  }
}

function getDrive(): drive_v3.Drive | null {
  const credentials = loadServiceAccount();
  if (!credentials || !process.env.DEAL_ROOM_DRIVE_FOLDER_ID) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: credentials as never,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function listFolderFiles(
  drive: drive_v3.Drive,
  folderId: string,
  createdAfterIso: string,
): Promise<drive_v3.Schema$File[]> {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and createdTime > '${createdAfterIso}'`,
    fields: "files(id, name, mimeType, createdTime, webViewLink, videoMediaMetadata(durationMillis))",
    orderBy: "createdTime desc",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return data.files ?? [];
}

async function summarizeTranscript(
  transcript: string,
  sessionDate: Date,
): Promise<{ summary: string; chapters: Array<{ label: string }> } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const clipped = transcript.slice(0, 150_000);
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1200,
      system:
        "You summarize a live real-estate deal-review call for the replay page. " +
        "Write for an investor deciding whether to watch. Plain language, no hype, " +
        "no exclamation marks. Respond with ONLY valid JSON: " +
        '{"summary": "2-3 sentences on what was covered", "chapters": [{"label": "short segment description"}, ...max 8]}',
      messages: [
        {
          role: "user",
          content: `Transcript of the Live Deal Room session on ${sessionDate.toISOString().slice(0, 10)}:\n\n${clipped}`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText) as { summary?: unknown; chapters?: unknown };
    if (typeof parsed.summary !== "string") return null;
    const chapters = Array.isArray(parsed.chapters)
      ? parsed.chapters
          .filter((c): c is { label: string } => typeof (c as { label?: unknown })?.label === "string")
          .slice(0, 8)
      : [];
    return { summary: parsed.summary, chapters };
  } catch (err) {
    console.error("[deal-room-ingest] summary failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function ingestDealRoomRecordings(): Promise<IngestReport> {
  const report: IngestReport = { configured: false, sessionsChecked: 0, ingested: [], pending: [] };
  const drive = getDrive();
  if (!drive) return report;
  report.configured = true;
  const folderId = process.env.DEAL_ROOM_DRIVE_FOLDER_ID!;

  // Sessions that ended ≥15 minutes ago with no recording yet (last 14 days).
  const endedCutoff = new Date(Date.now() - 15 * 60_000);
  const candidates = await db
    .select()
    .from(dealRoomSessions)
    .where(and(
      eq(dealRoomSessions.status, "scheduled"),
      isNull(dealRoomSessions.driveRecordingFileId),
      lte(dealRoomSessions.scheduledAt, new Date(endedCutoff.getTime() - 60 * 60_000)),
    ))
    .limit(10);
  report.sessionsChecked = candidates.length;
  if (candidates.length === 0) return report;

  for (const session of candidates) {
    if (session.scheduledAt.getTime() < Date.now() - 14 * 86_400_000) {
      // Too old to auto-match reliably; leave for manual attach via PATCH.
      report.pending.push({ sessionId: session.id, reason: "session older than 14 days — attach manually" });
      continue;
    }
    try {
      const windowStart = new Date(session.scheduledAt.getTime() - 15 * 60_000).toISOString();
      const files = await listFolderFiles(drive, folderId, windowStart);
      const video = files.find((f) => (f.mimeType ?? "").startsWith("video/"));
      if (!video?.id) {
        report.pending.push({ sessionId: session.id, reason: "no recording found in Drive folder yet" });
        continue;
      }
      const transcriptDoc = files.find(
        (f) => f.mimeType === "application/vnd.google-apps.document" && /transcript/i.test(f.name ?? ""),
      );

      // Anyone-with-link viewer so the replay embeds for signed-out visitors.
      await drive.permissions.create({
        fileId: video.id,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
      }).catch((err) => {
        console.error("[deal-room-ingest] permission set failed (replay may 403):", err instanceof Error ? err.message : err);
      });

      let transcriptText: string | null = null;
      if (transcriptDoc?.id) {
        try {
          const { data } = await drive.files.export(
            { fileId: transcriptDoc.id, mimeType: "text/plain" },
            { responseType: "text" },
          );
          transcriptText = typeof data === "string" ? data : null;
        } catch (err) {
          console.error("[deal-room-ingest] transcript export failed:", err instanceof Error ? err.message : err);
        }
      }

      const ai = transcriptText ? await summarizeTranscript(transcriptText, session.scheduledAt) : null;
      const durationSecs = video.videoMediaMetadata?.durationMillis
        ? Math.round(Number(video.videoMediaMetadata.durationMillis) / 1000)
        : null;

      const [updated] = await db
        .update(dealRoomSessions)
        .set({
          status: "completed",
          driveRecordingFileId: video.id,
          recordingUrl: video.webViewLink ?? `https://drive.google.com/file/d/${video.id}/view`,
          replayEmbedUrl: `https://drive.google.com/file/d/${video.id}/preview`,
          driveTranscriptFileId: transcriptDoc?.id ?? null,
          transcriptText,
          aiSummary: ai?.summary ?? null,
          aiChapters: ai?.chapters ?? [],
          updatedAt: new Date(),
        })
        .where(eq(dealRoomSessions.id, session.id))
        .returning();

      // Ledger row — the AI training corpus accumulates here.
      await db.insert(callSessions).values({
        type: "deal_room",
        dealRoomSessionId: session.id,
        scheduledAt: session.scheduledAt,
        heldAt: session.scheduledAt,
        platform: "google_meet",
        driveRecordingFileId: video.id,
        recordingUrl: updated.recordingUrl,
        transcriptText,
        durationSecs,
        rep: "dan",
        aiSummary: ai?.summary ?? null,
      });

      report.ingested.push({
        sessionId: session.id,
        recordingFileId: video.id,
        transcript: Boolean(transcriptText),
        summarized: Boolean(ai),
      });
      console.log(`[deal-room-ingest] session ${session.id} ingested (recording ${video.id})`);
    } catch (err) {
      console.error(`[deal-room-ingest] session ${session.id} failed:`, err instanceof Error ? err.message : err);
      report.pending.push({ sessionId: session.id, reason: err instanceof Error ? err.message : "unknown error" });
    }
  }
  return report;
}
