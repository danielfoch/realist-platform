# Event Expert Profile Architecture

Realist event speakers can now link to expert profiles in two stages:

1. Claimed profiles use `realist_event_speakers.expert_user_id`.
   - This points at the existing `users.id` used by `/experts/:userId`.
   - Use this when the expert already has an approved public `industry_partners` profile.

2. Draft/unclaimed event profiles use `realist_event_speakers.expert_profile_slug`.
   - This powers direct event-page links such as `/experts/noam-hazan` before the expert has claimed an account.
   - Draft profile content lives in `shared/eventExpertProfiles.ts`.
   - Draft profiles are not added to the public `/experts` directory. They are reachable from event speaker cards and invite links only.

## Claim Path

When an expert claims or sets up their profile:

1. Create or connect their Realist user/account.
2. Approve/publish the expert in the existing partner/profile system.
3. Update matching `realist_event_speakers` rows:
   - set `expert_user_id` to the claimed user ID
   - keep `expert_profile_slug` as a stable legacy alias only if needed for old invite links
4. Move durable profile fields out of `shared/eventExpertProfiles.ts` and into the claimed profile source.
5. Remove the draft profile from `shared/eventExpertProfiles.ts` after old invite links no longer need the fallback.

## Content Rule

Draft profile fields must be copied from existing event speaker data or another sourced Realist record. Do not invent emails, claims, titles, credentials, service areas, links, or contact info.

Unknown emails stay marked as `MISSING — request from jonathan@realist.ca` in `docs/expert-profile-invite-email.md`.
