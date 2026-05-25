'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ plate_number: '', container_type: '50ft_22_wheeler', rate_per_km: '' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

  async function assignDriver(vehicleId, driverId) {
    try {
      await api.put(`/api/admin/vehicles/${vehicleId}/assign-driver`, { driver_id: driverId || null });
      load();
    } catch (err) {
      alert('Failed to assign driver');
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
              'Container Type': v.container_type === '50ft_22_wheeler' ? '50ft 22-Wheeler' : '47ft Jumbo',
              'Plate Number': v.plate_number,
              'Rate Per KM (PKR)': v.rate_per_km || '',
              'Assigned Driver': v.driver_name || '— None —',
              'Driver Phone': v.driver_phone || '',
              'Driver Status': v.driver_status || '',
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
            <option value="50ft_22_wheeler">50ft 22-Wheeler</option>
            <option value="47ft_22_wheeler_jumbo">47ft Jumbo</option>
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
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Assigned Driver</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Assign Driver</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">History</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{v.plate_number}</td>
                  <td className="px-4 py-3 text-gray-600">{v.container_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-600">Rs. {v.rate_per_km}</td>
                  <td className="px-4 py-3">
                    {v.driver_photo ? (
                      <div className="flex items-center gap-2">
                        <img src={v.driver_photo} alt={v.driver_name} className="w-8 h-8 rounded-full object-cover border" />
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{v.driver_name}</p>
                          <p className="text-gray-400 text-xs">{v.driver_phone}</p>
                        </div>
                      </div>
                    ) : v.driver_name ? (
                      <div>
                        <p className="font-medium text-gray-800 text-xs">{v.driver_name}</p>
                        <p className="text-gray-400 text-xs">{v.driver_phone}</p>
                      </div>
                    ) : <span className="text-gray-400 text-xs">None assigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={v.assigned_driver_id || ''}
                      onChange={(e) => assignDriver(v.id, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="">— Unassign —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/dashboard/vehicles/${v.id}`} className="text-blue-600 hover:underline text-xs font-medium">View History</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
