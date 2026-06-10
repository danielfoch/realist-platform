import { useState } from 'react'
import { Loader2, Ticket } from 'lucide-react'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import type { EventTicketType } from './types'

interface TicketSelectorProps {
  slug: string
  tickets: EventTicketType[]
}

function formatMoney(priceCents: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(priceCents / 100)
}

function remaining(ticket: EventTicketType) {
  if (ticket.quantityTotal == null) return null
  return Math.max(ticket.quantityTotal - (ticket.quantitySold || 0), 0)
}

export function TicketSelector({ slug, tickets }: TicketSelectorProps) {
  const availableTickets = tickets.filter((ticket) => ticket.isActive)
  const [ticketTypeId, setTicketTypeId] = useState(availableTickets[0]?.id || '')
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const selected = availableTickets.find((ticket) => ticket.id === ticketTypeId)
  const selectedRemaining = selected ? remaining(selected) : 0
  const soldOut = !selected || selectedRemaining === 0

  async function checkout() {
    if (!selected?.id) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/events/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketTypeId: selected.id, quantity }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout')
    } finally {
      setLoading(false)
    }
  }

  if (availableTickets.length === 0) {
    return <div className="rounded-lg border p-4 text-sm text-slate-600">Tickets are not available yet.</div>
  }

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Tickets</h2>
      </div>
      <div className="space-y-3">
        <Select value={ticketTypeId} onChange={(event) => setTicketTypeId(event.target.value)}>
          {availableTickets.map((ticket) => (
            <option key={ticket.id} value={ticket.id}>
              {ticket.name} - {formatMoney(ticket.priceCents, ticket.currency)}
            </option>
          ))}
        </Select>
        <Select value={String(quantity)} onChange={(event) => setQuantity(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </Select>
        {selected?.description && <p className="text-sm text-slate-600">{selected.description}</p>}
        {selectedRemaining !== null && (
          <p className="text-sm text-slate-600">
            {selectedRemaining > 0 ? `${selectedRemaining} tickets remaining` : 'Sold out'}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full gap-2" disabled={loading || soldOut} onClick={checkout}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {soldOut ? 'Sold out' : 'Checkout'}
        </Button>
      </div>
    </div>
  )
}
