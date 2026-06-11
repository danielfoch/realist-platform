import { useEffect, useState } from "react";

/**
 * Offers the native app to mobile-web visitors (iOS → App Store,
 * Android → Play Store). Hidden inside the Capacitor apps themselves,
 * after dismissal (30 days), and until the store URLs below are set
 * post-launch — so this ships dormant and lights up when the apps do.
 */
const IOS_APP_URL = import.meta.env.VITE_IOS_APP_URL || "";
const ANDROID_APP_URL = import.meta.env.VITE_ANDROID_APP_URL || "";
const DISMISS_KEY = "realist_app_banner_dismissed_at";

export function GetAppBanner() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if ((window as any).Capacitor?.isNativePlatform?.()) return; // already in the app
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissed < 30 * 24 * 60 * 60 * 1000) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua) && IOS_APP_URL) setPlatform("ios");
    else if (/Android/i.test(ua) && ANDROID_APP_URL) setPlatform("android");
  }, []);

  if (!platform) return null;
  const url = platform === "ios" ? IOS_APP_URL : ANDROID_APP_URL;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-gray-900 px-4 py-2.5 text-white">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-lg">📱</span>
        <p className="truncate text-sm">
          <strong>Realist is better in the app</strong>
          <span className="hidden sm:inline"> — faster analysis, push alerts on price drops</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={url} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white no-underline">
          Get the app
        </a>
        <button
          aria-label="Dismiss"
          className="px-1 text-gray-400"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setPlatform(null);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
