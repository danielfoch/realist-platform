import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Pool } from "pg";
import { EVENT_QA } from "@shared/eventQa";
import { createEventQaStore } from "./eventQaStore";
import { registerEventQaRoutes } from "./eventQaRoutes";

// Real PostgreSQL semantics in memory. PGlite has one connection, so emulate
// a size-one pg pool: concurrent transactions must wait to acquire it.
const db = new PGlite();
let queue = Promise.resolve();
async function query(text: string, values?: unknown[]) {
  if (!values && text.includes(";")) return (await db.exec(text)).at(-1);
  return db.query(text, values);
}
const pool = {
  query,
  async connect() {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return { query, release };
  },
} as unknown as Pool;
const store = createEventQaStore(pool);
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.session = { userId: req.get("x-test-user") } as any;
  next();
});
const authenticated: RequestHandler = (req, res, next) =>
  req.session.userId
    ? next()
    : void res.status(401).json({ message: "Sign in required" });
const moderator: RequestHandler = (req, res, next) =>
  req.session.userId === "host"
    ? next()
    : void res
        .status(req.session.userId ? 403 : 401)
        .json({ message: "Host required" });
registerEventQaRoutes(app, {
  store,
  authenticated,
  moderator,
  canModerate: async (req) => req.session.userId === "host",
});
const api = EVENT_QA.api;
const body = "What financing options work best for a first multiplex?";
const post = (user = "alice", text = body) =>
  request(app)
    .post(`${api}/questions`)
    .set("x-test-user", user)
    .send({ body: text, panel: "Finance" });
const approve = (id: string, status = "approved", pinned = false) =>
  request(app)
    .patch(`${api}/questions/${id}/moderation`)
    .set("x-test-user", "host")
    .send({ status, pinned });
const vote = (id: string, value: number, user = "bob") =>
  request(app)
    .put(`${api}/questions/${id}/vote`)
    .set("x-test-user", user)
    .send({ value });

beforeAll(async () => {
  await db.exec(
    "CREATE TABLE users (id varchar PRIMARY KEY); INSERT INTO users VALUES ('alice'),('bob'),('host');",
  );
  await store.ensure();
}, 30000);
beforeEach(async () => {
  await db.exec(
    "TRUNCATE event_qa_votes, event_qa_questions; UPDATE event_qa_settings SET is_open = true, blocked_words = '{}';",
  );
});
afterAll(async () => {
  await db.close();
});

describe("event Q&A API and PostgreSQL store", () => {
  it("requires an account for both posting and voting and a host for moderation/settings", async () => {
    expect(
      (
        await request(app)
          .post(`${api}/questions`)
          .send({ body, panel: "Finance" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .put(`${api}/questions/00000000-0000-4000-8000-000000000000/vote`)
          .send({ value: 1 })
      ).status,
    ).toBe(401);
    expect(
      (await request(app).get(`${api}/moderation`).set("x-test-user", "alice"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`${api}/settings`)
          .set("x-test-user", "alice")
          .send({ isOpen: false, blockedWords: [] })
      ).status,
    ).toBe(403);
    expect((await request(app).get(api)).status).toBe(200);
  });
  it("keeps pending/rejected text private and publishes only after host approval", async () => {
    const result = await post();
    expect(result.status).toBe(201);
    const id = result.body.id;
    expect((await request(app).get(api)).body.questions).toEqual([]);
    expect((await request(app).get(`${api}/screen`)).body.questions).toEqual(
      [],
    );
    expect(
      (await request(app).get(api).set("x-test-user", "alice")).body.mine,
    ).toHaveLength(1);
    expect(
      (await request(app).get(api).set("x-test-user", "bob")).body.mine,
    ).toEqual([]);
    expect((await vote(id, 1)).status).toBe(409);
    expect((await approve(id)).status).toBe(200);
    const publicFeed = (await request(app).get(api)).body;
    expect(publicFeed.questions).toHaveLength(1);
    expect(publicFeed.questions[0]).not.toHaveProperty("user_id");
    expect(publicFeed.questions[0]).not.toHaveProperty("email");
    expect((await request(app).get(`${api}/screen`)).body).not.toHaveProperty(
      "mine",
    );
    await approve(id, "rejected");
    expect((await request(app).get(api)).body.questions).toEqual([]);
  });
  it("retries, switches and removes votes without duplicates; concurrent accounts sum correctly", async () => {
    const id = (await post()).body.id;
    await approve(id);
    await Promise.all([vote(id, 1), vote(id, 1), vote(id, 1, "alice")]);
    expect((await request(app).get(api)).body.questions[0]).toMatchObject({
      score: 2,
      upvotes: 2,
      downvotes: 0,
    });
    await vote(id, -1);
    expect(
      (await request(app).get(api).set("x-test-user", "bob")).body.questions[0],
    ).toMatchObject({ score: 0, myVote: -1, upvotes: 1, downvotes: 1 });
    await vote(id, 0);
    expect((await request(app).get(api)).body.questions[0].score).toBe(1);
    expect((await vote(id, 2)).status).toBe(400);
  });
  it("rejects profanity and malformed/cross-origin requests before publishing", async () => {
    expect(
      (await post("alice", "What the f.u.c.k is this event?")).status,
    ).toBe(422);
    expect((await post("alice", "short")).status).toBe(400);
    expect((await post("alice", "x".repeat(501))).status).toBe(400);
    expect(
      (
        await request(app)
          .post(`${api}/questions`)
          .set("x-test-user", "alice")
          .set("Origin", "https://evil.example")
          .send({ body, panel: "Finance" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`${api}/questions`)
          .set("x-test-user", "alice")
          .send({ body, panel: "Finance", userId: "host" })
      ).status,
    ).toBe(400);
  });
  it("serializes simultaneous submissions and pauses both posting and voting", async () => {
    const results = await Promise.all([post(), post()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 429]);
    const id = results.find((r) => r.status === 201)!.body.id;
    await approve(id);
    await request(app)
      .put(`${api}/settings`)
      .set("x-test-user", "host")
      .send({ isOpen: false, blockedWords: [] });
    expect((await vote(id, 1)).status).toBe(409);
    expect((await post("bob")).status).toBe(409);
  });
  it("features one question, archives answered questions, and retracts newly blocked content", async () => {
    const a = (await post()).body.id;
    const b = (
      await post("bob", "How do we choose the right builder for the project?")
    ).body.id;
    await approve(a, "approved", true);
    await approve(b, "approved", true);
    const screen = (await request(app).get(`${api}/screen`)).body.questions;
    expect(screen[0].id).toBe(b);
    expect(screen.filter((q: any) => q.pinned)).toHaveLength(1);
    await approve(b, "answered");
    expect(
      (await request(app).get(`${api}/screen`)).body.questions,
    ).toHaveLength(1);
    expect((await vote(b, 1)).status).toBe(409);
    await request(app)
      .put(`${api}/settings`)
      .set("x-test-user", "host")
      .send({ isOpen: true, blockedWords: ["financing"] });
    expect((await request(app).get(`${api}/screen`)).body.questions).toEqual(
      [],
    );
    expect((await approve(a)).status).toBe(422);
    expect((await post("host")).status).toBe(422);
  });
});
