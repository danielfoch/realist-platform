import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinForm.css';

interface FormData {
  name: string;
  email: string;
  phone: string;
  brokerage: string;
  marketsServed: string[];
  assetTypes: string[];
  dealTypes: string[];
  avgDealSize: string;
  referralFee: string;
  customReferralFeePct: string;
  referralAgreement: boolean;
}

const MARKETS = [
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 
  'Edmonton', 'Winnipeg', 'Hamilton', 'Kitchener', 'London',
  'Victoria', 'Halifax', 'Kelowna', 'Mississauga', 'Brampton'
];

const ASSET_TYPES = [
  'Single Family', 'Multi-Family (2-4)', 'Multi-Family (5+)', 
  'Condo', 'Townhouse', 'Industrial', 'Commercial', 'Mixed-Use', 'Land'
];

const DEAL_TYPES = [
  'Buy & Hold', 'Fix & Flip', 'BRRR', 'Wholesale', 
  'Commercial', 'Development', 'Rent-to-Own'
];

const AVG_DEAL_SIZES = [
  'Under $500K', '$500K - $1M', '$1M - $2M', '$2M - $5M', 'Over $5M'
];

const REFERRAL_FEES = [
  '20%', '25%', '30%', '35%', '40%', 'Custom'
];

const STEPS = [
  { id: 1, title: 'Contact Info' },
  { id: 2, title: 'Business Info' },
  { id: 3, title: 'Preferences' },
  { id: 4, title: 'Referral Fee' },
  { id: 5, title: 'Agreement' },
];

export function JoinRealtorsPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    brokerage: '',
    marketsServed: [],
    assetTypes: [],
    dealTypes: [],
    avgDealSize: '',
    referralFee: '',
    customReferralFeePct: '',
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

  const getCommittedReferralFee = () => {
    if (formData.referralFee !== 'Custom') {
      return formData.referralFee;
    }

    return formData.customReferralFeePct ? `${formData.customReferralFeePct}%` : '';
  };

  const getReferralRoutingTier = () => {
    const fee = Number.parseFloat(getCommittedReferralFee().replace('%', ''));

    if (Number.isNaN(fee)) {
      return 'Select a referral fee to see how leads will be prioritized.';
    }
    if (fee >= 30) {
      return 'Preferred routing tier: high-intent investor leads are prioritized to this commitment level.';
    }
    if (fee >= 25) {
      return 'Standard routing tier: aligned with the normal Realist partner expectation.';
    }

    return 'Introductory routing tier: useful for niche markets, but may receive fewer priority matches.';
  };

  const isCustomReferralFeeValid = () => {
    const fee = Number.parseFloat(formData.customReferralFeePct);
    return !Number.isNaN(fee) && fee >= 10 && fee <= 50;
  };

  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        return !!(
          formData.name.trim() && 
          formData.email.trim() && 
          formData.phone.trim()
        );
      case 2:
        return !!(
          formData.brokerage.trim() && 
          formData.marketsServed.length > 0 &&
          formData.assetTypes.length > 0 &&
          formData.dealTypes.length > 0
        );
      case 3:
        return !!formData.avgDealSize;
      case 4:
        return !!formData.referralFee && (formData.referralFee !== 'Custom' || isCustomReferralFeeValid());
      case 5:
        return formData.referralAgreement;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      setError('Please select a referral fee between 10% and 50%');
      return;
    }
    if (!formData.referralAgreement) {
      setError('Please accept the referral agreement');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/realtors/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          referralFee: getCommittedReferralFee(),
        }),
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

  if (success) {
    return (
      <div className="join-page">
        <div className="hero-section">
          <div className="success-container">
            <div className="success-icon">✓</div>
            <h1>Welcome to Realist Partners!</h1>
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
        <h1>Join Our Realtor Network</h1>
        <p>Connect with investors and access exclusive deals across Canada</p>
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
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="john@brokerage.com"
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
              <h2>Business Information</h2>
              <div className="form-group">
                <label>Brokerage Name *</label>
                <input
                  type="text"
                  value={formData.brokerage}
                  onChange={e => updateField('brokerage', e.target.value)}
                  placeholder="Royal LePage"
                />
              </div>
              
              <div className="form-group">
                <label>Markets Served * (select all that apply)</label>
                <div className="checkbox-grid">
                  {MARKETS.map(m => (
                    <label key={m} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formData.marketsServed.includes(m)}
                        onChange={() => toggleArrayField('marketsServed', m)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Asset Types * (select all that apply)</label>
                <div className="checkbox-grid">
                  {ASSET_TYPES.map(a => (
                    <label key={a} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formData.assetTypes.includes(a)}
                        onChange={() => toggleArrayField('assetTypes', a)}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Deal Types * (select all that apply)</label>
                <div className="checkbox-grid">
                  {DEAL_TYPES.map(d => (
                    <label key={d} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={formData.dealTypes.includes(d)}
                        onChange={() => toggleArrayField('dealTypes', d)}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-step">
              <h2>Deal Preferences</h2>
              <div className="form-group">
                <label>Average Deal Size *</label>
                <select
                  value={formData.avgDealSize}
                  onChange={e => updateField('avgDealSize', e.target.value)}
                >
                  <option value="">Select deal size</option>
                  {AVG_DEAL_SIZES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-step">
              <h2>Referral Fee</h2>
              <div className="agreement-box">
                <p>What referral fee do you offer Realist for qualified leads?</p>
                <ul>
                  <li>This sets expectations and helps us prioritize your referrals</li>
                  <li>Standard rates are 25-30% — higher rates get preferred routing</li>
                </ul>
              </div>
              <div className="form-group">
                <label>Referral Fee Percentage *</label>
                <select
                  value={formData.referralFee}
                  onChange={e => {
                    updateField('referralFee', e.target.value);
                    if (e.target.value !== 'Custom') {
                      updateField('customReferralFeePct', '');
                    }
                  }}
                >
                  <option value="">Select your referral fee</option>
                  {REFERRAL_FEES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              {formData.referralFee === 'Custom' && (
                <div className="form-group">
                  <label>Custom Referral Fee % *</label>
                  <input
                    type="number"
                    min="10"
                    max="50"
                    step="0.5"
                    value={formData.customReferralFeePct}
                    onChange={e => updateField('customReferralFeePct', e.target.value)}
                    placeholder="27.5"
                  />
                  <p className="field-help">Enter a clear percentage from 10% to 50% so routing can stay structured.</p>
                </div>
              )}
              <div className="routing-preview">
                <strong>{getCommittedReferralFee() || 'No fee selected'}</strong>
                <span>{getReferralRoutingTier()}</span>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                Your fee is stored as structured routing data and visible to matched investors when appropriate. You can update it anytime.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="form-step">
              <h2>Agreement</h2>
              <div className="agreement-box">
                <p>By checking the box below, you agree to:</p>
                <ul>
                  <li>Receive referral leads from Realist investors</li>
                  <li>Provide competitive pricing and service</li>
                  <li>Participate in market feedback and reviews</li>
                  <li>Honor the referral fee you selected for qualifying leads</li>
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
            {step < 5 ? (
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