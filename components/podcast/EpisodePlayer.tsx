"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function EpisodePlayer({
  audioUrl,
  title,
  compact = false,
}: {
  audioUrl: string;
  title: string;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrent(next);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-hairline bg-surface ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <audio ref={audioRef} src={audioUrl} preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${title}` : `Play ${title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2.5" y="2" width="4" height="12" rx="1" />
            <rect x="9.5" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11a.6.6 0 0 0 .92.5l8.6-5.5a.6.6 0 0 0 0-1L4.92 2a.6.6 0 0 0-.92.5Z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={current}
          onChange={seek}
          aria-label="Seek"
          className="w-full accent-[var(--color-brand)]"
        />
        <div className="tnum mt-0.5 flex justify-between text-xs text-ink-faint">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
