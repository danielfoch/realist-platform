import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { EVENT_QA } from "@shared/eventQa";
import {
  containsRejectedWords,
  DEFAULT_REJECTED_WORDS,
  normalizeQuestionText,
} from "./eventQaModeration";
import { QaError, type EventQaStore } from "./eventQaStore";

const submissionSchema = z
  .object({
    body: z
      .string()
      .max(2000)
      .transform(normalizeQuestionText)
      .pipe(
        z
          .string()
          .min(10, "Please use at least 10 characters.")
          .max(500, "Please keep your question under 500 characters."),
      ),
    panel: z.enum(EVENT_QA.panels),
  })
  .strict();
const idSchema = z.string().uuid();
const settingsSchema = z
  .object({
    isOpen: z.boolean(),
    blockedWords: z
      .array(
        z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(
            /^[\p{L}\p{N} '’-]+$/u,
            "Use words or phrases, without symbols.",
          ),
      )
      .max(250),
  })
  .strict();

export function registerEventQaRoutes(
  app: Express,
  deps: {
    store: EventQaStore;
    authenticated: RequestHandler;
    moderator: RequestHandler;
    canModerate: (req: Request) => Promise<boolean>;
  },
) {
  const { store } = deps;
  const route =
    (fn: RequestHandler): RequestHandler =>
    async (req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      try {
        await fn(req, res, next);
      } catch (error) {
        if (error instanceof z.ZodError)
          return res
            .status(400)
            .json({ message: error.issues[0]?.message || "Invalid request." });
        if (error instanceof QaError)
          return res.status(error.status).json({ message: error.message });
        console.error(
          "[event-qa] request failed",
          error instanceof Error ? error.name : "unknown error",
        );
        res
          .status(503)
          .json({
            message:
              "Q&A is temporarily unavailable. Please try again shortly.",
          });
      }
    };
  const sameOrigin: RequestHandler = (req, res, next) => {
    if (!req.is("application/json"))
      return res.status(415).json({ message: "JSON is required." });
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`) {
      return res
        .status(403)
        .json({ message: "Please submit from the Realist Q&A page." });
    }
    next();
  };

  app.get(
    EVENT_QA.api,
    route(async (req, res) => {
      const userId = req.session?.userId || null;
      const [config, questions, mine, canModerate] = await Promise.all([
        store.settings(),
        store.questions(userId, "public"),
        userId ? store.questions(userId, "mine") : Promise.resolve([]),
        userId ? deps.canModerate(req) : Promise.resolve(false),
      ]);
      res.json({
        isOpen: config.isOpen,
        questions: questions.filter(
          (q) => !containsRejectedWords(q.body, config.blockedWords),
        ),
        mine,
        canModerate,
      });
    }),
  );
  // Dedicated projector endpoint never includes account data or pending/rejected questions.
  app.get(
    `${EVENT_QA.api}/screen`,
    route(async (_req, res) => {
      const [config, questions] = await Promise.all([
        store.settings(),
        store.questions(null, "public"),
      ]);
      res.json({
        isOpen: config.isOpen,
        questions: questions
          .filter(
            (q) =>
              q.status === "approved" &&
              !containsRejectedWords(q.body, config.blockedWords),
          )
          .slice(0, 3),
      });
    }),
  );
  app.post(
    `${EVENT_QA.api}/questions`,
    deps.authenticated,
    sameOrigin,
    route(async (req, res) => {
      const data = submissionSchema.parse(req.body);
      res
        .status(201)
        .json(await store.submit(req.session.userId!, data.body, data.panel));
    }),
  );
  app.put(
    `${EVENT_QA.api}/questions/:id/vote`,
    deps.authenticated,
    sameOrigin,
    route(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { value } = z
        .object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
        .strict()
        .parse(req.body);
      await store.vote(req.session.userId!, id, value);
      res.json({ ok: true });
    }),
  );
  app.get(
    `${EVENT_QA.api}/moderation`,
    deps.moderator,
    route(async (_req, res) => {
      const [config, questions] = await Promise.all([
        store.settings(),
        store.questions(null, "admin"),
      ]);
      res.json({
        ...config,
        questions,
        defaultRejectedWords: DEFAULT_REJECTED_WORDS,
      });
    }),
  );
  app.patch(
    `${EVENT_QA.api}/questions/:id/moderation`,
    deps.moderator,
    sameOrigin,
    route(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const data = z
        .object({
          status: z.enum(["pending", "approved", "answered", "rejected"]),
          pinned: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      await store.moderate(req.session.userId!, id, data.status, data.pinned);
      res.json({ ok: true });
    }),
  );
  app.put(
    `${EVENT_QA.api}/settings`,
    deps.moderator,
    sameOrigin,
    route(async (req, res) => {
      const { isOpen, blockedWords } = settingsSchema.parse(req.body);
      await store.updateSettings(isOpen, [
        ...new Set(blockedWords.map((word) => word.toLowerCase())),
      ]);
      res.json({ ok: true });
    }),
  );
}
