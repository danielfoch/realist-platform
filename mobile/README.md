# Realist Mobile

Capacitor 6 native wrapper for `https://realist.ca`.

## App Identity

- App name: `Realist`
- Bundle ID / application ID: `ca.realist.app`
- Web origin: `https://realist.ca`

## Setup

```sh
npm install
npx cap add ios
npx cap add android
npx cap sync
```

## Assets

Place source assets at:

- `resources/icon.png` (`1024x1024` PNG)
- `resources/splash.png` (`2732x2732` PNG)

Then run:

```sh
npm install --save-dev @capacitor/assets
npx capacitor-assets generate
```

## Native Builds

Open the generated projects with:

```sh
npx cap open ios
npx cap open android
```

Configure signing in Xcode and Android Studio before store submission.
