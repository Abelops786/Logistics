'use client';
import { useEffect, useState, useRef } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const TYPE_LABELS = {
  '50ft_22_wheeler': '50ft 14-Wheeler',
  '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo',
  '40ft_trailer': '40ft Trailer',
  'canter': 'Canter',
};

function EditVehicleModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    plate_number: vehicle.plate_number || '',
    container_type: vehicle.container_type || '50ft_22_wheeler',
    rate_per_km: vehicle.rate_per_km || '',
  });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/admin/vehicles/${vehicle.id}`, {
        plate_number: form.plate_number,
        container_type: form.container_type,
        rate_per_km: parseFloat(form.rate_per_km) || 0,
      });
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
          <h3 className="font-semibold text-gray-800">Edit Vehicle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plate Number</label>
            <input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Container Type</label>
            <select value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="50ft_22_wheeler">50ft 14-Wheeler</option>
              <option value="47ft_22_wheeler_jumbo">47ft 14-Wheeler Jumbo</option>
              <option value="40ft_trailer">40ft Trailer</option>
              <option value="canter">Canter</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rate Per KM (PKR)</label>
            <input type="number" value={form.rate_per_km} onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
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

function ManageDriversModal({ vehicle, allDrivers, onClose, onSaved }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState('');
  const inputRef = useRef(null);

  const linked = allDrivers.filter((d) => d.vehicle_id === vehicle.id);
  const unlinked = allDrivers.filter((d) => d.vehicle_id !== vehicle.id);
  const filtered = unlinked.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  );

  async function addDriver(driver) {
    setSaving('add_' + driver.id);
    try {
      await api.post(`/api/admin/vehicles/${vehicle.id}/add-driver`, {
        driver_id: driver.id,
        set_primary: linked.length === 0,
      });
      setSearch('');
      setShowDropdown(false);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally { setSaving(''); }
  }

  async function removeDriver(driver) {
    if (!confirm(`Remove ${driver.name} from this vehicle?`)) return;
    setSaving('remove_' + driver.id);
    try {
      await api.delete(`/api/admin/vehicles/${vehicle.id}/remove-driver/${driver.id}`);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally { setSaving(''); }
  }

  async function setPrimary(driver) {
    setSaving('primary_' + driver.id);
    try {
      await api.put(`/api/admin/vehicles/${vehicle.id}/assign-driver`, { driver_id: driver.id });
      onSaved();
    } catch (err) {
      alert('Failed');
    } finally { setSaving(''); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Drivers — {vehicle.plate_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>

        {/* Current linked drivers */}
        <div className="mb-4 space-y-2">
          {linked.length === 0 && (
            <p className="text-sm text-gray-400">No drivers linked yet.</p>
          )}
          {linked.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
              <div className="flex items-center gap-2">
                {d.id === vehicle.assigned_driver_id && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Primary</span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.phone} · {d.status}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {d.id !== vehicle.assigned_driver_id && (
                  <button
                    onClick={() => setPrimary(d)}
                    disabled={!!saving}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >{saving === 'primary_' + d.id ? '...' : 'Set Primary'}</button>
                )}
                <button
                  onClick={() => removeDriver(d)}
                  disabled={!!saving}
                  className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                >{saving === 'remove_' + d.id ? '...' : '✕'}</button>
              </div>
            </div>
          ))}
        </div>

        {/* Searchable add driver */}
        <div className="relative">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search driver by name or phone..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          {showDropdown && search && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg mt-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">No drivers found</div>
              ) : filtered.map((d) => (
                <button
                  key={d.id}
                  onClick={() => addDriver(d)}
                  disabled={!!saving}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center"
                >
                  <span className="font-medium text-gray-800">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">Type to search and click to add a driver</p>

        <button onClick={onClose} className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">
          Done
        </button>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ plate_number: '', container_type: '50ft_22_wheeler', rate_per_km: '' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [manageVehicle, setManageVehicle] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  async function handleDelete(v) {
    if (!confirm(`Delete vehicle "${v.plate_number}"? This cannot be undone.`)) return;
    setActionLoading(v.id);
    try {
      const res = await api.delete(`/api/admin/vehicles/${v.id}`);
      alert(res.data?.message || 'Deleted');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally { setActionLoading(''); }
  }

  async function load() {
    try {
      const [vRes, dRes] = await Promise.all([api.get('/api/admin/vehicles'), api.get('/api/admin/drivers')]);
      setVehicles(vRes.data.filter((v) => !['SYSTEM-50FT', 'SYSTEM-47FT'].includes(v.plate_number)));
      setDrivers(dRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addVehicle(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/api/admin/vehicles', form);
      setForm({ plate_number: '', container_type: '50ft_22_wheeler', rate_per_km: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add vehicle');
    } finally { setAdding(false); }
  }

  async function handleSaved() {
    await load();
    // refresh manageVehicle with updated data
    if (manageVehicle) {
      const vRes = await api.get('/api/admin/vehicles');
      const updated = vRes.data.find((v) => v.id === manageVehicle.id);
      if (updated) setManageVehicle(updated);
    }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Vehicles</h1>
        <button
          onClick={() => {
            const sorted = [...vehicles].sort((a, b) => a.container_type.localeCompare(b.container_type) || a.plate_number.localeCompare(b.plate_number));
            const rows = sorted.map((v) => ({
              'Container Type': v.container_type.replace(/_/g, ' '),
              'Plate Number': v.plate_number,
              'Rate Per KM (PKR)': v.rate_per_km || '',
              'Primary Driver': v.driver_name || '— None —',
              'Driver Phone': v.driver_phone || '',
              'All Drivers': drivers.filter((d) => d.vehicle_id === v.id).map((d) => d.name).join(', ') || v.driver_name || '',
            }));
            exportCSV(rows, 'rtransport_vehicles_drivers');
          }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700"
        >↓ Export CSV</button>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="font-medium text-gray-700 mb-4">Add New Vehicle</h2>
        <form onSubmit={addVehicle} className="flex gap-3 flex-wrap">
          <input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
            placeholder="Plate Number" className="border border-gray-300 rounded px-3 py-2 text-sm" required />
          <select value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="50ft_22_wheeler">50ft 14-Wheeler</option>
            <option value="47ft_22_wheeler_jumbo">47ft 14-Wheeler Jumbo</option>
            <option value="40ft_trailer">40ft Trailer</option>
            <option value="canter">Canter</option>
          </select>
          <input value={form.rate_per_km} onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })}
            placeholder="Rate/KM (PKR)" type="number" className="border border-gray-300 rounded px-3 py-2 text-sm w-36" />
          <button type="submit" disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {adding ? 'Adding...' : 'Add Vehicle'}
          </button>
        </form>
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Plate</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Type</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Rate/KM</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Drivers</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const linked = drivers.filter((d) => d.vehicle_id === v.id);
                return (
                  <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{v.plate_number}</td>
                    <td className="px-4 py-3 text-gray-600">{v.container_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-600">Rs. {v.rate_per_km}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {linked.length > 0 ? linked.map((d) => (
                          <div key={d.id} className="flex items-center gap-1.5">
                            {d.id === v.assigned_driver_id && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded font-medium">P</span>
                            )}
                            <span className="text-xs font-medium text-gray-800">{d.name}</span>
                            <span className="text-xs text-gray-400">{d.phone}</span>
                          </div>
                        )) : v.driver_name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded font-medium">P</span>
                            <span className="text-xs font-medium text-gray-800">{v.driver_name}</span>
                          </div>
                        ) : <span className="text-xs text-gray-400">None</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setEditVehicle(v)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">Edit</button>
                        <button onClick={() => setManageVehicle(v)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Drivers</button>
                        <a href={`/dashboard/vehicles/${v.id}`} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">History</a>
                        <button onClick={() => handleDelete(v)} disabled={!!actionLoading}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                          {actionLoading === v.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editVehicle && <EditVehicleModal vehicle={editVehicle} onClose={() => setEditVehicle(null)} onSaved={load} />}

      {manageVehicle && (
        <ManageDriversModal
          vehicle={manageVehicle}
          allDrivers={drivers}
          onClose={() => setManageVehicle(null)}
          onSaved={handleSaved}
        />
      )}
    </Layout>
  );
}
