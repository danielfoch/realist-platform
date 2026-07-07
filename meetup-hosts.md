# Local Experts / Meetup Hosts — Onboarding Tracker

**Program (updated 2026-07-07):** Meetup hosts are being repositioned as **Realist Local Experts** —
the exclusive investor-referral partner for their market. This replaces the old
"$250/month meetup-host" framing with the platform-wide model: **free to join, 25% referral
on closed deals** (realtors, payable to Valery Real Estate Inc.) / 50% on funded deals
(mortgage brokers, payable to BLD Financial). See `shared/partnerNetwork.ts` for terms and
`client/src/pages/LocalExperts.tsx` for the recruiting page (`/local-experts`).

> **Pricing transition (Dan decision):** the $250/mo meetup-host fee is superseded by the
> free referral model. Confirm how existing paying hosts are transitioned (grandfather /
> refund / simply stop billing) before sending the invite.

## Routing context

Leads within ~2 hours' drive of Toronto (~160 km) are worked **in-house by Valery Real Estate Inc.**
(`shared/leadRoutingPolicy.ts`). Everywhere else routes to the claimed-market Local Expert —
so this roster is for markets **outside** the Toronto in-house zone.

## Invite roster (2026-07-07)

Invitation email drafted for Dan to send (see `docs/LOCAL_EXPERT_INVITE_EMAIL.md`).
Markets are inferred from brokerage/domain where not yet confirmed — **Dan to confirm each market**.

| Name | Email | Inferred market / brokerage | Type | Market confirmed? |
|------|-------|-----------------------------|------|-------------------|
| Sylvia Castonguay | info@sylviacrealty.com | Calgary, AB | Realtor | ✓ (prior doc) |
| LJ Aguinaga | lj@ljrealties.com | Montreal, QC | Realtor | ✓ (prior doc) |
| Cameron Brioux | cameronbrioux@gmail.com | Moncton, NB | Realtor | ✓ (prior doc) |
| Brandon Jimenez | brandon@medaloproperties.com | — (Medalo Properties) | Realtor | ✗ |
| Bret Stankowski | bret@stanmtg.ca | — (Stan Mortgage) | Mortgage | ✗ |
| Danny Cordeiro | danny@midurban.ca | — (MidUrban) | Realtor | ✗ |
| Leonard Loiero | leo@midurban.ca | — (MidUrban) | Realtor | ✗ |
| Paolo Castellano | paolo@midurban.ca | — (MidUrban) | Realtor | ✗ |
| Jessica Kuan | jessica.kuan@cleartrust.ca | — (ClearTrust) | Mortgage | ✗ |
| Cody Kelly | mightyirishhomeinvestors@outlook.com | — (Mighty Irish Home Investors) | Realtor | ✗ |
| Michael Kardash | mike@wolfedenrealestate.com | — (Wolfeden Real Estate) | Realtor | ✗ |
| Ryan MacNeil | ryan@keycap.ca | — (KeyCap) | Realtor | ✗ |
| Trevor Nicolle | trevornicolle@royallepage.ca | — (Royal LePage) | Realtor | ✗ |
| Serge Papineau | serge@sergepapineau.com | — | Realtor | ✗ |
| Natasha Flemming | natashalflemming@gmail.com | — | Realtor | ✗ |
| Trey Vives | trey.vives@gmail.com | — | Realtor | ✗ |
| Zach Dejonge | zach.dejonge@gmail.com | — | Realtor | ✗ |
| (Avowels) | avowels13@gmail.com | — (name unconfirmed) | ? | ✗ |

**Note:** Danny, Leonard, and Paolo all use @midurban.ca — likely the same brokerage/market;
decide whether one claims the market or they share.

## Onboarding flow (new model)

1. Dan sends the invite email (personalized `[First Name]`).
2. Recipient visits `/local-experts` → **Claim Your Market** → `/partner/onboarding`.
3. They sign the OREA Form 641-style referral agreement online (`shared/partnerNetwork.ts`,
   version `2026-07-07.v2` — now includes the 14-day status-reporting condition in §4).
4. On first lead claim, the signature snapshot is stored; leads route to them by market.
5. Homie (GHL-backed partner CRM) is the eventual management surface; the Realist CRM
   workspace covers it until then.

## Tasks

- [ ] Dan: decide the $250/mo → free transition for existing paying hosts
- [ ] Dan: confirm each invitee's market (fill the table)
- [ ] Dan: resolve the 3 MidUrban invitees → one claim or shared
- [ ] Send personalized invite email to the roster
- [ ] Confirm the public about page (`/local-experts/about`) before the invite goes out
