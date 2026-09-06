# Multiplex / Missing-Middle Lead-Capture Audit

**Date:** Sunday 6 September 2026  
**Event:** Unpacking Multiplexes Toronto — Tue 15 Sep 2026, The Terminal Theatre (Queens Quay Terminal)  
**Hosts:** Daniel Foch + Nick Hill  
**Audience for this doc:** Clydesdale → Dan. Paste the sprint. Do not redesign the product from this file.

**Score:** marketing page **6.5/10**, lead-capture system **3.5/10**.  
The landing page looks like a conference page. The buyer never becomes a Realist lead.

---

## Executive summary

Toronto tickets are sold on **OvationTix** (`ci.ovationtix.com/37003/production/1277443`), not on Realist Stripe, not on Eventbrite. Clicking **Buy Tickets** leaves realist.ca. There is no OvationTix webhook, no thank-you route, no GHL tag, no host `ref=dan|nick`, and no nurture in this repo for those buyers.

Realist already has a working conference capture stack — it is just pointed at the **wrong events**:

| Pattern that works | Where | Used for Toronto Sep 15? |
|---|---|---|
| Native Stripe checkout → account + welcome email + roster | `/events/:slug` + `realist_event_orders` | **No** |
| Email capture → `leads` + GHL webhook + Sheets + UTMs | `/edmonton`, Vancouver thank-you | **No** |
| Intent routing Dan vs Nick | `leadRouter` (acquisition / financing) | **No** on ticket clicks |
| Meta Pixel + CAPI on ticket click | Toronto page only | **Click only** — no Purchase |

Venue site ([terminaltheatre.ca/performance/unpacking-multiplexes](https://terminaltheatre.ca/performance/unpacking-multiplexes/)) still lists **Earlybird $99 (ended 31 Jul)** and **Regular $129 (ended 31 Aug)**. As of 6 Sep the honest price is **Last Chance $149 + tax/fees**. Realist shows **no price at all**.

Dan's own recent read: ~200 tickets sold, target ~350, lower bowl ~300, venue stretched toward 400. **None of that scarcity is on the page.**

**Do this week, in order:** (1) fix swapped host photos + put the real price/remaining seats on the page, (2) pull the OvationTix buyer list into GHL/Sheets with a `multiplex_toronto_2026` tag, (3) add UTM + `ref=dan|nick` on every ticket URL, (4) ship a sold-out waitlist / day-of QR using the Edmonton pattern. Do **not** publish the unused native seed event `multiplex-conference-toronto-2026` (wrong date: 19 Sep).

---

## 1. Surface map

### 1.1 Canonical marketing page (the one that matters)

| Item | Value |
|---|---|
| URL | https://realist.ca/community/events/unpacking-multiplexes-toronto |
| Code | `client/src/pages/UnpackingMultiplexesToronto.tsx` |
| Single source of promo copy | `client/src/lib/flagshipEvent.ts` |
| Ticket URL | `https://ci.ovationtix.com/37003/production/1277443` (hardcoded, no UTM) |
| Meta Pixel | `1661103374140663` (this page only) |
| CAPI | `POST /api/capi/event` — `PageView` + `InitiateCheckout` |
| First-party analytics | `ticket_cta_clicked` → `POST /api/analytics/track` |

Page already has: hero, date/venue, speakers (8), hosts/moderators (3), agenda, FAQ, sponsor strip, sticky **desktop** sidebar CTA, footer CTA, share button, schema.org Event JSON-LD.

Page does **not** have: ticket price, remaining seats, host bios, host profile links, email capture, waitlist, thank-you, Dan vs Nick links, UTM on checkout, sold-out / last-seats, recap of prior sell-outs, mobile sticky bar.

### 1.2 Routes and streams (all multiplex / community-event related)

**Conference / community**

| Route | File | Role vs Toronto |
|---|---|---|
| `/community/events/unpacking-multiplexes-toronto` | `UnpackingMultiplexesToronto.tsx` | **Canonical ticket page** |
| `/community/events` | `Events.tsx` | Hub. Flagship banner (hardcoded, good). Also Eventbrite meetups + unused native list |
| `/community/events/partners/:slug` | `EventPartnerPage.tsx` + `eventPartners.ts` | 11 SEO sponsor pages; CTA back to event, no ticket UTM |
| `/community` | `CommunityHub.tsx` | Generic "Events & Workshops" card. **Does not mention Sep 15** |
| `/events/:slug` | `EventDetail.tsx` + `EventPageTemplate.tsx` | Native Stripe/RSVP template. **Not used for this conference** |
| `/events/:slug/success` | `EventSuccess.tsx` | Stripe thank-you. **OvationTix never lands here** |
| `/events` | redirect → `/community/events` | Fine |
| `/admin/events*` | AdminEvents / New / Edit / Roster | Door ops for **native** events only |

**Host / partner link-in-bio**

| Route | Gap |
|---|---|
| `/danielfoch` | Events link goes to `/community/events`, not the Toronto page |
| `/nickhill` | Same |

**Other multiplex events (do not confuse with Toronto)**

| Route | Notes |
|---|---|
| `/thank-you/vancouver-multiplex-2026` | Post-event waitlist. Posts to `/api/leads/engage` with GHL tags. Several speaker/sponsor `href="#"` leftovers |
| `/edmonton` and `/yeg` | Day-of QR. Email → leads + GHL + UTMs → analyzer. **Best template for Sep 15 door capture** |
| Eventbrite organizer `87580319633` | Monthly meetups. Hub still says "Follow on Eventbrite" |

**Multiplex product (qualified traffic, weak event CTA)**

| Route | Event CTA? |
|---|---|
| `/tools/multiplex-underwriter` | Yes — `MultiplexEventCta` inline + post-result |
| `/tools/multiplex-feasibility` | **No** |
| `/tools/will-it-plex` | **No** |
| `/multiplex-investor-fit` | **No.** "Join the Waitlist" is a **toast only** — no API |
| `/masterclass` | **No.** Has its own `/api/masterclass/lead` + Stripe checkout |

**Homepage / start**

| Route | Notes |
|---|---|
| `/` (`Landing.tsx`) | `EventPromoFrame` — client-only. Falls back to `FLAGSHIP_EVENT` if `/api/events/featured` is empty |
| `/investor-start` | Same frame |

Live check 6 Sep: `/community/events` banner is correct (15 Sep, Terminal Theatre). Native "Realist events & meetups" list is empty in production (no published native flagship). Eventbrite meetups (Sep 8 / Oct 13 / Nov 10 / Dec 8) still render.

### 1.3 Parallel calendars (collision risk)

Three calendars describe "Toronto multiplex 2026":

1. **Marketing truth** — slug `unpacking-multiplexes-toronto`, **15 Sep 2026**, Terminal Theatre, OvationTix.
2. **Native seed (DRAFT, do not publish as-is)** — `scripts/seed-events-2026.ts` slug `multiplex-conference-toronto-2026`, **19 Sep 2026**, Stripe tickets $199 / $299 / $599.
3. **Eventbrite leftover** — `Events.tsx` still keys Toronto multiplex on Eventbrite id `1982604532527` **or** the string `innis town hall` (old venue), then overwrites date/venue to Terminal Theatre. Live hub did not show that featured card on 6 Sep (feed likely stale or ended).

### 1.4 Affiliate / host attribution (Dan vs Nick)

**Does not exist on the ticket funnel.**

What exists elsewhere:

- `server/leadRouter.ts` — acquisition → Dan (`danielfoch@gmail.com`), financing → Nick (`nick@bldfinancial.ca`), general → both.
- `MultiplexActionRail` — "make an offer" (Dan) vs "apply for financing" (Nick) after an underwrite.
- `server/bldLeadDestination.ts` — BLD forward is an **unconfigured stub** (`BLD_LEAD_WEBHOOK_URL` / `BLD_LEAD_EMAIL` unset).
- Traffic layer already accepts `utm_*` and `ref` (`shared/trafficAnalytics.ts`) and stores first/current touch in localStorage.

Ticket URL is a bare OvationTix link. Dan's Instagram story and Nick's LinkedIn post look identical to analytics.

---

## 2. Registration funnel (as built)

```
Traffic
  homepage EventPromoFrame (JS)
  /community/events banner
  underwriter CTA
  partner pages
  sponsor social copy (docs/social/multiplex-toronto-sponsor-follow-ups.md)
  TSA / Terminal Theatre listings
  podcast / hosts (link-in-bio is generic)
        │
        ▼
/community/events/unpacking-multiplexes-toronto
  Pixel PageView + CAPI PageView
  first-party page_view (if something else fires it)
        │
        │  Buy Tickets (hero / sidebar / footer)
        │  → ticket_cta_clicked
        │  → Pixel + CAPI InitiateCheckout
        │  → window.location.assign(OvationTix)   ← same-tab, good for mobile
        ▼
OvationTix checkout  (email + card live HERE)
  confirmation email from OvationTix / theatre box office
        │
        ✗ no return URL to realist.ca
        ✗ no /events/:slug/success
        ✗ no /api/leads/engage
        ✗ no GHL / Sheets / users row
        ✗ no Purchase event
        ✗ no 7-day / 3-day / day-of nurture
```

### Where a Toronto ticket buyer actually lands

| Destination | Toronto OvationTix buyer? | Native Stripe event buyer? | Edmonton QR / Vancouver waitlist? |
|---|---|---|---|
| `leads` | No | No | Yes (`/api/leads/engage`) |
| GHL (`GHL_WEBHOOK_URL` via `sendWebhook`) | No | No | Yes |
| Google Sheet (`appendLead`) | No | No | Yes |
| `users` + password-setup email | No | Yes (`fulfillRealistEventCheckout`) | Edmonton auto-enrols |
| `realist_event_orders` / `realist_event_attendees` | No | Yes | No |
| `realist_event_rsvps` | No | Meetups only | No |
| OvationTix / Terminal Theatre box office | **Yes — system of record** | No | No |
| Resend confirmation | OvationTix's email | Realist "Your ticket is confirmed" | Lead notify to Dan/Nick |
| Meta Purchase | **No** | No CAPI Purchase wired | n/a |

CRM webhook adapter (`docs/CRM_WEBHOOK_INTEGRATION.md`) is vendor-neutral and **off by default**. It is not in the ticket path.

### Native stack that Toronto is not using

`server/eventsModule.ts` + `server/eventsGrowth.ts`:

- Checkout → Stripe → webhook `fulfillRealistEventCheckout`
- Creates/updates user, order, attendees, capacity
- Welcome / set-password email (`source: event_ticket`)
- 48h reminder sweep for RSVPs
- Admin roster + door check-in

That is a 10-day **migration**, not a 10-day patch. For Sep 15, **import OvationTix buyers** rather than replatform.

---

## 3. Gaps vs a 10/10 conference capture system

| Capability | Now | Gap |
|---|---|---|
| Sticky CTA | Desktop sidebar `lg:sticky`. Mobile must scroll to hero/footer | Add a mobile bottom bar. Keep desktop as-is |
| Host bios | Names + titles only. `bio: null`. **Photos swapped** (Daniel uses `nickHeadshot`, Nick uses `danielHeadshot`) | Swap images. 2–3 line bios. Link `/danielfoch` and `/nickhill` |
| Speaker list | 8 speakers + Sabrina as guest moderator. Expert slugs on most | Add Brendan Farrow expert slug if he has one. Confirm "Human on stage" (Dan, 2 Sep) is on the page |
| Agenda | Hardcoded 5:00 / 6:00 / 6:10 / 6:50 / 7:30 / 8:10 | Venue site: doors 5:00, remarks 6:00, finance 6:15, planning 6:55, execution 7:30, mixer 8:00, close 10:00. **Pick one and publish it everywhere** |
| Social proof | "100+ housing professionals". No prior sell-out, no 200-sold, no testimonials | Add 2024/2025 sold-out + current count if OvationTix can give it |
| Scarcity | Copy says "limited spots". `urgencyLabel()` only shows day-count in the last 14 days (honest, good). No seat math | Put Last Chance $149 + remaining seats or "lower bowl filling". Do not invent scarcity |
| Share kits | `navigator.share` or copy URL. No UTM. No image/caption pack on-page | Host + speaker kits: unique URLs, 1080 square, 3 captions |
| Post-click tracking | Click yes. Purchase no. UTMs stored first-touch on-site, **not forwarded** to OvationTix | Append UTMs + `ref` to ticket URL. Nightly buyer CSV → GHL. CAPI Purchase if emails can be hashed |
| Dual-host attribution | None | `?ref=dan` / `?ref=nick` on ticket + analytics. Separate Stories/LinkedIn links |
| Spam / quality | No on-page form, so no spam gate. OvationTix takes payment (quality by wallet) | If you add a waitlist: honeypot + work-email hint + intent ("builder / lender / first plex") |
| Mobile | Same-tab checkout (fixed once). No sticky CTA. Sidebar gone below `lg` | Sticky bar + price. Test in Instagram in-app browser |
| Price on page | Missing. Schema `Offer` has no `price` | Last Chance $149 + tax/fees. Update schema |
| Thank-you / nurture | Missing | OvationTix return URL → `/thank-you/toronto-multiplex-2026` or Edmonton-style `/toronto` |
| Day-of capture | Missing | Clone `/edmonton` → `/toronto` QR on slides and programs |

---

## 4. Broken / stale (verified 6 Sep 2026)

### P0 — wrong or embarrassing

1. **Host photos swapped** — `UnpackingMultiplexesToronto.tsx` `MODERATORS`: Daniel Foch `imageUrl: nickHeadshot`, Nick Hill `imageUrl: danielHeadshot`.
2. **Price windows on the venue site are expired**; Realist shows no price. Earlybird ended 31 Jul, Regular ended 31 Aug. Last Chance $149 is the live tier.
3. **Agenda / start-time drift** across Realist, Terminal Theatre, and TSA (`$101.50–$151.50` on TSA).
4. **Live sitemaps 500** — `https://realist.ca/sitemap.xml`, `sitemap-pages.xml`, `sitemap-events.xml` all returned 500 on 6 Sep. Duplicate `/sitemap.xml` handlers in `server/routes.ts` (index at ~784, urlset at ~8313). The urlset list **omits** the Toronto event URL.
5. **Marketing event URL is not in any sitemap builder** — `buildEventsSitemap()` emits `/community/events` + `/events/:slug` for **published native** rows only. `buildPagesSitemap()` has the hub, not `/community/events/unpacking-multiplexes-toronto`.

### P1 — funnel leaks

6. **No email form on the Toronto page.** Edmonton and Vancouver waitlist already post to `/api/leads/engage`.
7. **No thank-you.** `/events/:slug/success` is Stripe-only. `/thank-you/vancouver-multiplex-2026` is the other city's after-party.
8. **UTMs die at checkout.** `trackTrafficEvent` keeps them in localStorage; `TICKET_URL` is not rewritten.
9. **`/multiplex-investor-fit` waitlist is fake** — toast, no POST.
10. **Partner copy is past tense** — e.g. CMHC "Aled Ab Iorwerth **joined** the panel" in `eventPartners.ts` (event is still 9 days out).
11. **Crawler body is thin.** `seoMeta.ts` injects Event JSON-LD (good). `seoRender.ts` static HTML exists for `/events/:slug`, **not** for `/community/events/unpacking-multiplexes-toronto`. Live fetch: schema + empty `#seo-static-fallback`. Speakers/agenda/FAQ are client-only.
12. **Homepage event frame is client-only.** Crawler homepage HTML has no Sep 15 block.

### P2 — leftovers / confusion

13. **Eventbrite + Innis Town Hall** matching in `Events.tsx`. Footer still "Follow on Eventbrite".
14. **Native seed date 19 Sep** vs real 15 Sep. Slug mismatch (`multiplex-conference-toronto-2026`).
15. **`href="#"` leftovers** on Vancouver thank-you (Forefront, Theorem, GVTPM, Burke, BLD, Siegrist, several panelists). Not on the Toronto page. Footer Contact on the main site is a real `/about/contact`.
16. **`stats.realist.ca`** is the logged-in stats iframe (`Stats.tsx`) + cookie allowlist in `auth.ts`. **Not on the event pages.** Do not spend Sep 6–15 on it.
17. **Host bios pages** do not deep-link the conference.
18. **Feasibility / Will It Plex / Masterclass / Community hub** do not promote Sep 15.
19. **Schema `Offer.availability` is `InStock` with no price** — fine until sell-out, then it will lie.
20. **Terminal Theatre listing CTA looks unfinished** ("TBD View Venue Website") — buyers may bounce before OvationTix.

---

## 5. Ten-day sprint (Day 0 = Sun 6 Sep → Day 9 = Tue 15 Sep)

Effort: **S** < 2h · **M** half-day · **L** do not start before the event unless it unblocks CRM.

Success metrics are binary or countable so Dan can check them in Slack.

### Day 0 — Sun 6 Sep (today): stop the leaks

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P0-1 | Swap Daniel / Nick headshots on the Toronto page | eng | S | Photos match names on staging |
| P0-2 | Confirm OvationTix is still selling Last Chance; get remaining seats | Dan-Nick | S | Number in Slack (sold / cap) |
| P0-3 | Publish one agenda + one start time on Realist, venue, TSA | content | S | Three sites match |
| P0-4 | Export OvationTix buyer CSV (emails, names, qty, order date) | Dan-Nick | S | CSV in Drive |
| P0-5 | Diagnose live sitemap 500; add Toronto URL to pages + events sitemaps | eng | M | `curl -sI` sitemap.xml → 200; URL present |

### Day 1 — Mon 7 Sep: price, CRM, attribution

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P0-6 | Import CSV → GHL + Sheets. Tag `multiplex_toronto_2026`. Dedup on email | Dan-Nick + eng | M | Tag count ≈ ticket count |
| P0-7 | Append `utm_*` + `ref` from the landing URL onto OvationTix | eng | S | Dan link and Nick link produce different `ref` in analytics |
| P1-1 | Show **Last Chance $149 + tax/fees** + remaining seats (or "lower bowl filling") on hero + sidebar | eng + content | S | Price visible at 390px width |
| P1-2 | Host bios (3 lines) + links to `/danielfoch` and `/nickhill`; those pages CTA to Toronto with `ref=` | eng + content | S | Host cards are clickable |

### Day 2 — Tue 8 Sep: conversion on-page

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P1-3 | Mobile sticky Buy bar (price + button) | eng | S | Button visible without scroll on iPhone |
| P1-4 | Email waitlist / "sold out notify me" via `/api/leads/engage` (`formTag: toronto_multiplex_2026`) | eng | M | Test email appears in GHL + Sheet |
| P1-5 | `MultiplexEventCta` on feasibility, will-it-plex, masterclass, community hub | eng | S | Four new inbound paths fire `cta_clicked` |
| P2-1 | Give Dan and Nick unique share URLs + 3 captions | content + Dan-Nick | S | Both posted once |

### Day 3 — Wed 9 Sep: nurture

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P0-8 | Re-import OvationTix (delta since Day 0). Never skip a day after this | Dan-Nick | S | New orders tagged same day |
| P1-6 | If OvationTix allows a return URL, land `/thank-you/toronto-multiplex-2026` (analyzer + book-a-call, Edmonton pattern) | eng | M | Test purchase returns to Realist |
| P1-7 | Buyer email: T-6 / T-3 / T-1 / day-of (venue, door time, what to bring). From existing list, not a new product | content + Dan-Nick | M | First send T-6 (Tue 9) or T-3 (Sat 12) — pick one and send |

### Day 4 — Thu 10 Sep: proof + partners

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P1-8 | Fix partner pages: future tense + ticket button with UTM `utm_content=partner_<slug>` | eng + content | S | 11 partner pages, live tense |
| P2-2 | Social proof block: prior two years sold out + current count | content | S | Block on page |
| P2-3 | Speaker/sponsor share kit (docs + Drive). Reuse `docs/social/multiplex-toronto-sponsor-follow-ups.md` | content | M | 8 speakers + 5 sponsors posted or scheduled |

### Day 5 — Fri 11 Sep: traffic

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P2-4 | Podcast CTA + newsletter: last-chance $149, `ref=podcast` | Dan-Nick | S | Send logged; clicks in analytics |
| P2-5 | Kill Eventbrite Innis matcher + "Follow on Eventbrite" as the flagship CTA (keep meetup register links) | eng | S | Hub no longer mentions Innis |
| P1-9 | Waitlist honeypot + "what describes you" (builder / lender / first plex / other) | eng | S | Junk rate < 10% on new form |

### Day 6 — Sat 12 Sep: fill the room

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P1-10 | Confirm door list process with Terminal Theatre / OvationTix (will they email a final CSV Sun night?) | Dan-Nick | S | Written process |
| P2-6 | TSA / OHBA / Storeys / REM one more push | Dan-Nick | S | One outbound each |
| P1-7b | T-3 reminder if T-6 already sent | content | S | Open rate noted |

### Day 7 — Sun 13 Sep: day-of page

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P1-11 | Clone `/edmonton` → `/toronto` (or `/yyz`): email → `formTag: toronto_multiplex_door`, UTMs, analyzer. QR on slides + programs | eng | M | QR test creates a lead |
| P2-7 | Speaker "see you Tuesday" posts with their `ref=` | Dan-Nick | S | 5+ speaker posts |

### Day 8 — Mon 14 Sep: last seats

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P0-9 | Final count. If <20 seats: "last seats". If 0: sold-out + waitlist + walk-up policy | content | S | Page matches reality by 6pm |
| P1-12 | Door ops: printed + phone list from last CSV; who owns BoxOffice questions | Dan-Nick | S | Two names on a card |
| P2-8 | Last Stories / LinkedIn / newsletter | Dan-Nick | S | Posted |

### Day 9 — Tue 15 Sep: capture in the room

| ID | Item | Owner | Effort | Success metric |
|---|---|---|---|---|
| P0-10 | QR on every slide + program → `/toronto`. Staff ask email before the analyzer demo | Dan-Nick + eng | S | Door leads > 30 |
| P1-13 | After mixer: tag no-shows vs checked-in if theatre gives scans | Dan-Nick | S | List split next morning |
| P2-9 | Recap + next-city waitlist (Vancouver 2027 page already exists) | content | S | Recap live Wed 16 |

---

## 6. What not to do this week

- Do **not** migrate Toronto onto native Stripe before the 15th. Import the list.
- Do **not** publish `multiplex-conference-toronto-2026` (19 Sep DRAFT).
- Do **not** rebuild stats.realist.ca or the community question forum for this sprint.
- Do **not** invent "only 12 tickets left" without OvationTix numbers. Day-count urgency is already honest.

---

## 7. Code / docs index (for the next eng session)

| Path | Why it matters |
|---|---|
| `client/src/pages/UnpackingMultiplexesToronto.tsx` | Ticket URL, pixel, swapped photos, agenda |
| `client/src/lib/flagshipEvent.ts` | Promo date/venue — keep as source of truth |
| `client/src/pages/Events.tsx` | Eventbrite + Innis leftover |
| `client/src/components/events/MultiplexEventCta.tsx` | Tool → event (underwriter only today) |
| `client/src/pages/EdmontonEvent.tsx` | Copy this for `/toronto` |
| `client/src/pages/ThankYouVancouver.tsx` | Waitlist + `href="#"` leftovers |
| `scripts/seed-events-2026.ts` | Wrong Toronto date/slug |
| `server/eventsModule.ts` | Native Stripe (not this event) |
| `server/leadRouter.ts` | Dan vs Nick after a **form** exists |
| `server/ghl-service.ts` / `sendWebhook` in `routes.ts` | GHL + Sheets |
| `server/sitemap.ts` `buildEventsSitemap` | Missing marketing URL |
| `server/seoMeta.ts` | Event JSON-LD (works) |
| `server/seoRender.ts` | Static HTML for `/events/:slug` only |
| `docs/social/multiplex-toronto-sponsor-follow-ups.md` | Ready captions, no UTMs |
| `docs/CRM_WEBHOOK_INTEGRATION.md` | Generic CRM, not wired to tickets |

---

## 8. Live checks (6 Sep 2026)

| URL | Result |
|---|---|
| https://realist.ca/community/events/unpacking-multiplexes-toronto | 200. Schema Event + OvationTix offer. Body is SPA |
| https://realist.ca/community/events | 200. Flagship banner correct. Eventbrite meetups live. Native flagship list empty |
| https://realist.ca/ | Crawler HTML has no event block (`EventPromoFrame` is JS) |
| https://realist.ca/sitemap.xml | **500** |
| https://realist.ca/sitemap-pages.xml | **500** |
| https://realist.ca/sitemap-events.xml | **500** |
| https://terminaltheatre.ca/performance/unpacking-multiplexes/ | 15 Sep, hosts named, prices stale, ticket CTA weak |
| https://torontosocietyofarchitects.ca/events/unpacking-multiplexes-2/ | Same night, price band $101.50–$151.50 |

OvationTix itself timed out from this environment; treat the hardcoded production id `1277443` as live until Dan confirms otherwise on Day 0.

---

*Audit only. No product PR attached. Next eng ticket is P0-1 (photos) + P0-5 (sitemaps) + P0-7 (UTM on the ticket URL).*
