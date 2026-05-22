'use client';
import { useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

export default function PricingPage() {
  const [rates, setRates] = useState({ '50ft_22_wheeler': '', '47ft_22_wheeler_jumbo': '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(containerType) {
    const rate = rates[containerType];
    if (!rate || isNaN(rate)) return alert('Enter a valid rate');
    setLoading(true);
    setMsg('');
    try {
      await api.put('/api/admin/pricing', { container_type: containerType, rate_per_km: parseFloat(rate) });
      setMsg(`Rate updated for ${containerType.replace(/_/g, ' ')}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Pricing Management</h1>
      <p className="text-sm text-gray-500 mb-6">Update the rate per KM for each container type. Changes apply immediately to new estimates.</p>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { key: '50ft_22_wheeler', label: '50ft 22-Wheeler Container' },
          { key: '47ft_22_wheeler_jumbo', label: '47ft 22-Wheeler Jumbo Container' },
        ].map(({ key, label }) => (
          <div key={key} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">{label}</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate per KM (PKR)</label>
            <div className="flex gap-3">
              <input
                type="number"
                value={rates[key]}
                onChange={(e) => setRates({ ...rates, [key]: e.target.value })}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g. 85"
              />
              <button
                onClick={() => save(key)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
