/**
 * RealtorImport Component
 * Add this to your Realist deal analyzer page
 * 
 * Copy this into your frontend components folder
 */

import React, { useState } from 'react';
import axios from 'axios';

export function RealtorImport({ onImport }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/import-realtor', { url });
      
      if (response.data.success) {
        const data = response.data.data;
        
        // Call the onImport callback with the extracted data
        if (onImport) {
          onImport({
            address: data.address_street,
            city: data.address_city,
            province: data.address_province,
            postalCode: data.postal_code,
            price: data.list_price,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms_full,
            squareFootage: data.square_footage,
            propertyType: data.property_type,
          });
        }
        
        // Clear the input on success
        setUrl('');
      } else {
        setError(response.data.error || 'Import failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleImport();
    }
  };

  return (
    <div className="realtor-import">
      <div className="import-input-group">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Paste realtor.ca listing URL..."
          className="import-url-input"
          disabled={loading}
        />
        <button 
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="import-button"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>
      
      {error && (
        <div className="import-error">
          {error}
        </div>
      )}
      
      <p className="import-hint">
        Paste a realtor.ca property listing URL to auto-fill address, price, and property details.
      </p>
    </div>
  );
}

export default RealtorImport;
