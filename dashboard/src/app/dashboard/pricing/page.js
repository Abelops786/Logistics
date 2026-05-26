'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

const CONTAINER_LABELS = {
  '50ft_22_wheeler': '50ft 14-Wheeler',
  '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo',
  '40ft_trailer': '40ft Trailer',
  canter: 'Canter',
};

const DIRECTIONS = [
  { key: 'from_karachi', label: 'From Karachi' },
  { key: 'to_karachi', label: 'Punjab → Karachi' },
];

function RouteModal({ route, onClose, onSaved }) {
  const [form, setForm] = useState({
    from_city: route?.from_city || '',
    to_city: route?.to_city || '',
    container_type: route?.container_type || '50ft_22_wheeler',
    price: route?.price || '',
    direction: route?.direction || 'from_karachi',
    notes: route?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (route) {
        await api.put(`/api/admin/route-prices/${route.id}`, form);
      } else {
        await api.post('/api/admin/route-prices', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">{route ? 'Edit Route Price' : 'Add Route Price'}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {DIRECTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From City</label>
              <input value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })}
                placeholder="e.g. Karachi" required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To City</label>
              <input value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })}
                placeholder="e.g. Lahore" required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Container Type</label>
            <select value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {Object.entries(CONTAINER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fixed Price (PKR)</label>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. 50000" required min="1"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [routes, setRoutes] = useState([]);
  const [kmRates, setKmRates] = useState({ '50ft_22_wheeler': null, '47ft_22_wheeler_jumbo': null });
  const [kmInputs, setKmInputs] = useState({ '50ft_22_wheeler': '', '47ft_22_wheeler_jumbo': '' });
  const [kmSaving, setKmSaving] = useState({});
  const [kmStatus, setKmStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | route object
  const [dirFilter, setDirFilter] = useState('all');

  async function loadRoutes() {
    try {
      const res = await api.get('/api/admin/route-prices');
      setRoutes(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadKmRates() {
    try {
      const res = await api.get('/api/trips/pricing-rates');
      const data = res.data;
      setKmRates({ '50ft_22_wheeler': data['50ft_22_wheeler'] ?? null, '47ft_22_wheeler_jumbo': data['47ft_22_wheeler_jumbo'] ?? null });
      setKmInputs({ '50ft_22_wheeler': data['50ft_22_wheeler'] ? String(data['50ft_22_wheeler']) : '', '47ft_22_wheeler_jumbo': data['47ft_22_wheeler_jumbo'] ? String(data['47ft_22_wheeler_jumbo']) : '' });
    } catch (err) { console.error(err); }
  }

  useEffect(() => { loadRoutes(); loadKmRates(); }, []);

  async function saveKmRate(type) {
    const rate = kmInputs[type];
    if (!rate || isNaN(rate) || parseFloat(rate) <= 0) {
      setKmStatus((s) => ({ ...s, [type]: 'error' }));
      return;
    }
    setKmSaving((s) => ({ ...s, [type]: true }));
    try {
      await api.put('/api/admin/pricing', { container_type: type, rate_per_km: parseFloat(rate) });
      setKmRates((s) => ({ ...s, [type]: parseFloat(rate) }));
      setKmStatus((s) => ({ ...s, [type]: 'success' }));
    } catch (err) {
      setKmStatus((s) => ({ ...s, [type]: 'error' }));
    } finally { setKmSaving((s) => ({ ...s, [type]: false })); }
  }

  async function handleDeleteRoute(r) {
    if (!confirm(`Delete route ${r.from_city} → ${r.to_city}?`)) return;
    try {
      await api.delete(`/api/admin/route-prices/${r.id}`);
      loadRoutes();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  }

  const filtered = dirFilter === 'all' ? routes : routes.filter((r) => r.direction === dirFilter);

  const fromKarachi = filtered.filter((r) => r.direction === 'from_karachi');
  const toKarachi = filtered.filter((r) => r.direction === 'to_karachi');

  function RouteTable({ rows }) {
    if (!rows.length) return <p className="text-sm text-gray-400 py-4 text-center">No routes in this category.</p>;
    return (
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">From</th>
            <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">To</th>
            <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Container</th>
            <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Price (PKR)</th>
            <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Notes</th>
            <th className="px-4 py-2 text-center text-xs text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-800">{r.from_city}</td>
              <td className="px-4 py-2.5 text-gray-800">{r.to_city}</td>
              <td className="px-4 py-2.5 text-gray-600 text-xs">{CONTAINER_LABELS[r.container_type] || r.container_type}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                Rs. {Number(r.price).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-gray-400 text-xs">{r.notes || '—'}</td>
              <td className="px-4 py-2.5 text-center">
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setModal(r)}
                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100">Edit</button>
                  <button onClick={() => handleDeleteRoute(r)}
                    className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Pricing Management</h1>
      <p className="text-sm text-gray-500 mb-6">Fixed route prices are used first. Per-KM rates apply as fallback.</p>

      {/* Route Prices */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Fixed Route Prices</h2>
            <p className="text-xs text-gray-400 mt-0.5">{routes.length} routes configured</p>
          </div>
          <div className="flex gap-3 items-center">
            <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm">
              <option value="all">All Directions</option>
              <option value="from_karachi">From Karachi</option>
              <option value="to_karachi">Punjab → Karachi</option>
            </select>
            <button onClick={() => setModal('add')}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">
              + Add Route
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-400">Loading...</div>
        ) : (
          <div>
            {(dirFilter === 'all' || dirFilter === 'from_karachi') && (
              <div>
                <div className="px-6 py-3 bg-blue-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-blue-800">From Karachi</h3>
                </div>
                <RouteTable rows={fromKarachi} />
              </div>
            )}
            {(dirFilter === 'all' || dirFilter === 'to_karachi') && (
              <div>
                <div className="px-6 py-3 bg-orange-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-orange-800">Punjab → Karachi</h3>
                </div>
                <RouteTable rows={toKarachi} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fallback KM Rates */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Fallback Rate per KM</h2>
          <p className="text-xs text-gray-400 mt-0.5">Used when no fixed route price is found for a trip.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {['50ft_22_wheeler', '47ft_22_wheeler_jumbo'].map((type) => (
            <div key={type}>
              <h3 className="font-medium text-gray-700 mb-1">{CONTAINER_LABELS[type]}</h3>
              <p className="text-xs text-gray-400 mb-3">
                Current: <span className="font-semibold text-gray-600">{kmRates[type] != null ? `Rs. ${kmRates[type]} / KM` : 'Not set'}</span>
              </p>
              <div className="flex gap-3">
                <input type="number" value={kmInputs[type]}
                  onChange={(e) => { setKmInputs({ ...kmInputs, [type]: e.target.value }); setKmStatus((s) => ({ ...s, [type]: null })); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveKmRate(type); }}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rate per KM" min="1" />
                <button onClick={() => saveKmRate(type)} disabled={kmSaving[type]}
                  className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {kmSaving[type] ? 'Saving...' : 'Save'}
                </button>
              </div>
              {kmStatus[type] === 'success' && <p className="text-xs text-green-600 mt-1">✓ Saved</p>}
              {kmStatus[type] === 'error' && <p className="text-xs text-red-600 mt-1">Enter a valid rate</p>}
            </div>
          ))}
        </div>
      </div>

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <RouteModal
          route={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={loadRoutes}
        />
      )}
    </Layout>
  );
}
