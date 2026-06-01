import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SEO } from '../components/SEO'
import { EventPageTemplate } from '../components/events/EventPageTemplate'
import type { RealistEvent } from '../components/events/types'

export function EventDetailsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [event, setEvent] = useState<RealistEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/events/${slug}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Event not found')
        setEvent(data)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Event not found'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-slate-600">Loading event...</div>
  }

  if (error || !event) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Link to="/" className="mt-4 inline-block font-medium text-primary hover:underline">Back to Realist.ca</Link>
      </div>
    )
  }

  return (
    <>
      <SEO
        title={event.seoTitle || event.title}
        description={event.seoDescription || event.shortDescription || undefined}
        image={event.headerImageUrl || undefined}
        url={`/events/${event.slug}`}
      />
      <EventPageTemplate event={event} />
    </>
  )
}
