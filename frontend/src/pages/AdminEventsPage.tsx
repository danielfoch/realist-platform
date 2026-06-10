import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { RealistEvent } from '../components/events/types'

export function AdminEventsPage() {
  const [events, setEvents] = useState<RealistEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/events')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load events')
        setEvents(data)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load events'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-sm text-slate-600">Create and manage Realist event pages.</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/admin/events/new"><Plus className="h-4 w-4" /> New Event</Link>
        </Button>
      </div>

      {loading && <div className="rounded-lg border bg-white p-6 text-sm text-slate-600">Loading events...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Status</th>
                <th className="p-3">Starts</th>
                <th className="p-3">Slug</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="p-3 font-medium">{event.title}</td>
                  <td className="p-3">{event.status}</td>
                  <td className="p-3">{event.startsAt ? new Date(event.startsAt).toLocaleString() : ''}</td>
                  <td className="p-3">/events/{event.slug}</td>
                  <td className="p-3 text-right">
                    <Link className="font-medium text-primary hover:underline" to={`/admin/events/${event.id}/edit`}>Edit</Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={5}>No events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
