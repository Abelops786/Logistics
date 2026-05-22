'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

function AssignModal({ trip, vehicles, onClose, onAssigned }) {
  const [form, setForm] = useState({
    final_price: trip.agent_requested_price || trip.system_estimated_price || '',
    vehicle_id: '',
    payment_type: 'bank',
  });
  const [loading, setLoading] = useState(false);
  const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');

  const assignableVehicles = vehicles.filter((v) => !['SYSTEM-50FT', 'SYSTEM-47FT'].includes(v.plate_number));
  const selectedVehicle = assignableVehicles.find((v) => v.id === form.vehicle_id);

  async function submit(e) {
    e.preventDefault();
    if (!selectedVehicle?.assigned_driver_id) {
      alert('This vehicle has no driver assigned. Go to Vehicles page and assign a driver first.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/admin/trips/${trip.id}/assign`, {
        ...form,
        driver_id: selectedVehicle.assigned_driver_id,
      });
      onAssigned();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign trip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Assign Trip</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{trip.pickup_location} → {drops.join(' → ')}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Final Price (PKR)</label>
            <input
              type="number"
              value={form.final_price}
              onChange={(e) => setForm({ ...form, final_price: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
            <select
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            >
              <option value="">Select Vehicle</option>
              {assignableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} — {v.container_type.replace(/_/g, ' ')}
                  {v.driver_name ? ` (Driver: ${v.driver_name})` : ' ⚠ No driver'}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-show driver from selected vehicle */}
          {selectedVehicle && (
            <div className={`rounded-lg px-4 py-3 text-sm ${selectedVehicle.driver_name ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              {selectedVehicle.driver_name ? (
                <div className="flex items-center gap-3">
                  {selectedVehicle.driver_photo && (
                    <img src={selectedVehicle.driver_photo} alt="" className="w-9 h-9 rounded-full object-cover border border-green-200" />
                  )}
                  <div>
                    <p className="font-semibold text-green-800">Driver: {selectedVehicle.driver_name}</p>
                    <p className="text-green-600 text-xs">{selectedVehicle.driver_phone}</p>
                  </div>
                </div>
              ) : (
                <p className="text-yellow-700">⚠ No driver assigned to this vehicle. <a href="/dashboard/vehicles" className="underline font-medium">Assign one first →</a></p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
            <select
              value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !selectedVehicle?.driver_name}
              className="flex-1 bg-green-600 text-white py-2 rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Approving...' : 'Approve & Assign'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignTrip, setAssignTrip] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const [tripsRes, vehiclesRes] = await Promise.all([
        api.get('/api/admin/trips'),
        api.get('/api/admin/vehicles'),
      ]);
      setTrips(tripsRes.data);
      setVehicles(vehiclesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markComplete(tripId) {
    if (!confirm('Mark this trip as completed?')) return;
    try {
      await api.post(`/api/admin/trips/${tripId}/complete`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete trip');
    }
  }

  const filtered = statusFilter === 'all' ? trips : trips.filter((t) => t.status === statusFilter);

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Trip Requests</h1>
        <button
          onClick={() => {
            const rows = filtered.map((t) => ({
              Date: t.created_at?.slice(0, 10) || '',
              Agent: t.agent_name || '',
              Phone: t.agent_phone || '',
              Pickup: t.pickup_location || '',
              Dropoffs: Array.isArray(t.dropoff_locations) ? t.dropoff_locations.join(' | ') : JSON.parse(t.dropoff_locations || '[]').join(' | '),
              Container: t.container_type || '',
              System_Estimate: t.system_estimated_price || '',
              Agent_Offer: t.agent_requested_price || '',
              Final_Price: t.admin_final_price || '',
              Status: t.status || '',
              Vehicle: t.plate_number || '',
              Driver: t.driver_name || '',
            }));
            exportCSV(rows, 'abel_logistics_trips');
          }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 flex items-center gap-2"
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'quoted', 'approved', 'rejected', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm border border-gray-200">No trips found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((trip) => {
            const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
            return (
              <div key={trip.id} className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[trip.status]}`}>{trip.status}</span>
                      <span className="text-xs text-gray-400">{new Date(trip.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="font-medium text-gray-800 text-sm">{trip.pickup_location} → {drops.join(' → ')}</p>
                    <p className="text-xs text-gray-500 mt-1">Agent: {trip.agent_name} • {trip.container_type?.replace(/_/g, ' ')}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-600">
                      {trip.system_estimated_price && <span>Est: Rs. {parseInt(trip.system_estimated_price).toLocaleString()}</span>}
                      {trip.agent_requested_price && <span className="text-orange-600">Agent offer: Rs. {parseInt(trip.agent_requested_price).toLocaleString()}</span>}
                      {trip.admin_final_price && <span className="text-green-600 font-medium">Final: Rs. {parseInt(trip.admin_final_price).toLocaleString()}</span>}
                    </div>
                    {trip.plate_number && (
                      <p className="text-xs text-gray-500 mt-1">Vehicle: {trip.plate_number} • Driver: {trip.driver_name}</p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    {trip.status === 'pending' && (
                      <button
                        onClick={() => setAssignTrip(trip)}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Assign
                      </button>
                    )}
                    {trip.status === 'approved' && (
                      <button
                        onClick={() => markComplete(trip.id)}
                        className="px-4 py-2 bg-green-700 text-white rounded text-sm font-medium hover:bg-green-800"
                      >
                        ✓ Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignTrip && (
        <AssignModal
          trip={assignTrip}
          vehicles={vehicles}
          onClose={() => setAssignTrip(null)}
          onAssigned={load}
        />
      )}
    </Layout>
  );
}
