import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinForm.css';

interface FormData {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  lendingTypes: string[];
  targetMarkets: string[];
  loanSizeMin: number;
  loanSizeMax: number;
  preferredDscrMin: number;
  preferredLtvMax: number;
  turnaroundTime: string;
  referralAgreement: boolean;
}

const LENDING_TYPES = [
  'Conventional', 'Bridge', 'Hard Money', 'Private Money', 
  'CMHC Insured', 'Alternative/Aggregate', 'Mezzanine', 'Construction'
];

const TARGET_MARKETS = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 
  'Edmonton', 'Winnipeg', 'Hamilton', 'Kitchener', 'London',
  'Victoria', 'Halifax', 'Kelowna', 'All of Canada'
];

const TURNAROUND_OPTIONS = [
  'Same day', '24-48 hours', '3-5 days', '1-2 weeks', '2+ weeks'
];

const STEPS = [
  { id: 1, title: 'Contact Info' },
  { id: 2, title: 'Lending Profile' },
  { id: 3, title: 'Loan Criteria' },
  { id: 4, title: 'Agreement' },
];

export function JoinLendersPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    contactName: '',
    companyName: '',
    email: '',
    phone: '',
    lendingTypes: [],
    targetMarkets: [],
    loanSizeMin: 100000,
    loanSizeMax: 1000000,
    preferredDscrMin: 1.0,
    preferredLtvMax: 80,
    turnaroundTime: '',
    referralAgreement: false,
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleArrayField = <K extends keyof FormData>(
    field: K, 
    value: string
  ) => {
    const current = formData[field] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateField(field, updated);
  };

  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!(
          formData.contactName.trim() && 
          formData.companyName.trim() &&
          formData.email.trim() && 
          formData.phone.trim()
        );
      case 2:
        return !!(
          formData.lendingTypes.length > 0 &&
          formData.targetMarkets.length > 0 &&
          formData.turnaroundTime
        );
      case 3:
        return !!(
          formData.loanSizeMin > 0 &&
          formData.loanSizeMax >= formData.loanSizeMin
        );
      case 4:
        return formData.referralAgreement;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      setError('Please accept the referral agreement');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/lenders/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (success) {
    return (
      <div className="join-page">
        <div className="hero-section">
          <div className="success-container">
            <div className="success-icon">✓</div>
            <h1>Welcome to Realist Lenders!</h1>
            <p>Your registration has been submitted successfully. We'll be in touch soon with next steps.</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="hero-section">
        <h1>Join Our Lender Network</h1>
        <p>Connect with qualified real estate investors and grow your portfolio</p>
      </div>

      <div className="form-container">
        <div className="step-indicator">
          {STEPS.map(s => (
            <div 
              key={s.id} 
              className={`step ${step >= s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}
            >
              <div className="step-number">{step > s.id ? '✓' : s.id}</div>
              <div className="step-title">{s.title}</div>
            </div>
          ))}
        </div>

        <div className="form-content">
          {step === 1 && (
            <div className="form-step">
              <h2>Contact Information</h2>
              <div className="form-group">
                <label>Contact Name *</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={e => updateField('contactName', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => updateField('companyName', e.target.value)}
                  placeholder="ABC Lending Corp"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="john@lender.com"
                />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  placeholder="(416) 555-1234"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <h2>Lending Profile</h2>
              
              <div className="form-group">
                <label>Lending Types * (select all that apply)</label>
                <div className="checkbox-grid">
                  {LENDING_TYPES.map(l => (
                    <label key={l} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formData.lendingTypes.includes(l)}
                        onChange={() => toggleArrayField('lendingTypes', l)}
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Target Markets * (select all that apply)</label>
                <div className="checkbox-grid">
                  {TARGET_MARKETS.map(m => (
                    <label key={m} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formData.targetMarkets.includes(m)}
                        onChange={() => toggleArrayField('targetMarkets', m)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Turnaround Time *</label>
                <select
                  value={formData.turnaroundTime}
                  onChange={e => updateField('turnaroundTime', e.target.value)}
                >
                  <option value="">Select turnaround time</option>
                  {TURNAROUND_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step">
              <h2>Loan Criteria</h2>
              
              <div className="form-group">
                <label>Minimum Loan Size *</label>
                <div className="currency-input">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={formData.loanSizeMin}
                    onChange={e => updateField('loanSizeMin', parseInt(e.target.value) || 0)}
                    min={0}
                    step={10000}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Maximum Loan Size *</label>
                <div className="currency-input">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={formData.loanSizeMax}
                    onChange={e => updateField('loanSizeMax', parseInt(e.target.value) || 0)}
                    min={formData.loanSizeMin}
                    step={10000}
                  />
                </div>
                <div className="range-preview">
                  Loan range: {formatCurrency(formData.loanSizeMin)} - {formatCurrency(formData.loanSizeMax)}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Minimum DSCR</label>
                  <input
                    type="number"
                    value={formData.preferredDscrMin}
                    onChange={e => updateField('preferredDscrMin', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.1}
                    placeholder="1.0"
                  />
                </div>
                <div className="form-group">
                  <label>Maximum LTV (%)</label>
                  <input
                    type="number"
                    value={formData.preferredLtvMax}
                    onChange={e => updateField('preferredLtvMax', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    step={5}
                    placeholder="80"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-step">
              <h2>Agreement</h2>
              <div className="agreement-box">
                <p>By checking the box below, you agree to:</p>
                <ul>
                  <li>Receive referral leads from Realist investors</li>
                  <li>Provide competitive rates and terms</li>
                  <li>Respond to inquiries within stated turnaround time</li>
                  <li>Participate in lender feedback and reviews</li>
                </ul>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-item large">
                  <input
                    type="checkbox"
                    checked={formData.referralAgreement}
                    onChange={e => updateField('referralAgreement', e.target.checked)}
                  />
                  <span>I agree to the referral terms and conditions</span>
                </label>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            {step > 1 && (
              <button 
                onClick={() => setStep(s => s - 1)}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary"
                disabled={!validateStep(step)}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="btn-primary"
                disabled={isSubmitting || !validateStep(step)}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}