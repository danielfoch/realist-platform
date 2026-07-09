import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { expertProfilePath } from "@shared/eventExpertProfiles";
import type { RealistEventSpeaker } from "./types";

export function SpeakerCard({ speaker }: { speaker: RealistEventSpeaker }) {
  const initials = speaker.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const profilePath = expertProfilePath(speaker.expertProfileSlug || speaker.expertUserId);

  const card = (
    <div className="h-full rounded-lg border bg-card p-5 transition-colors hover:border-primary/50">
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
          {profilePath && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              View expert profile
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!profilePath) return card;

  return (
    <Link href={profilePath} data-testid={`link-speaker-profile-${speaker.expertProfileSlug || speaker.expertUserId}`}>
      {card}
    </Link>
  );
}
