'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/api/admin/drivers');
      setDrivers(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addDriver(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/api/admin/drivers', form);
      setForm({ name: '', phone: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add driver');
    } finally { setAdding(false); }
  }

  const STATUS_COLORS = { available: 'text-green-600', on_trip: 'text-blue-600', offline: 'text-gray-400' };

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Drivers</h1>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="font-medium text-gray-700 mb-4">Add New Driver</h2>
        <form onSubmit={addDriver} className="flex gap-3 flex-wrap">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Driver Name"
            className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
            required
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone Number"
            className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
            required
          />
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add Driver'}
          </button>
        </form>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Phone</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.phone}</td>
                  <td className={`px-4 py-3 font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
