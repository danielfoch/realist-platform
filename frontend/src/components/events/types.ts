export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type EventType = 'IN_PERSON' | 'WEBINAR' | 'HYBRID'

export interface EventSpeaker {
  id?: string
  name: string
  title?: string | null
  company?: string | null
  bio?: string | null
  imageUrl?: string | null
  sortOrder: number
}

export interface EventTicketType {
  id?: string
  name: string
  description?: string | null
  priceCents: number
  currency: string
  quantityTotal?: number | null
  quantitySold?: number
  salesStartAt?: string | null
  salesEndAt?: string | null
  isActive: boolean
}

export interface EventAgendaSection {
  title: string
  description?: string
  time?: string
}

export interface RealistEvent {
  id?: string
  title: string
  slug: string
  shortDescription?: string | null
  longDescription?: string | null
  headerImageUrl?: string | null
  eventType: EventType
  status: EventStatus
  startsAt: string
  endsAt?: string | null
  timezone: string
  venueName?: string | null
  venueAddress?: string | null
  onlineUrl?: string | null
  agendaSections: EventAgendaSection[]
  capacity?: number | null
  refundPolicy?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  createdByEmail?: string
  speakers: EventSpeaker[]
  ticketTypes: EventTicketType[]
}

export const emptyEvent: RealistEvent = {
  title: '',
  slug: '',
  shortDescription: '',
  longDescription: '',
  headerImageUrl: '',
  eventType: 'IN_PERSON',
  status: 'DRAFT',
  startsAt: '',
  endsAt: '',
  timezone: 'America/Toronto',
  venueName: '',
  venueAddress: '',
  onlineUrl: '',
  agendaSections: [{ title: '', description: '', time: '' }],
  capacity: null,
  refundPolicy: '',
  seoTitle: '',
  seoDescription: '',
  speakers: [{ name: '', title: '', company: '', bio: '', imageUrl: '', sortOrder: 0 }],
  ticketTypes: [{
    name: 'General Admission',
    description: '',
    priceCents: 0,
    currency: 'cad',
    quantityTotal: null,
    salesStartAt: '',
    salesEndAt: '',
    isActive: true,
  }],
}
