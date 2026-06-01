import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EventForm } from '../components/events/EventForm'
import { emptyEvent, type RealistEvent } from '../components/events/types'

export function AdminEventEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<RealistEvent>(emptyEvent)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/admin/events/${id}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load event')
        setEvent({
          ...emptyEvent,
          ...data,
          speakers: data.speakers?.length ? data.speakers : emptyEvent.speakers,
          ticketTypes: data.ticketTypes?.length ? data.ticketTypes : emptyEvent.ticketTypes,
          agendaSections: data.agendaSections?.length ? data.agendaSections : emptyEvent.agendaSections,
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load event'))
      .finally(() => setLoading(false))
  }, [id, mode])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...event,
        speakers: event.speakers.filter((speaker) => speaker.name.trim()),
        agendaSections: event.agendaSections.filter((item) => item.title.trim()),
        ticketTypes: event.ticketTypes.filter((ticket) => ticket.name.trim()),
      }
      const response = await fetch(mode === 'edit' ? `/api/admin/events/${id}` : '/api/admin/events', {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save event')
      navigate(`/admin/events/${data.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/admin/events" className="text-sm font-medium text-primary hover:underline">Back to events</Link>
          <h1 className="mt-2 text-3xl font-bold">{mode === 'edit' ? 'Edit Event' : 'New Event'}</h1>
        </div>
        {loading && <div className="rounded-lg border bg-white p-6 text-sm text-slate-600">Loading event...</div>}
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!loading && <EventForm value={event} onChange={setEvent} onSubmit={save} saving={saving} />}
      </div>
    </div>
  )
}
