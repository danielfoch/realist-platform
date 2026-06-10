import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const JoinLendersSuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="text-2xl font-bold text-white">
            Realist.ca
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Welcome Aboard!</h1>
          <p className="text-xl text-slate-400 mb-8">
            Your lender partner application has been submitted. Get ready to fund your first deals.
          </p>

          <Card className="bg-slate-900 border-slate-800 mb-8">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">What's Next?</h3>
              <ul className="text-left space-y-3 text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500">1.</span>
                  <span>We'll verify your lending credentials</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500">2.</span>
                  <span>You'll receive an email with partner onboarding details</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-500">3.</span>
                  <span>Start receiving pre-vetted borrower leads</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link to="/">Browse Listings</Link>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link to="/join/realtors">Refer a Realtor</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default JoinLendersSuccessPage