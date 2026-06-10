import { Link, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/button'

export function EventSuccessPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-xl rounded-lg border bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h1 className="text-3xl font-bold">You are registered</h1>
        <p className="mt-3 text-slate-600">
          Stripe has received your payment. Your ticket, account access, and event details are fulfilled by the webhook, so your confirmation email may take a moment.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to={slug ? `/events/${slug}` : '/'}>Back to event</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
