import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

// Options for multi-select fields
const CANADIAN_PROVINCES = [
  'British Columbia', 'Alberta', 'Saskatchewan', 'Manitoba', 'Ontario', 
  'Quebec', 'New Brunswick', 'Nova Scotia', 'Prince Edward Island', 'Newfoundland and Labrador'
]

const ASSET_TYPES = [
  'Single Family', 'Multi-Family', 'Condo', 'Townhouse', 'Commercial', 'Industrial', 'Land', 'Mixed-Use'
]

const DEAL_TYPES = [
  'Buy', 'Sell', 'Investment', 'Commercial', 'Rentals', 'Property Management'
]

const AVG_DEAL_SIZES = [
  'Under $500K', '$500K - $1M', '$1M - $5M', '$5M - $10M', 'Over $10M'
]

interface FormData {
  name: string
  email: string
  phone: string
  brokerage: string
  markets_served: string[]
  asset_types: string[]
  deal_types: string[]
  avg_deal_size: string
  referral_agreement: boolean
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  brokerage: '',
  markets_served: [],
  asset_types: [],
  deal_types: [],
  avg_deal_size: '',
  referral_agreement: false
}

export const JoinRealtorsPage: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const updateField = (field: keyof FormData, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors([])
  }

  const toggleArrayField = (field: 'markets_served' | 'asset_types' | 'deal_types', value: string) => {
    const current = formData[field] as string[]
    const updated = current.includes(value) 
      ? current.filter(v => v !== value)
      : [...current, value]
    updateField(field, updated)
  }

  const validateStep = (currentStep: number): string[] => {
    const errs: string[] = []
    
    if (currentStep === 1) {
      if (!formData.name.trim()) errs.push('Name is required')
      if (!formData.email.trim()) errs.push('Email is required')
      if (!formData.phone.trim()) errs.push('Phone is required')
      if (!formData.brokerage.trim()) errs.push('Brokerage is required')
    }
    
    if (currentStep === 2) {
      if (formData.markets_served.length === 0) errs.push('Select at least one market')
      if (formData.asset_types.length === 0) errs.push('Select at least one asset type')
      if (formData.deal_types.length === 0) errs.push('Select at least one deal type')
    }
    
    if (currentStep === 3) {
      if (!formData.avg_deal_size) errs.push('Select average deal size')
      if (!formData.referral_agreement) errs.push('You must agree to the referral terms')
    }
    
    return errs
  }

  const handleNext = () => {
    const errs = validateStep(step)
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    setStep(prev => prev + 1)
    setErrors([])
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
    setErrors([])
  }

  const handleSubmit = async () => {
    if (!formData.referral_agreement) {
      setErrors(['You must agree to the referral terms'])
      return
    }

    setLoading(true)
    setErrors([])

    try {
      await axios.post('/api/partners/realtors/join', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        brokerage: formData.brokerage,
        markets_served: formData.markets_served,
        asset_types: formData.asset_types,
        deal_types: formData.deal_types,
        avg_deal_size: formData.avg_deal_size,
        referral_agreement: formData.referral_agreement
      })

      toast({
        title: 'Welcome to Realist!',
        description: 'Your realtor partner application has been submitted successfully.',
        variant: 'default'
      })
      
      navigate('/join/realtors/success')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { errors?: string[]; error?: string } } }
      const errorMsg = err.response?.data?.errors?.[0] || err.response?.data?.error || 'Submission failed. Please try again.'
      setErrors([errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-white">
            Realist.ca
          </Link>
          <nav className="flex gap-4">
            <Link to="/" className="text-sm font-medium hover:text-primary">
              Browse Listings
            </Link>
            <Link to="/join/lenders" className="text-sm font-medium hover:text-primary">
              Join as Lender
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Join the Realist Partner Network</h1>
            <p className="text-xl text-slate-400 mb-6">
              Get matched with qualified investor clients looking for properties in your market.
            </p>
            <div className="flex justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Qualified Leads</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Transparent Referrals</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>No Upfront Fees</span>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-blue-600' : 'bg-slate-800'}`} />}
              </div>
            ))}
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
              {errors.map((err, i) => (
                <p key={i} className="text-red-400 text-sm">• {err}</p>
              ))}
            </div>
          )}

          {/* Form Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>
                {step === 1 && 'Basic Information'}
                {step === 2 && 'Your Specialization'}
                {step === 3 && 'Agreement'}
              </CardTitle>
              <CardDescription>
                {step === 1 && 'Tell us about yourself'}
                {step === 2 && 'Select your markets and expertise'}
                {step === 3 && 'Review and confirm'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e => updateField('name', e.target.value)}
                      placeholder="John Smith"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="john@brokerage.ca"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={e => updateField('phone', e.target.value)}
                      placeholder="(416) 555-1234"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <Label htmlFor="brokerage">Brokerage *</Label>
                    <Input
                      id="brokerage"
                      value={formData.brokerage}
                      onChange={e => updateField('brokerage', e.target.value)}
                      placeholder="Royal LePage"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label>Markets Served *</Label>
                    <p className="text-sm text-slate-400 mb-3">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {CANADIAN_PROVINCES.map(prov => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => toggleArrayField('markets_served', prov)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            formData.markets_served.includes(prov)
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Asset Types *</Label>
                    <p className="text-sm text-slate-400 mb-3">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {ASSET_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleArrayField('asset_types', type)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            formData.asset_types.includes(type)
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Deal Types *</Label>
                    <p className="text-sm text-slate-400 mb-3">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {DEAL_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleArrayField('deal_types', type)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            formData.deal_types.includes(type)
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label>Average Deal Size *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {AVG_DEAL_SIZES.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateField('avg_deal_size', size)}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                            formData.avg_deal_size === size
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="referral"
                        checked={formData.referral_agreement}
                        onChange={e => updateField('referral_agreement', e.target.checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="referral" className="text-sm text-slate-300 cursor-pointer">
                        I agree to the referral terms and conditions. I understand that Realist will 
                        match me with qualified leads and that a referral fee agreement will be 
                        established for successful transactions.
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                {step > 1 ? (
                  <Button variant="outline" onClick={handleBack} disabled={loading}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                
                {step < 3 ? (
                  <Button onClick={handleNext}>Next</Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Application'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

// Simple check circle icon component
const CheckCircle: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

export default JoinRealtorsPage