import type { EventSpeaker } from './types'

interface SpeakerCardProps {
  speaker: EventSpeaker
}

export function SpeakerCard({ speaker }: SpeakerCardProps) {
  return (
    <article className="rounded-lg border bg-white p-4">
      <div className="flex gap-4">
        {speaker.imageUrl ? (
          <img
            src={speaker.imageUrl}
            alt={speaker.name}
            className="h-16 w-16 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-slate-100 text-lg font-semibold text-slate-500">
            {speaker.name.slice(0, 1)}
          </div>
        )}
        <div>
          <h3 className="font-semibold">{speaker.name}</h3>
          {(speaker.title || speaker.company) && (
            <p className="text-sm text-slate-600">
              {[speaker.title, speaker.company].filter(Boolean).join(', ')}
            </p>
          )}
          {speaker.bio && <p className="mt-2 text-sm text-slate-700">{speaker.bio}</p>}
        </div>
      </div>
    </article>
  )
}
