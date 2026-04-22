import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './JoinForm.css';

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  strategy: string[];
  preferredCities: string[];
  budgetRange: string;
  propertyTypes: string[];
  experienceLevel: string;
  agreeToTerms: boolean;
  agreeToReferral: boolean;
}

const STRATEGIES = [
  'Buy & Hold', 'Fix & Flip', 'BRRR', 'Wholesale',
  'Commercial', 'Development', 'Rent-to-Own', 'Airbnb/STR',
];

const CANADIAN_CITIES = [
  'Toronto', 'Mississauga', 'Brampton', 'Markham',
  'Vancouver', 'Burnaby', 'Surrey', 'Richmond',
  'Calgary', 'Edmonton',
  'Montreal', 'Laval',
  'Ottawa', 'Kingston',
  'Hamilton', 'Kitchener', 'Waterloo', 'London',
  'Victoria', 'Kelowna',
  'Winnipeg', 'Halifax', 'All of Canada',
];

const BUDGET_RANGES = [
  'Under $500K', '$500K - $1M', '$1M - $2M',
  '$2M - $5M', '$5M+',
];

const PROPERTY_TYPES = [
  'Single Family', 'Multi-Family (2-4)', 'Multi-Family (5+)',
  'Condo', 'Townhouse', 'Duplex/Triplex',
  'Commercial', 'Industrial', 'Land', 'Mixed-Use',
];

const EXPERIENCE_LEVELS = [
  { value: 'first-time', label: 'First-time investor' },
  { value: 'beginner', label: 'Beginner (1-2 deals)' },
  { value: 'intermediate', label: 'Intermediate (3-10 deals)' },
  { value: 'experienced', label: 'Experienced (10+ deals)' },
  { value: 'professional', label: 'Professional (portfolio)' },
];

const STEPS = [
  { id: 1, title: 'Account' },
  { id: 2, title: 'Investor Profile' },
  { id: 3, title: 'Markets & Budget' },
  { id: 4, title: 'Agreements' },
];

export function JoinInvestorsPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    strategy: [],
    preferredCities: [],
    budgetRange: '',
    propertyTypes: [],
    experienceLevel: '',
    agreeToTerms: false,
    agreeToReferral: false,
  });

  const updateField = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleArrayItem = (field: 'strategy' | 'preferredCities' | 'propertyTypes', item: string) => {
    setFormData((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      };
    });
  };

  // Validation per step
  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!(
          formData.name.trim() &&
          formData.email.trim() &&
          formData.password.length >= 8 &&
          formData.password === formData.confirmPassword
        );
      case 2:
        return !!(formData.experienceLevel && formData.strategy.length > 0);
      case 3:
        return !!(formData.preferredCities.length > 0 && formData.budgetRange);
      case 4:
        return formData.agreeToTerms && formData.agreeToReferral;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      setError('Please complete all required fields before continuing.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/investor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
          password: formData.password,
          strategy: formData.strategy,
          preferred_cities: formData.preferredCities,
          budget_range: formData.budgetRange,
          property_types: formData.propertyTypes,
          experience_level: formData.experienceLevel,
          agreed_to_platform_terms: formData.agreeToTerms,
          agreed_to_referral_terms: formData.agreeToReferral,
          source: 'website',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Store token for session continuity
      if (data.token) {
        localStorage.setItem('investor_token', data.token);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Account creation
  const renderAccountStep = () => (
    <div className="form-step">
      <h2>Create Your Investor Account</h2>
      <div className="form-group">
        <label>Full Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="form-group">
        <label>Email *</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="form-group">
        <label>Phone (optional)</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Password *</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>
        <div className="form-group">
          <label>Confirm Password *</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            placeholder="Re-enter password"
          />
        </div>
      </div>
      {formData.password && formData.password.length < 8 && (
        <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Password must be at least 8 characters
        </p>
      )}
      {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
        <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Passwords do not match
        </p>
      )}
    </div>
  );

  // Step 2: Investor profile
  const renderProfileStep = () => (
    <div className="form-step">
      <h2>Your Investor Profile</h2>
      <div className="form-group">
        <label>Experience Level *</label>
        <select
          value={formData.experienceLevel}
          onChange={(e) => updateField('experienceLevel', e.target.value)}
        >
          <option value="">Select your experience</option>
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Investment Strategies * (select all that apply)</label>
        <div className="checkbox-grid">
          {STRATEGIES.map((s) => (
            <label key={s} className="checkbox-item" onClick={() => toggleArrayItem('strategy', s)}>
              <input
                type="checkbox"
                checked={formData.strategy.includes(s)}
                onChange={() => {}}
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Property Types of Interest</label>
        <div className="checkbox-grid">
          {PROPERTY_TYPES.map((pt) => (
            <label key={pt} className="checkbox-item" onClick={() => toggleArrayItem('propertyTypes', pt)}>
              <input
                type="checkbox"
                checked={formData.propertyTypes.includes(pt)}
                onChange={() => {}}
              />
              {pt}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 3: Markets & budget
  const renderMarketStep = () => (
    <div className="form-step">
      <h2>Markets & Budget</h2>
      <div className="form-group">
        <label>Target Markets * (select all)</label>
        <div className="checkbox-grid">
          {CANADIAN_CITIES.map((c) => (
            <label key={c} className="checkbox-item" onClick={() => toggleArrayItem('preferredCities', c)}>
              <input
                type="checkbox"
                checked={formData.preferredCities.includes(c)}
                onChange={() => {}}
              />
              {c}
            </label>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label>Deal Budget Range *</label>
        <select
          value={formData.budgetRange}
          onChange={(e) => updateField('budgetRange', e.target.value)}
        >
          <option value="">Select your budget</option>
          {BUDGET_RANGES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // Step 4: Agreements
  const renderAgreementStep = () => (
    <div className="form-step">
      <h2>Agreements</h2>
      <div className="agreement-box">
        <p>📋 Platform Terms of Service</p>
        <ul>
          <li>Realist.ca provides market data and analysis tools</li>
          <li>All information is for educational purposes, not financial advice</li>
          <li>Verify all data independently before making investment decisions</li>
          <li>Your data is used to match you with relevant professionals</li>
        </ul>
        <label className="checkbox-item large">
          <input
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(e) => updateField('agreeToTerms', e.target.checked)}
          />
          <strong>I agree to the Platform Terms of Service</strong>
        </label>
      </div>
      <div className="agreement-box">
        <p>🤝 Referral Agreement</p>
        <ul>
          <li>Realist may introduce you to vetted realtors and lenders</li>
          <li>Introductions are provided at no cost to you</li>
          <li>Any referral economics between realtors and Realist do not affect your costs</li>
          <li>You may opt out of introductions at any time</li>
        </ul>
        <label className="checkbox-item large">
          <input
            type="checkbox"
            checked={formData.agreeToReferral}
            onChange={(e) => updateField('agreeToReferral', e.target.checked)}
          />
          <strong>I agree to the Referral Agreement</strong>
        </label>
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="join-page">
        <div className="form-container">
          <div className="success-container">
            <div className="success-icon">🏠</div>
            <h1>Welcome to Realist!</h1>
            <p>
              Your investor account is active. Start analyzing deals, tracking
              your underwriting, and connecting with local professionals who
              understand investment strategy.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Start Analyzing Deals →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="hero-section">
        <h1>Join as an Investor</h1>
        <p>
          Find deals, analyze them fast, track your underwriting, and connect
          with the right local professionals when you're ready to act.
        </p>
      </div>

      <div className="form-container">
        <div className="step-indicator">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`step ${step > s.id ? 'completed' : ''} ${step === s.id ? 'active' : ''}`}
            >
              <div className="step-number">{s.id}</div>
              <span className="step-title">{s.title}</span>
            </div>
          ))}
        </div>

        <div className="form-content">
          {step === 1 && renderAccountStep()}
          {step === 2 && renderProfileStep()}
          {step === 3 && renderMarketStep()}
          {step === 4 && renderAgreementStep()}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="form-actions">
          {step > 1 && (
            <button
              className="btn-secondary"
              onClick={() => setStep(step - 1)}
              disabled={isSubmitting}
            >
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button
              className="btn-primary"
              onClick={() => {
                if (canProceed()) setStep(step + 1);
                else setError('Please complete all required fields.');
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account & Join →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
