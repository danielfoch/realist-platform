import { useState } from 'react';
import './DealAnalyzerMatch.css';

interface DealAnalyzerMatchProps {
  propertyAddress?: string;
  city?: string;
  province?: string;
  purchasePrice?: number;
}

export function DealAnalyzerMatch({ 
  propertyAddress, 
  city, 
  province, 
  purchasePrice 
}: DealAnalyzerMatchProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleGetMatched = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/deal-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyAddress,
          city,
          province,
          purchasePrice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create lead');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="match-cta success">
        <div className="success-icon">✓</div>
        <h3>Lead Created!</h3>
        <p>We'll match you with a realtor and lender shortly.</p>
      </div>
    );
  }

  return (
    <div className="match-cta">
      <div className="cta-content">
        <h3>🎯 Get Matched with Professionals</h3>
        <p>
          Based on your deal analysis, we can connect you with pre-vetted 
          realtors and lenders who specialize in your market and investment type.
        </p>
        
        {propertyAddress && (
          <div className="deal-summary">
            <span className="label">Property:</span>
            <span className="value">{propertyAddress}</span>
            {city && <span className="value">, {city}</span>}
          </div>
        )}
        
        {purchasePrice && (
          <div className="deal-summary">
            <span className="label">Price:</span>
            <span className="value">
              ${purchasePrice.toLocaleString()}
            </span>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button 
          className="match-button"
          onClick={handleGetMatched}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating Lead...' : 'Get Matched →'}
        </button>
        
        <p className="disclaimer">
          No obligation. Free service for Realist members.
        </p>
      </div>
    </div>
  );
}