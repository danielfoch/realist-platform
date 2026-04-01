import { useState, useEffect } from 'react';
import { SEO } from '../components/SEO';

interface CityYield {
  city: string;
  province: string;
  median_rent: number;
  sample_size: number;
  yield_estimate: number;
}

export function CityYieldPage() {
  const [cityYields, setCityYields] = useState<CityYield[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCityYields();
  }, []);

  const fetchCityYields = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/content/city-yields');
      const data = await response.json();
      
      if (data.success) {
        setCityYields(data.data);
      } else {
        setError(data.error || 'Failed to load city yield data');
      }
    } catch (err) {
      setError('Failed to load city yield data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <>
        <SEO
          title="City Yield Rankings"
          description="Canadian city rental yield rankings based on current market data."
          type="website"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Loading city yield data...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO
          title="City Yield Rankings"
          description="Canadian city rental yield rankings based on current market data."
          type="website"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12 text-red-500">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Canadian City Rental Yield Rankings | Realist.ca"
        description="Compare rental yields across Canadian cities. Find the best markets for real estate investment based on current rent data and yield estimates."
        type="website"
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Canadian City Rental Yield Rankings</h1>
          <p className="text-gray-600 mb-4">
            Compare rental yields across Canadian cities based on current market data. 
            Yield estimates are calculated using median rents and estimated property values.
          </p>
          <div className="text-sm text-gray-500">
            <p>Data updated monthly. Sample sizes vary by market.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Province
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Median Rent
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yield Estimate
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sample Size
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cityYields.map((city, index) => (
                  <tr key={`${city.city}-${city.province}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{city.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{city.province}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(city.median_rent)}/month</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${
                        city.yield_estimate >= 7 ? 'text-green-600' :
                        city.yield_estimate >= 5 ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {formatPercent(city.yield_estimate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{city.sample_size.toLocaleString()} listings</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg">
          <h2 className="text-xl font-bold mb-3">How We Calculate Yield</h2>
          <p className="text-gray-700 mb-3">
            Yield estimates are calculated using a 60% NOI (Net Operating Income) ratio applied to median rents. 
            This provides a conservative estimate of capitalization rate (cap rate) for each market.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-white rounded-lg">
              <h3 className="font-bold mb-2">Data Source</h3>
              <p className="text-sm text-gray-600">Rent data is collected from multiple listing sources across Canada and updated monthly.</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <h3 className="font-bold mb-2">Methodology</h3>
              <p className="text-sm text-gray-600">Yield = (Annual NOI / Estimated Property Value) × 100. NOI assumes 60% of gross rent.</p>
            </div>
            <div className="p-4 bg-white rounded-lg">
              <h3 className="font-bold mb-2">Limitations</h3>
              <p className="text-sm text-gray-600">Property values are estimates. Actual yields vary based on specific properties and expenses.</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Understanding Rental Yield</h2>
          <div className="prose max-w-none">
            <p className="text-gray-700">
              Rental yield (or capitalization rate) measures the annual return on a real estate investment based on its income. 
              Higher yields typically indicate better cash flow potential, but may also reflect higher risk or lower appreciation potential.
            </p>
            <ul className="mt-3 text-gray-700">
              <li><strong>5%+ yield:</strong> Considered good in major Canadian markets</li>
              <li><strong>7%+ yield:</strong> Excellent for cash flow-focused investors</li>
              <li><strong>Below 4% yield:</strong> Typically appreciation-focused markets</li>
            </ul>
            <p className="mt-3 text-gray-700">
              Always conduct thorough due diligence before investing. Yield is just one metric to consider alongside 
              market fundamentals, property condition, and your investment strategy.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}