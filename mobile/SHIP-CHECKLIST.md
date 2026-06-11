# Ship Checklist — Realist iOS + Android

*Status as of 2026-06-11: Capacitor 6 shell synced, icons/splash generated from
`resources/` (87 Android + 10 iOS assets), **iOS simulator build verified
succeeding** (Xcode 26), push-token registration wired end-to-end
(`client/src/lib/capacitorPush.ts` → `POST /api/mobile/push-token` →
`push_device_tokens` table). What remains is accounts, signing, and store
listings — human steps only.*

## What the apps are
Thin native shells loading https://realist.ca live. Website deploys update the
apps instantly; store re-submission only needed for native changes (plugins,
icons, config). Tickets, RSVPs, the analyzer, and the CRM all work as-is.

## iOS (needs a Mac + Apple Developer account — $99 USD/yr)
1. [ ] Apple Developer Program enrolled (partner reportedly has this).
2. [ ] `cd mobile && npm install && npx cap open ios` (set `LANG=en_US.UTF-8` if pods complain).
3. [ ] Xcode → target App → Signing & Capabilities → select Team. Bundle ID `ca.realist.app`.
4. [ ] Add capability **Push Notifications** (+ Background Modes → Remote notifications).
5. [ ] Apple Developer portal → Keys → create **APNs key** (.p8) — save key ID + team ID (needed when we wire sending).
6. [ ] Product → Archive → Distribute → App Store Connect.
7. [ ] App Store Connect: listing (name "Realist — Real Estate Deals", screenshots from simulator, privacy: account data + analytics), submit.
8. [ ] Review-risk answer (guideline 4.2 "minimum functionality"): push notifications registered, native account-backed RSVP/ticketing, saved deals — emphasize these in Review Notes.

## Android (any OS with Android Studio)
1. [ ] Google Play Console account ($25 one-time).
2. [ ] Firebase project → add Android app `ca.realist.app` → download `google-services.json` → place in `mobile/android/app/`. (Required for push on Android; app builds without it but FCM won't register.)
3. [ ] Generate upload keystore: `keytool -genkey -v -keystore realist-upload.keystore -alias realist -keyalg RSA -keysize 2048 -validity 10000` → fill `android/key.properties` from `key.properties.example`. **Back the keystore up — losing it means losing the app listing.**
4. [ ] `cd mobile && npm run build:android` (or Android Studio → Build → Generate Signed Bundle → AAB).
5. [ ] Play Console: create app, upload AAB to internal testing, listing + data-safety form, promote to production.

## Push sending (later, after tokens accumulate)
- iOS: APNs key from step 5 above. Android: Firebase Admin service account.
- Backend sender = small addition to `server/mobilePush.ts` (firebase-admin handles both platforms via FCM). Tokens are already being collected.
- First use case: event announcements + "deal of the week" — reuse the events announce flow.

## Verify after store approval
- [ ] Buy a test ticket in-app (Stripe checkout domain is allowlisted).
- [ ] RSVP to a meetup in-app while logged out (account-creation flow).
- [ ] Confirm a row lands in `push_device_tokens` on first app launch.
