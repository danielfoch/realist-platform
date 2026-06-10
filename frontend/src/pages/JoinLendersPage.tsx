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

const LENDING_TYPES = [
  'Conventional', 'DSCR', 'Bridge', 'Hard Money', 'Private Money', 'SBA', 'Commercial', 'Construction'
]

const TURNAROUND_OPTIONS = [
  'Same Day', '1-3 Days', '1 Week', '2 Weeks', '1 Month'
]

interface FormData {
  contact_name: string
  company_name: string
  email: string
  phone: string
  lending_types: string[]
  target_markets: string[]
  loan_size_min: number
  loan_size_max: number
  preferred_dscr_min: number | ''
  preferred_ltv_max: number | ''
  turnaround_time: string
  referral_agreement: boolean
}

const initialFormData: FormData = {
  contact_name: '',
  company_name: '',
  email: '',
  phone: '',
  lending_types: [],
  target_markets: [],
  loan_size_min: 0,
  loan_size_max: 0,
  preferred_dscr_min: '',
  preferred_ltv_max: '',
  turnaround_time: '',
  referral_agreement: false
}

export const JoinLendersPage: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors([])
  }

  const toggleArrayField = (field: 'lending_types' | 'target_markets', value: string) => {
    const current = formData[field] as string[]
    const updated = current.includes(value) 
      ? current.filter(v => v !== value)
      : [...current, value]
    updateField(field, updated)
  }

  const validateStep = (currentStep: number): string[] => {
    const errs: string[] = []
    
    if (currentStep === 1) {
      if (!formData.contact_name.trim()) errs.push('Contact name is required')
      if (!formData.company_name.trim()) errs.push('Company name is required')
      if (!formData.email.trim()) errs.push('Email is required')
      if (!formData.phone.trim()) errs.push('Phone is required')
    }
    
    if (currentStep === 2) {
      if (formData.lending_types.length === 0) errs.push('Select at least one lending type')
      if (formData.target_markets.length === 0) errs.push('Select at least one target market')
      if (formData.loan_size_min <= 0) errs.push('Minimum loan size is required')
      if (formData.loan_size_max <= 0) errs.push('Maximum loan size is required')
      if (formData.loan_size_max < formData.loan_size_min) errs.push('Max must be greater than min')
      if (!formData.turnaround_time) errs.push('Select turnaround time')
    }
    
    if (currentStep === 3) {
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
      await axios.post('/api/partners/lenders/join', {
        contact_name: formData.contact_name,
        company_name: formData.company_name,
        email: formData.email,
        phone: formData.phone,
        lending_types: formData.lending_types,
        target_markets: formData.target_markets,
        loan_size_min: formData.loan_size_min,
        loan_size_max: formData.loan_size_max,
        preferred_dscr_min: formData.preferred_dscr_min || null,
        preferred_ltv_max: formData.preferred_ltv_max || null,
        turnaround_time: formData.turnaround_time,
        referral_agreement: formData.referral_agreement
      })

      toast({
        title: 'Welcome to Realist!',
        description: 'Your lender partner application has been submitted successfully.',
        variant: 'default'
      })
      
      navigate('/join/lenders/success')
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
            <Link to="/join/realtors" className="text-sm font-medium hover:text-primary">
              Join as Realtor
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Partner with Realist</h1>
            <p className="text-xl text-slate-400 mb-6">
              Connect with active real estate investors seeking financing for their next deal.
            </p>
            <div className="flex justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Qualified Borrowers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Pre-Vetted Deals</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Transparent Referrals</span>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-emerald-600' : 'bg-slate-800'}`} />}
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
                {step === 1 && 'Company Information'}
                {step === 2 && 'Lending Profile'}
                {step === 3 && 'Agreement'}
              </CardTitle>
              <CardDescription>
                {step === 1 && 'Tell us about your company'}
                {step === 2 && 'Define your lending criteria'}
                {step === 3 && 'Review and confirm'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contact_name">Contact Name *</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={e => updateField('contact_name', e.target.value)}
                      placeholder="John Smith"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={e => updateField('company_name', e.target.value)}
                      placeholder="Capital Lending Corp"
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
                      placeholder="john@capitallending.ca"
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
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label>Lending Types *</Label>
                    <p className="text-sm text-slate-400 mb-3">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {LENDING_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleArrayField('lending_types', type)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            formData.lending_types.includes(type)
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Target Markets *</Label>
                    <p className="text-sm text-slate-400 mb-3">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {CANADIAN_PROVINCES.map(prov => (
                        <button
                          key={prov}
                          type="button"
                          onClick={() => toggleArrayField('target_markets', prov)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            formData.target_markets.includes(prov)
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {prov}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="loan_size_min">Min Loan Size ($) *</Label>
                      <Input
                        id="loan_size_min"
                        type="number"
                        min="0"
                        value={formData.loan_size_min || ''}
                        onChange={e => updateField('loan_size_min', parseInt(e.target.value) || 0)}
                        placeholder="100000"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                    <div>
                      <Label htmlFor="loan_size_max">Max Loan Size ($) *</Label>
                      <Input
                        id="loan_size_max"
                        type="number"
                        min="0"
                        value={formData.loan_size_max || ''}
                        onChange={e => updateField('loan_size_max', parseInt(e.target.value) || 0)}
                        placeholder="5000000"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="preferred_dscr_min">Preferred Min DSCR (optional)</Label>
                      <Input
                        id="preferred_dscr_min"
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.preferred_dscr_min || ''}
                        onChange={e => updateField('preferred_dscr_min', e.target.value ? parseFloat(e.target.value) : '')}
                        placeholder="1.25"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preferred_ltv_max">Preferred Max LTV (%) (optional)</Label>
                      <Input
                        id="preferred_ltv_max"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.preferred_ltv_max || ''}
                        onChange={e => updateField('preferred_ltv_max', e.target.value ? parseInt(e.target.value) : '')}
                        placeholder="75"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Turnaround Time *</Label>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                      {TURNAROUND_OPTIONS.map(time => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => updateField('turnaround_time', time)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            formData.turnaround_time === time
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <h4 className="font-medium mb-2">Summary</h4>
                    <dl className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Company:</dt>
                        <dd>{formData.company_name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Loan Range:</dt>
                        <dd>${formData.loan_size_min.toLocaleString()} - ${formData.loan_size_max.toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Markets:</dt>
                        <dd>{formData.target_markets.slice(0, 2).join(', ')}{formData.target_markets.length > 2 && ` +${formData.target_markets.length - 2}`}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">Turnaround:</dt>
                        <dd>{formData.turnaround_time}</dd>
                      </div>
                    </dl>
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
                        match me with qualified borrower leads and that a referral fee agreement will 
                        be established for successful transactions.
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
                  <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
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

export default JoinLendersPage