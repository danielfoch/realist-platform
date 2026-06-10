import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RealistEventSpeaker } from "./types";

export function SpeakerCard({ speaker }: { speaker: RealistEventSpeaker }) {
  const initials = speaker.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={speaker.imageUrl || undefined} alt={speaker.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">{speaker.name}</h3>
          {(speaker.title || speaker.company) && (
            <p className="text-sm text-muted-foreground">
              {[speaker.title, speaker.company].filter(Boolean).join(", ")}
            </p>
          )}
          {speaker.bio && <p className="mt-3 text-sm leading-6 text-muted-foreground">{speaker.bio}</p>}
        </div>
      </div>
    </div>
  );
}
