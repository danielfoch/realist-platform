import type { Pool, PoolClient } from "pg";
import {
  EVENT_QA,
  type EventQuestion,
  type QuestionStatus,
} from "@shared/eventQa";
import { containsRejectedWords } from "./eventQaModeration";

export class QaError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const EVENT_QA_SCHEMA = `
  CREATE TABLE IF NOT EXISTS event_qa_settings (
    event_slug text PRIMARY KEY,
    is_open boolean NOT NULL DEFAULT true,
    blocked_words text[] NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS event_qa_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_slug text NOT NULL REFERENCES event_qa_settings(event_slug),
    user_id varchar NOT NULL REFERENCES users(id),
    body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 500),
    panel text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','answered','rejected')),
    pinned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    moderated_at timestamptz,
    moderated_by varchar REFERENCES users(id),
    CHECK (NOT pinned OR status = 'approved')
  );
  CREATE INDEX IF NOT EXISTS event_qa_feed_idx ON event_qa_questions(event_slug, status, created_at);
  CREATE INDEX IF NOT EXISTS event_qa_author_idx ON event_qa_questions(event_slug, user_id, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS event_qa_one_pin ON event_qa_questions(event_slug) WHERE pinned;
  CREATE TABLE IF NOT EXISTS event_qa_votes (
    question_id uuid NOT NULL REFERENCES event_qa_questions(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id),
    value smallint NOT NULL CHECK (value IN (-1, 1)),
    PRIMARY KEY (question_id, user_id)
  );
`;

const selection = `q.id, q.body, q.panel, q.status, q.pinned, q.created_at AS "createdAt",
  COALESCE(sum(v.value), 0)::int AS score,
  count(*) FILTER (WHERE v.value = 1)::int AS upvotes,
  count(*) FILTER (WHERE v.value = -1)::int AS downvotes,
  COALESCE(max(v.value) FILTER (WHERE v.user_id = $2), 0)::int AS "myVote"`;

export function createEventQaStore(pool: Pool) {
  let schemaReady: Promise<void> | undefined;
  const ensure = () =>
    (schemaReady ??= (async () => {
      // One migration at a time, including across autoscaled instances.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('event-qa-schema'))",
        );
        await client.query(EVENT_QA_SCHEMA);
        await client.query(
          "INSERT INTO event_qa_settings (event_slug) VALUES ($1) ON CONFLICT DO NOTHING",
          [EVENT_QA.slug],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    }));

  async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
    await ensure();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function settings(client: Pick<Pool, "query"> = pool, lock = false) {
    await ensure();
    const { rows } = await client.query(
      `SELECT is_open AS "isOpen", blocked_words AS "blockedWords"
      FROM event_qa_settings WHERE event_slug = $1${lock ? " FOR SHARE" : ""}`,
      [EVENT_QA.slug],
    );
    return rows[0] as { isOpen: boolean; blockedWords: string[] };
  }

  async function questions(
    userId: string | null,
    mode: "public" | "mine" | "admin",
  ) {
    await ensure();
    const where =
      mode === "public"
        ? "AND q.status IN ('approved','answered')"
        : mode === "mine"
          ? "AND q.user_id = $2"
          : "";
    const order =
      mode === "public"
        ? "q.pinned DESC, (q.status = 'approved') DESC, score DESC, q.created_at ASC"
        : "q.created_at DESC";
    const { rows } = await pool.query(
      `SELECT ${selection} FROM event_qa_questions q
      LEFT JOIN event_qa_votes v ON v.question_id = q.id
      WHERE q.event_slug = $1 ${where} GROUP BY q.id ORDER BY ${order} LIMIT 500`,
      [EVENT_QA.slug, userId],
    );
    return rows as EventQuestion[];
  }

  return {
    ensure,
    settings,
    questions,
    async submit(userId: string, body: string, panel: string) {
      return transaction(async (client) => {
        const config = await settings(client, true);
        if (!config.isOpen)
          throw new QaError(
            409,
            "Questions and voting are paused by the host.",
          );
        if (containsRejectedWords(body, config.blockedWords))
          throw new QaError(
            422,
            "Please rephrase your question without inappropriate language.",
          );
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `event-qa-submit:${userId}`,
        ]);
        const { rows } = await client.query(
          `SELECT
          count(*) FILTER (WHERE created_at > now() - interval '20 seconds')::int AS recent,
          count(*) FILTER (WHERE status = 'pending')::int AS pending
          FROM event_qa_questions WHERE event_slug = $1 AND user_id = $2`,
          [EVENT_QA.slug, userId],
        );
        if (rows[0].recent > 0)
          throw new QaError(429, "Please wait 20 seconds between questions.");
        if (rows[0].pending >= 5)
          throw new QaError(
            429,
            "You already have five questions awaiting review. Please let the host catch up.",
          );
        const result = await client.query(
          `INSERT INTO event_qa_questions (event_slug, user_id, body, panel)
          VALUES ($1, $2, $3, $4) RETURNING id`,
          [EVENT_QA.slug, userId, body, panel],
        );
        return { id: result.rows[0].id, status: "pending" as const };
      });
    },
    async vote(userId: string, id: string, value: number) {
      return transaction(async (client) => {
        const config = await settings(client, true);
        if (!config.isOpen)
          throw new QaError(
            409,
            "Questions and voting are paused by the host.",
          );
        const { rows } = await client.query(
          `SELECT status, body FROM event_qa_questions
          WHERE id = $1 AND event_slug = $2 FOR UPDATE`,
          [id, EVENT_QA.slug],
        );
        if (
          !rows[0] ||
          rows[0].status !== "approved" ||
          containsRejectedWords(rows[0].body, config.blockedWords)
        ) {
          throw new QaError(409, "This question is no longer open for voting.");
        }
        // Absolute intent makes retries idempotent; never increment a shared counter.
        if (value === 0)
          await client.query(
            "DELETE FROM event_qa_votes WHERE question_id = $1 AND user_id = $2",
            [id, userId],
          );
        else
          await client.query(
            `INSERT INTO event_qa_votes (question_id, user_id, value) VALUES ($1, $2, $3)
          ON CONFLICT (question_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
            [id, userId, value],
          );
      });
    },
    async moderate(
      userId: string,
      id: string,
      status: QuestionStatus,
      pinned: boolean,
    ) {
      return transaction(async (client) => {
        const config = await settings(client, true);
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('event-qa-moderate'))",
        );
        const { rows } = await client.query(
          "SELECT body FROM event_qa_questions WHERE id = $1 AND event_slug = $2 FOR UPDATE",
          [id, EVENT_QA.slug],
        );
        if (!rows[0]) throw new QaError(404, "Question not found.");
        if (
          (status === "approved" || status === "answered") &&
          containsRejectedWords(rows[0].body, config.blockedWords)
        ) {
          throw new QaError(
            422,
            "This question contains rejected language and cannot be published.",
          );
        }
        if (pinned)
          await client.query(
            "UPDATE event_qa_questions SET pinned = false WHERE event_slug = $1 AND pinned",
            [EVENT_QA.slug],
          );
        await client.query(
          `UPDATE event_qa_questions SET status = $1, pinned = $2, moderated_by = $3, moderated_at = now()
          WHERE id = $4 AND event_slug = $5`,
          [status, status === "approved" && pinned, userId, id, EVENT_QA.slug],
        );
      });
    },
    async updateSettings(isOpen: boolean, blockedWords: string[]) {
      return transaction(async (client) => {
        await client.query(
          "UPDATE event_qa_settings SET is_open = $1, blocked_words = $2 WHERE event_slug = $3",
          [isOpen, blockedWords, EVENT_QA.slug],
        );
        // Newly blocked content is removed from circulation, not revived when a word is later removed.
        const { rows } = await client.query(
          "SELECT id, body FROM event_qa_questions WHERE event_slug = $1 AND status IN ('approved','answered')",
          [EVENT_QA.slug],
        );
        const rejected = rows
          .filter((q) => containsRejectedWords(q.body, blockedWords))
          .map((q) => q.id);
        if (rejected.length)
          await client.query(
            "UPDATE event_qa_questions SET status = 'pending', pinned = false WHERE id = ANY($1::uuid[])",
            [rejected],
          );
      });
    },
  };
}
export type EventQaStore = ReturnType<typeof createEventQaStore>;
