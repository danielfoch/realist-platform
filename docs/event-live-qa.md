# Live panel Q&A — Toronto 2026

- Audience: https://realist.ca/ask
- Projector: https://realist.ca/ask/screen
- Host controls: https://realist.ca/ask/moderate

Audience members use their existing Realist account or create a free account. Reading the feed is public; submitting and both voting directions require a server-authenticated account. Questions are public anonymously, with the author ID retained privately for ownership and rate limits. Each account has one vote per question. Clicking its selected direction removes that vote; choosing the other direction replaces it.

All questions enter the host review queue. The host approves or rejects them. Approved questions are ranked by net votes, with panel and newest-first filters. Marking a question answered archives it and stops voting. “Feature on screen” makes it the projector's current question; otherwise the projector shows the highest-ranked open question. The projector includes the audience QR code and refreshes every three seconds. Rejected/pending text and account details are never returned by its endpoint. A failed projector refresh hides stale questions until the connection recovers.

## Running the event

1. Sign in at `/ask/moderate` using an existing event administrator account. Access reuses `REALIST_EVENT_ADMIN_EMAILS` from `server/eventsModule.ts`; its existing defaults include Daniel, Nick, and Jonathan.
2. Open `/ask/screen` in the presentation browser, and use browser fullscreen for projection.
3. Keep the review queue open on a separate device or tab. Approve questions, feature the current one, and mark it answered when the panel is finished.
4. “Pause questions & voting” closes participation while keeping host controls and approved questions available. Use this at the end of the event.

## Rejected language

`server/eventQaModeration.ts` contains the 57-entry built-in rejection list. It covers profanity, sexual terms, slurs, and abusive phrases. Normalization catches common leetspeak, separated letters, repeated letters, diacritics, invisible characters and several lookalike letters. Word boundaries avoid blocking ordinary terms such as “asset class” and “assessment.” This is a filter, not a complete abuse detector: host approval is mandatory.

Hosts can view the built-in list and save up to 250 additional words/phrases in the moderation page. New matches already in circulation are returned to pending review and unfeatured. Removing a custom word does not automatically republish those questions.

## Persistence and verification

The store creates `event_qa_settings`, `event_qa_questions`, and `event_qa_votes` idempotently. Initialization is serialized with a PostgreSQL advisory lock and awaited by requests; it retries after failure. The event is initially open. The existing `users` table and session authentication are reused. Questions and votes persist across restarts and autoscaled instances.

Run `npx vitest run server/eventQa.test.ts server/eventQaModeration.test.ts server/appRouteRegistry.test.ts`, then `npm run check` and `npm run build`. Tests use PostgreSQL in memory through PGlite, with no production database or real account creation. They cover authorization, private review states, vote retries/switches/removal, concurrent writes, pause behavior, featured questions, new rejection terms, and route registration.
