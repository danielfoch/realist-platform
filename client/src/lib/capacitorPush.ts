/**
 * Native push registration for the Capacitor iOS/Android shells.
 *
 * The apps load realist.ca directly and Capacitor injects `window.Capacitor`
 * into the page — so this module uses the injected bridge (no npm dependency)
 * and is a silent no-op in regular browsers.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: Record<string, any>;
    };
  }
}

let initialized = false;

export async function initNativePush(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const push = cap.Plugins?.PushNotifications;
  if (!push) return;

  try {
    const status = await push.checkPermissions();
    let receive = status.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      receive = (await push.requestPermissions()).receive;
    }
    if (receive !== "granted") return;

    await push.addListener("registration", async (token: { value: string }) => {
      try {
        await fetch("/api/mobile/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: token.value,
            platform: cap.getPlatform?.() || "web",
          }),
        });
      } catch (error) {
        console.warn("[push] token upload failed", error);
      }
    });
    await push.register();
  } catch (error) {
    console.warn("[push] native push init failed", error);
  }
}
