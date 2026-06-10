import { Calendar, MapPin, Monitor, Users } from 'lucide-react'
import { SpeakerCard } from './SpeakerCard'
import { TicketSelector } from './TicketSelector'
import type { RealistEvent } from './types'

interface EventPageTemplateProps {
  event: RealistEvent
}

function formatEventDate(event: RealistEvent) {
  const startsAt = new Date(event.startsAt)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone || 'America/Toronto',
  })
  return formatter.format(startsAt)
}

export function EventPageTemplate({ event }: EventPageTemplateProps) {
  const isOnline = event.eventType === 'WEBINAR'
  const totalSold = event.ticketTypes.reduce((sum, ticket) => sum + (ticket.quantitySold || 0), 0)
  const capacityRemaining = event.capacity == null ? null : Math.max(event.capacity - totalSold, 0)

  return (
    <div className="bg-slate-50">
      <section className="bg-white">
        {event.headerImageUrl && (
          <img src={event.headerImageUrl} alt={event.title} className="h-[38vh] min-h-72 w-full object-cover" />
        )}
        <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
              Realist Events
            </p>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">{event.title}</h1>
            {event.shortDescription && <p className="mt-4 max-w-3xl text-lg text-slate-700">{event.shortDescription}</p>}
            <div className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="flex gap-2">
                <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                <span>{formatEventDate(event)} {event.timezone}</span>
              </div>
              <div className="flex gap-2">
                {isOnline ? <Monitor className="mt-0.5 h-4 w-4 text-primary" /> : <MapPin className="mt-0.5 h-4 w-4 text-primary" />}
                <span>{isOnline ? 'Online event' : [event.venueName, event.venueAddress].filter(Boolean).join(', ')}</span>
              </div>
              {capacityRemaining !== null && (
                <div className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{capacityRemaining > 0 ? `${capacityRemaining} spots remaining` : 'Sold out'}</span>
                </div>
              )}
              {event.onlineUrl && (
                <div className="flex gap-2">
                  <Monitor className="mt-0.5 h-4 w-4 text-primary" />
                  <a href={event.onlineUrl} className="font-medium text-primary hover:underline">Join online</a>
                </div>
              )}
            </div>
          </div>
          <TicketSelector slug={event.slug} tickets={event.ticketTypes} />
        </div>
      </section>

      <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {event.longDescription && (
            <section>
              <h2 className="mb-3 text-2xl font-semibold">About This Event</h2>
              <div className="whitespace-pre-line text-slate-700">{event.longDescription}</div>
            </section>
          )}

          {event.speakers.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold">Speakers</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {event.speakers.map((speaker) => <SpeakerCard key={`${speaker.name}-${speaker.sortOrder}`} speaker={speaker} />)}
              </div>
            </section>
          )}

          {event.agendaSections.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold">Agenda</h2>
              <div className="space-y-3">
                {event.agendaSections.filter((item) => item.title).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border bg-white p-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      {item.time && <span className="text-sm font-medium text-primary">{item.time}</span>}
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                    {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-2 font-semibold">Refund Policy</h2>
            <p className="text-sm text-slate-600">{event.refundPolicy || 'Refund policy will be shared by the organizer.'}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
