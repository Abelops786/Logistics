'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const STATUS_COLORS = { available: 'text-green-600', on_trip: 'text-blue-600', offline: 'text-gray-400' };

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', photo_base64: null });
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

  function pickPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, photo_base64: reader.result }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function addDriver(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/api/admin/drivers', form);
      setForm({ name: '', phone: '', photo_base64: null });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add driver');
    } finally { setAdding(false); }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Drivers</h1>
        <button
          onClick={() => exportCSV(drivers.map((d) => ({
            Name: d.name, Phone: d.phone, Status: d.status, Assigned_Vehicle: d.assigned_vehicle || '',
          })), 'abel_drivers')}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700"
        >↓ Export CSV</button>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="font-medium text-gray-700 mb-4">Add New Driver</h2>
        <form onSubmit={addDriver} className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Driver Name" className="border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone Number" className="border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Photo (optional)</label>
            <div onClick={pickPhoto} className="border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 overflow-hidden flex items-center justify-center"
              style={{ width: 80, height: 40 }}>
              {form.photo_base64
                ? <img src={form.photo_base64} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs text-gray-400">+ Photo</span>}
            </div>
          </div>
          <button type="submit" disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {adding ? 'Adding...' : 'Add Driver'}
          </button>
        </form>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Photo</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Phone</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Assigned Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {d.photo_base64
                      ? <img src={d.photo_base64} alt={d.name} className="w-10 h-10 rounded-full object-cover border" />
                      : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">N/A</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.phone}</td>
                  <td className={`px-4 py-3 font-medium ${STATUS_COLORS[d.status]}`}>{d.status}</td>
                  <td className="px-4 py-3 text-gray-600">{d.assigned_vehicle || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
