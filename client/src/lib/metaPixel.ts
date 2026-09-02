import { track } from "@/lib/analytics";

const PODCAST_PIXEL_ID = "1661103374140663";

type MetaEventData = Record<string, string | number | boolean | undefined>;

type MetaWindow = Window & {
  fbq?: {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    queue?: unknown[][];
    push?: unknown;
    loaded?: boolean;
    version?: string;
  };
  _fbq?: unknown;
  __realistMetaPixelIds?: Set<string>;
};

const playedEpisodes = new Set<string>();
const viewedPodcastPaths = new Set<string>();

function createEventId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `meta_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensurePixel(): MetaWindow | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  const metaWindow = window as MetaWindow;
  if (!metaWindow.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue?.push(args);
      }
    } as NonNullable<MetaWindow["fbq"]>;

    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    metaWindow.fbq = fbq;
    metaWindow._fbq = metaWindow._fbq || fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  metaWindow.__realistMetaPixelIds ??= new Set<string>();
  if (!metaWindow.__realistMetaPixelIds.has(PODCAST_PIXEL_ID)) {
    metaWindow.fbq?.("init", PODCAST_PIXEL_ID);
    metaWindow.__realistMetaPixelIds.add(PODCAST_PIXEL_ID);
  }

  return metaWindow;
}

function sendCapiEvent(eventName: string, eventId: string, customData: MetaEventData): void {
  try {
    fetch("/api/capi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        customData,
      }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function dispatchMetaEvent(
  eventName: string,
  data: MetaEventData,
  type: "standard" | "custom" = "custom",
): void {
  const metaWindow = ensurePixel();
  if (!metaWindow?.fbq) return;

  const eventId = createEventId();
  metaWindow.fbq(type === "standard" ? "track" : "trackCustom", eventName, data, { eventID: eventId });
  sendCapiEvent(eventName, eventId, data);
}

export function trackPodcastPageView(source: "podcast_hub" | "episode_detail"): void {
  const path = window.location.pathname;
  if (viewedPodcastPaths.has(path)) return;
  viewedPodcastPaths.add(path);

  dispatchMetaEvent("PageView", {
    content_category: "podcast",
    page_source: source,
  }, "standard");
}

export function trackPodcastPlay(input: {
  episodeId: string;
  title: string;
  source: "podcast_hub" | "episode_detail";
}): void {
  if (playedEpisodes.has(input.episodeId)) return;
  playedEpisodes.add(input.episodeId);

  dispatchMetaEvent("PodcastEpisodePlay", {
    content_id: input.episodeId,
    content_name: input.title,
    content_category: "podcast",
    page_source: input.source,
  });

  track({
    event: "podcast_episode_played",
    episode_id: input.episodeId,
    title: input.title,
    source: input.source,
  });
}

export function trackPodcastPlatformClick(input: {
  platform: "apple" | "spotify" | "youtube";
  source: "podcast_hub" | "episode_detail";
  episodeId?: string;
  title?: string;
}): void {
  dispatchMetaEvent("PodcastSubscribeClick", {
    platform: input.platform,
    content_id: input.episodeId,
    content_name: input.title,
    content_category: "podcast",
    page_source: input.source,
  });

  track({
    event: "podcast_platform_clicked",
    platform: input.platform,
    episode_id: input.episodeId,
    title: input.title,
    source: input.source,
  });
}
