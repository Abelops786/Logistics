'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

const CONTAINERS = [
  { key: '50ft_22_wheeler', label: '50ft 22-Wheeler Container' },
  { key: '47ft_22_wheeler_jumbo', label: '47ft 22-Wheeler Jumbo Container' },
];

export default function PricingPage() {
  const [rates, setRates] = useState({ '50ft_22_wheeler': '', '47ft_22_wheeler_jumbo': '' });
  const [currentRates, setCurrentRates] = useState({ '50ft_22_wheeler': null, '47ft_22_wheeler_jumbo': null });
  const [saving, setSaving] = useState({ '50ft_22_wheeler': false, '47ft_22_wheeler_jumbo': false });
  const [status, setStatus] = useState({ '50ft_22_wheeler': null, '47ft_22_wheeler_jumbo': null }); // null | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState({ '50ft_22_wheeler': '', '47ft_22_wheeler_jumbo': '' });

  // Load current rates on mount
  useEffect(() => {
    api.get('/api/trips/pricing-rates')
      .then((res) => {
        const data = res.data;
        setCurrentRates({
          '50ft_22_wheeler': data['50ft_22_wheeler'] ?? null,
          '47ft_22_wheeler_jumbo': data['47ft_22_wheeler_jumbo'] ?? null,
        });
        // Pre-fill inputs with current values
        setRates({
          '50ft_22_wheeler': data['50ft_22_wheeler'] ? String(data['50ft_22_wheeler']) : '',
          '47ft_22_wheeler_jumbo': data['47ft_22_wheeler_jumbo'] ? String(data['47ft_22_wheeler_jumbo']) : '',
        });
      })
      .catch(console.error);
  }, []);

  async function save(containerType) {
    const rate = rates[containerType];
    if (!rate || isNaN(rate) || parseFloat(rate) <= 0) {
      setStatus((s) => ({ ...s, [containerType]: 'error' }));
      setStatusMsg((s) => ({ ...s, [containerType]: 'Enter a valid rate greater than 0' }));
      return;
    }

    setSaving((s) => ({ ...s, [containerType]: true }));
    setStatus((s) => ({ ...s, [containerType]: null }));

    try {
      await api.put('/api/admin/pricing', { container_type: containerType, rate_per_km: parseFloat(rate) });
      setCurrentRates((s) => ({ ...s, [containerType]: parseFloat(rate) }));
      setStatus((s) => ({ ...s, [containerType]: 'success' }));
      setStatusMsg((s) => ({ ...s, [containerType]: `Saved — Rs. ${parseFloat(rate)} per KM` }));
    } catch (err) {
      setStatus((s) => ({ ...s, [containerType]: 'error' }));
      setStatusMsg((s) => ({ ...s, [containerType]: err.response?.data?.message || 'Save failed. Try again.' }));
    } finally {
      setSaving((s) => ({ ...s, [containerType]: false }));
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Pricing Management</h1>
      <p className="text-sm text-gray-500 mb-6">
        Update the rate per KM for each container type. Changes apply immediately to new estimates.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CONTAINERS.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-1">{label}</h3>

            {/* Current rate badge */}
            <p className="text-xs text-gray-400 mb-4">
              Current rate:{' '}
              <span className="font-semibold text-gray-600">
                {currentRates[key] != null ? `Rs. ${currentRates[key]} / KM` : 'Loading...'}
              </span>
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">New Rate per KM (PKR)</label>
            <div className="flex gap-3">
              <input
                type="number"
                value={rates[key]}
                onChange={(e) => {
                  setRates({ ...rates, [key]: e.target.value });
                  // Clear status when user starts typing
                  setStatus((s) => ({ ...s, [key]: null }));
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') save(key); }}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={currentRates[key] != null ? `Current: ${currentRates[key]}` : 'e.g. 85'}
                min="1"
              />
              <button
                onClick={() => save(key)}
                disabled={saving[key]}
                className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {saving[key] ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Per-card feedback */}
            {status[key] === 'success' && (
              <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
                <span>✓</span> {statusMsg[key]}
              </div>
            )}
            {status[key] === 'error' && (
              <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                <span>✕</span> {statusMsg[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
