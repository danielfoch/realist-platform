# Realist Mobile (iOS + Android)

A thin Capacitor wrapper around [realist.ca](https://realist.ca). The native
shell loads the live web app, so any change you publish to the website is
visible inside the apps immediately — no app store re-submission required for
content updates.

You only need to re-submit when:

- You bump the app version
- You add or upgrade a native plugin
- You change icons, splash screen, or `capacitor.config.ts`

---

## Prerequisites

- **Node.js 18+** (already installed in this Replit)
- **Apple Developer account** (for iOS) — your partner has this
- **Google Play Developer account** (for Android) — $25 one-time
- **Xcode 15+ on a Mac** (for iOS builds and submission)
- **Android Studio** (for Android builds — works on Mac/Windows/Linux)

You **cannot** finish iOS builds in Replit — Apple requires a Mac running
Xcode. Replit can hold the source code, but the build step happens locally on
a Mac (or via CI like Codemagic / EAS Build / GitHub Actions macOS runners).

Android builds **can** technically run in Replit with the Android SDK
installed, but it's much smoother to do them in Android Studio locally.

---

## First-time setup

Run these commands from the `mobile/` directory.

```bash
cd mobile
npm install

# Add the iOS native project (run on a Mac with Xcode installed)
npx cap add ios

# Add the Android native project (any OS)
npx cap add android

# Pull in the latest Capacitor config + plugins
npx cap sync
```

After `cap add`, two folders are created: `ios/` and `android/`. **Commit
both** to git. They contain the native Xcode/Gradle projects.

---

## Day-to-day workflow

### Updating web content
Nothing to do. The apps load `https://realist.ca` directly. Push to the
website as normal and the change appears in the apps on next launch.

### Updating native config (icons, splash, plugins, version bump)
```bash
cd mobile
# 1. Edit capacitor.config.ts or install a new plugin
npm install @capacitor/some-plugin

# 2. Sync changes into native projects
npx cap sync

# 3. Open in Xcode / Android Studio to rebuild + submit
npx cap open ios       # opens Xcode
npx cap open android   # opens Android Studio
```

### Bumping the app version
- **iOS:** edit `ios/App/App/Info.plist` (`CFBundleShortVersionString` and
  `CFBundleVersion`) — Xcode UI also lets you do this.
- **Android:** edit `android/app/build.gradle` (`versionCode` + `versionName`).

---

## App identity

| Field | Value |
| --- | --- |
| App ID | `ca.realist.app` |
| App name | Realist |
| Loads | `https://realist.ca` |

To change the bundle ID later, edit `appId` in `capacitor.config.ts`, then run
`npx cap sync`. Note: changing the bundle ID after store submission requires a
new app listing.

---

## Icons + splash screen

Drop a 1024×1024 PNG icon at `mobile/resources/icon.png` and a 2732×2732
splash at `mobile/resources/splash.png`, then run:

```bash
npx @capacitor/assets generate
```

(That will install `@capacitor/assets` on first run.)

---

## App Store / Play Store submission checklist

### iOS (one-time)
1. In Xcode: Signing & Capabilities → select your team
2. Product → Archive → Distribute → App Store Connect
3. In App Store Connect: fill in metadata, screenshots, privacy details,
   submit for review
4. Apple may ask "what does this offer beyond the website?" — answers like
   push notifications, biometric login, offline mode, or saved deals usually
   satisfy them. Pure passthrough wrappers can get rejected.

### Android (one-time)
1. Generate a signing keystore: `keytool -genkey -v -keystore release.jks ...`
2. Configure signing in `android/app/build.gradle`
3. Build: `./gradlew bundleRelease` → produces an `.aab`
4. Upload to Google Play Console, fill metadata, submit for review

---

## Avoiding "pure webview" rejection on iOS

To strengthen the case that this is more than a website, we already include
these native capabilities:

- `@capacitor/push-notifications` — register the app with APNs
- `@capacitor/network` — show offline state
- `@capacitor/splash-screen` — native launch screen
- `@capacitor/app` — handle deep links

You can wire push notifications into your existing GHL / backend later. Even
having them registered helps with the App Store review.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Blank screen on launch | Check `server.url` in `capacitor.config.ts` resolves; confirm `allowNavigation` includes the domain |
| Stripe / Google OAuth redirects fail | Add the redirect domain to `server.allowNavigation` |
| iOS reject for IDFA | Ensure no tracking SDK is added without ATT prompt |
| Android shows mixed content warning | Set `allowMixedContent: false` and ensure all assets are HTTPS |
