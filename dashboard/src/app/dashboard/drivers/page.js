'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const STATUS_BADGE = {
  available: 'bg-green-100 text-green-700',
  on_trip: 'bg-blue-100 text-blue-700',
  offline: 'bg-gray-100 text-gray-500',
};

function EditDriverModal({ driver, onClose, onSaved }) {
  const [form, setForm] = useState({ name: driver.name || '', phone: driver.phone || '', photo_base64: driver.photo_base64 || null });
  const [saving, setSaving] = useState(false);

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

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      if (form.name !== driver.name) payload.name = form.name;
      if (form.phone !== driver.phone) payload.phone = form.phone;
      if (form.photo_base64 !== driver.photo_base64) payload.photo_base64 = form.photo_base64;
      await api.put(`/api/admin/drivers/${driver.id}`, payload);
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Edit Driver</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Photo</label>
            <div onClick={pickPhoto} className="border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 overflow-hidden flex items-center justify-center" style={{ height: 80 }}>
              {form.photo_base64
                ? <img src={form.photo_base64} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs text-gray-400">Click to upload</span>}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', photo_base64: null });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

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

  async function updateStatus(driverId, newStatus) {
    try {
      await api.put(`/api/admin/drivers/${driverId}`, { status: newStatus });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  }

  async function handleRemove(driver) {
    if (!confirm(`Permanently delete driver "${driver.name}"?`)) return;
    setActionLoading(driver.id);
    try {
      const res = await api.delete(`/api/admin/drivers/${driver.id}`);
      alert(res.data?.message || 'Deleted');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally { setActionLoading(''); }
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
          onClick={() => {
            const sorted = [...drivers].sort((a, b) => a.name.localeCompare(b.name));
            exportCSV(sorted.map((d) => ({
              'Driver Name': d.name,
              'Phone': d.phone,
              'Status': d.status === 'on_trip' ? 'On Trip' : d.status === 'available' ? 'Available' : 'Offline',
              'Assigned Vehicle': d.assigned_vehicle || '— None —',
            })), 'rtransport_drivers');
          }}
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
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>
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
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[d.status] || ''}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.assigned_vehicle || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setEditDriver(d)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">Edit</button>
                      {d.status !== 'available' && (
                        <button onClick={() => updateStatus(d.id, 'available')} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Available</button>
                      )}
                      {d.status !== 'offline' && (
                        <button onClick={() => updateStatus(d.id, 'offline')} className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">Offline</button>
                      )}
                      {d.status !== 'on_trip' && (
                        <button onClick={() => updateStatus(d.id, 'on_trip')} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">On Trip</button>
                      )}
                      <button onClick={() => handleRemove(d)} disabled={!!actionLoading}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                        {actionLoading === d.id ? '...' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editDriver && <EditDriverModal driver={editDriver} onClose={() => setEditDriver(null)} onSaved={load} />}
    </Layout>
  );
}
