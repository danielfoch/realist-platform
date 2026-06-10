import { Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import type { EventAgendaSection, EventSpeaker, EventTicketType, RealistEvent } from './types'

interface EventFormProps {
  value: RealistEvent
  saving?: boolean
  onChange: (event: RealistEvent) => void
  onSubmit: () => void
}

function toLocalInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function fieldClass() {
  return 'space-y-1.5'
}

export function EventForm({ value, saving, onChange, onSubmit }: EventFormProps) {
  const set = <K extends keyof RealistEvent>(key: K, next: RealistEvent[K]) => onChange({ ...value, [key]: next })
  const setSpeaker = (index: number, speaker: EventSpeaker) => {
    const speakers = [...value.speakers]
    speakers[index] = speaker
    set('speakers', speakers)
  }
  const setTicket = (index: number, ticket: EventTicketType) => {
    const ticketTypes = [...value.ticketTypes]
    ticketTypes[index] = ticket
    set('ticketTypes', ticketTypes)
  }
  const setAgenda = (index: number, item: EventAgendaSection) => {
    const agendaSections = [...value.agendaSections]
    agendaSections[index] = item
    set('agendaSections', agendaSections)
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Event Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass()}>
            <Label>Title</Label>
            <Input value={value.title} onChange={(event) => set('title', event.target.value)} required />
          </div>
          <div className={fieldClass()}>
            <Label>Slug</Label>
            <Input value={value.slug} onChange={(event) => set('slug', event.target.value)} required />
          </div>
          <div className={fieldClass()}>
            <Label>Event Type</Label>
            <Select value={value.eventType} onChange={(event) => set('eventType', event.target.value as RealistEvent['eventType'])}>
              <option value="IN_PERSON">In-person</option>
              <option value="WEBINAR">Webinar</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
          </div>
          <div className={fieldClass()}>
            <Label>Status</Label>
            <Select value={value.status} onChange={(event) => set('status', event.target.value as RealistEvent['status'])}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>
          <div className={fieldClass()}>
            <Label>Start Date/Time</Label>
            <Input type="datetime-local" value={toLocalInput(value.startsAt)} onChange={(event) => set('startsAt', event.target.value)} required />
          </div>
          <div className={fieldClass()}>
            <Label>End Date/Time</Label>
            <Input type="datetime-local" value={toLocalInput(value.endsAt)} onChange={(event) => set('endsAt', event.target.value)} />
          </div>
          <div className={fieldClass()}>
            <Label>Timezone</Label>
            <Input value={value.timezone} onChange={(event) => set('timezone', event.target.value)} />
          </div>
          <div className={fieldClass()}>
            <Label>Capacity</Label>
            <Input type="number" min="0" value={value.capacity ?? ''} onChange={(event) => set('capacity', event.target.value ? Number(event.target.value) : null)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Header Image URL</Label>
            <Input value={value.headerImageUrl || ''} onChange={(event) => set('headerImageUrl', event.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Short Description</Label>
            <Input value={value.shortDescription || ''} onChange={(event) => set('shortDescription', event.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Long Description</Label>
            <textarea className="min-h-32 w-full rounded-md border px-3 py-2 text-sm" value={value.longDescription || ''} onChange={(event) => set('longDescription', event.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Location</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={fieldClass()}>
            <Label>Venue Name</Label>
            <Input value={value.venueName || ''} onChange={(event) => set('venueName', event.target.value)} />
          </div>
          <div className={fieldClass()}>
            <Label>Venue Address</Label>
            <Input value={value.venueAddress || ''} onChange={(event) => set('venueAddress', event.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Online Meeting URL</Label>
            <Input value={value.onlineUrl || ''} onChange={(event) => set('onlineUrl', event.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Speakers</h2>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => set('speakers', [...value.speakers, { name: '', title: '', company: '', bio: '', imageUrl: '', sortOrder: value.speakers.length }])}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-4">
          {value.speakers.map((speaker, index) => (
            <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
              <Input placeholder="Name" value={speaker.name} onChange={(event) => setSpeaker(index, { ...speaker, name: event.target.value })} />
              <Input placeholder="Title" value={speaker.title || ''} onChange={(event) => setSpeaker(index, { ...speaker, title: event.target.value })} />
              <Input placeholder="Company" value={speaker.company || ''} onChange={(event) => setSpeaker(index, { ...speaker, company: event.target.value })} />
              <Input placeholder="Image URL" value={speaker.imageUrl || ''} onChange={(event) => setSpeaker(index, { ...speaker, imageUrl: event.target.value })} />
              <textarea className="min-h-20 rounded-md border px-3 py-2 text-sm md:col-span-2" placeholder="Bio" value={speaker.bio || ''} onChange={(event) => setSpeaker(index, { ...speaker, bio: event.target.value })} />
              <Button type="button" variant="ghost" size="sm" className="w-fit gap-2" onClick={() => set('speakers', value.speakers.filter((_, speakerIndex) => speakerIndex !== index))}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Agenda</h2>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => set('agendaSections', [...value.agendaSections, { title: '', description: '', time: '' }])}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-3">
          {value.agendaSections.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[160px_1fr_auto]">
              <Input placeholder="Time" value={item.time || ''} onChange={(event) => setAgenda(index, { ...item, time: event.target.value })} />
              <Input placeholder="Title" value={item.title} onChange={(event) => setAgenda(index, { ...item, title: event.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => set('agendaSections', value.agendaSections.filter((_, agendaIndex) => agendaIndex !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <textarea className="min-h-20 rounded-md border px-3 py-2 text-sm md:col-span-3" placeholder="Description" value={item.description || ''} onChange={(event) => setAgenda(index, { ...item, description: event.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ticket Tiers</h2>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => set('ticketTypes', [...value.ticketTypes, { name: '', description: '', priceCents: 0, currency: 'cad', quantityTotal: null, salesStartAt: '', salesEndAt: '', isActive: true }])}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-4">
          {value.ticketTypes.map((ticket, index) => (
            <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
              <Input placeholder="Name" value={ticket.name} onChange={(event) => setTicket(index, { ...ticket, name: event.target.value })} required />
              <Input type="number" min="0" placeholder="Price cents" value={ticket.priceCents} onChange={(event) => setTicket(index, { ...ticket, priceCents: Number(event.target.value) })} />
              <Input placeholder="Currency" value={ticket.currency} onChange={(event) => setTicket(index, { ...ticket, currency: event.target.value.toLowerCase() })} />
              <Input type="number" min="0" placeholder="Quantity available" value={ticket.quantityTotal ?? ''} onChange={(event) => setTicket(index, { ...ticket, quantityTotal: event.target.value ? Number(event.target.value) : null })} />
              <Input type="datetime-local" value={toLocalInput(ticket.salesStartAt)} onChange={(event) => setTicket(index, { ...ticket, salesStartAt: event.target.value })} />
              <Input type="datetime-local" value={toLocalInput(ticket.salesEndAt)} onChange={(event) => setTicket(index, { ...ticket, salesEndAt: event.target.value })} />
              <Input className="md:col-span-2" placeholder="Description" value={ticket.description || ''} onChange={(event) => setTicket(index, { ...ticket, description: event.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ticket.isActive} onChange={(event) => setTicket(index, { ...ticket, isActive: event.target.checked })} />
                Active
              </label>
              <Button type="button" variant="ghost" size="sm" className="w-fit gap-2" onClick={() => set('ticketTypes', value.ticketTypes.filter((_, ticketIndex) => ticketIndex !== index))}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">SEO and Policy</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="SEO title" value={value.seoTitle || ''} onChange={(event) => set('seoTitle', event.target.value)} />
          <Input placeholder="SEO description" value={value.seoDescription || ''} onChange={(event) => set('seoDescription', event.target.value)} />
          <textarea className="min-h-24 rounded-md border px-3 py-2 text-sm md:col-span-2" placeholder="Refund policy" value={value.refundPolicy || ''} onChange={(event) => set('refundPolicy', event.target.value)} />
        </div>
      </section>

      <Button type="submit" className="gap-2" disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Event'}
      </Button>
    </form>
  )
}
