import { useState } from 'react';
import './DealAnalyzerMatch.css';

/**
 * Post analysis to persistent storage (Analysis Memory).
 * Returns { ok: true, id } on success, { ok: false } on failure.
 * Failures are silent — persistence must never block the UX.
 */
async function persistAnalysis(payload: {
  listingId?: string;
  address: string;
  city?: string;
  province?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: number;
  metrics: Record<string, unknown>;
  inputs: Record<string, unknown>;
  verdictCheck?: string;  // saved as-is for quick display
  matchedListing?: boolean;
}): Promise<{ ok: boolean; id?: string }> {
  try {
    const res = await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: payload.listingId,
        address: payload.address,
        propertyType: payload.propertyType,
        bedrooms: payload.bedrooms,
        bathrooms: payload.bathrooms,
        sqft: payload.sqft,
        yearBuilt: payload.yearBuilt,
        city: payload.city,
        province: payload.province,
        inputs: payload.inputs,
        metrics: payload.metrics,
        verdictCheck: payload.verdictCheck,
        matchedListing: payload.matchedListing,
      }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, id: data.analysisId };
  } catch {
    // silent — persistence must not break UX
    return { ok: false };
  }
}

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

      // Persist to deal_analyses (Analysis Memory - Non-Negotiable #4)
      persistAnalysis({
        address: propertyAddress || 'Unknown Property',
        city,
        province,
        inputs: { purchasePrice },
        metrics: { purchasePrice: purchasePrice || 0 },
        verdictCheck: '✅ Strong',
      });

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