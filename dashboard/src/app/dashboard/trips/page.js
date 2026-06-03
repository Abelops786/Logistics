'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const CONTAINER_LABELS = {
  '50ft_22_wheeler': '50ft 14-Wheeler',
  '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo',
  '40ft_trailer': '40ft Trailer',
  canter: 'Canter',
};
function containerLabel(key) {
  return CONTAINER_LABELS[key] || (key?.replace(/_/g, ' ') ?? '');
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  not_complete: 'bg-orange-100 text-orange-800',
};

// ── Create Trip Modal (Admin) ────────────────────────────────────────────────
function CreateTripModal({ vehicles, onClose, onCreated }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    client_id: '',
    client_name: '',
    client_phone: '',
    client_id_2: '',
    client_name_2: '',
    client_phone_2: '',
    pickup_location: '',
    dropoff_locations: [''],
    container_type: '50ft_22_wheeler',
    is_double: false,
    weight_ton: '',
    cargo_items: '',
    final_price: '',
    vehicle_id: '',
    payment_type: 'bank',
  });
  const [showClient2, setShowClient2] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/admin/clients').then((r) => setClients(r.data)).catch(() => {});
  }, []);

  function setDrop(i, val) {
    const drops = [...form.dropoff_locations];
    drops[i] = val;
    setForm({ ...form, dropoff_locations: drops });
  }

  const assignableVehicles = vehicles.filter((v) => !['SYSTEM-50FT', 'SYSTEM-47FT'].includes(v.plate_number));
  const selectedVehicle = assignableVehicles.find((v) => v.id === form.vehicle_id);

  function selectClient(e) {
    const id = e.target.value;
    if (id) {
      const c = clients.find((cl) => cl.id === id);
      if (c) setForm((f) => ({ ...f, client_id: id, client_name: c.name, client_phone: c.phone || '' }));
    } else {
      setForm((f) => ({ ...f, client_id: '' }));
    }
  }

  function selectClient2(e) {
    const id = e.target.value;
    if (id) {
      const c = clients.find((cl) => cl.id === id);
      if (c) setForm((f) => ({ ...f, client_id_2: id, client_name_2: c.name, client_phone_2: c.phone || '' }));
    } else {
      setForm((f) => ({ ...f, client_id_2: '', client_name_2: '', client_phone_2: '' }));
    }
  }

  async function submit(e) {
    e.preventDefault();
    const drops = form.dropoff_locations.filter((d) => d.trim());
    if (!drops.length) return alert('Add at least one dropoff location');
    if (!selectedVehicle?.assigned_driver_id) return alert('Selected vehicle has no driver assigned');
    setLoading(true);
    try {
      await api.post('/api/admin/trips/create', {
        ...form,
        dropoff_locations: drops,
        final_price: parseFloat(form.final_price),
      });
      onCreated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create trip');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800 text-lg">Create Trip (Admin)</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* Client 1 */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Client 1</p>
            <select value={form.client_id} onChange={selectClient}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2">
              <option value="">— Select existing client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` • ${c.phone}` : ''}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Client Name" className="border border-gray-300 rounded px-3 py-2 text-sm" />
              <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                placeholder="Client Phone" className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Client 2 toggle */}
          {!showClient2 ? (
            <button type="button" onClick={() => setShowClient2(true)}
              className="text-xs text-blue-600 hover:underline font-medium">
              + Add Second Client
            </button>
          ) : (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-blue-700">Client 2</p>
                <button type="button" onClick={() => { setShowClient2(false); setForm((f) => ({ ...f, client_id_2: '', client_name_2: '', client_phone_2: '' })); }}
                  className="text-gray-400 hover:text-gray-600 text-sm">✕ Remove</button>
              </div>
              <select value={form.client_id_2} onChange={selectClient2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 bg-white">
                <option value="">— Select existing client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` • ${c.phone}` : ''}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.client_name_2} onChange={(e) => setForm({ ...form, client_name_2: e.target.value })}
                  placeholder="Client 2 Name" className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" />
                <input value={form.client_phone_2} onChange={(e) => setForm({ ...form, client_phone_2: e.target.value })}
                  placeholder="Client 2 Phone" className="border border-gray-300 rounded px-3 py-2 text-sm bg-white" />
              </div>
            </div>
          )}
          {/* Route */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Location <span className="text-red-500">*</span></label>
            <input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })}
              placeholder="e.g. Karachi Port" required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          {form.dropoff_locations.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={d} onChange={(e) => setDrop(i, e.target.value)}
                placeholder={`Dropoff ${i + 1}`} required
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
              {form.dropoff_locations.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, dropoff_locations: form.dropoff_locations.filter((_, j) => j !== i) })}
                  className="text-red-400 hover:text-red-600 text-lg">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, dropoff_locations: [...form.dropoff_locations, ''] })}
            className="text-xs text-blue-600 hover:underline">+ Add Dropoff</button>
          {/* Container, Double & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Container Type</label>
              <select value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                {Object.entries(CONTAINER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Final Price (PKR) <span className="text-red-500">*</span></label>
              <input type="number" value={form.final_price} onChange={(e) => setForm({ ...form, final_price: e.target.value })}
                placeholder="e.g. 55000" required min="1"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Double + Cargo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (Tons)</label>
              <input type="number" step="0.1" value={form.weight_ton} onChange={(e) => setForm({ ...form, weight_ton: e.target.value })}
                placeholder="e.g. 20.5" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Items / Cargo</label>
              <input value={form.cargo_items} onChange={(e) => setForm({ ...form, cargo_items: e.target.value })}
                placeholder="e.g. Cotton, Electronics" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_double} onChange={(e) => setForm({ ...form, is_double: e.target.checked })}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm font-medium text-gray-700">Double Trip</span>
          </label>
          {/* Vehicle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle <span className="text-red-500">*</span></label>
            <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">Select Vehicle</option>
              {assignableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} — {containerLabel(v.container_type)}{v.driver_name ? ` (Driver: ${v.driver_name})` : ' ⚠ No driver'}
                </option>
              ))}
            </select>
            {selectedVehicle && !selectedVehicle.driver_name && (
              <p className="text-xs text-red-500 mt-1">⚠ No driver assigned — please assign a driver first.</p>
            )}
          </div>
          {/* Payment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
            <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading || !selectedVehicle?.driver_name}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Creating...' : '✓ Create Trip'}
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

// ── Edit Trip Modal ──────────────────────────────────────────────────────────
function EditTripModal({ trip, vehicles, onClose, onSaved }) {
  const [form, setForm] = useState({
    payment_type: trip.payment_type || 'bank',
    admin_final_price: trip.admin_final_price || '',
    container_type: trip.container_type || '50ft_22_wheeler',
    client_name: trip.client_name || '',
    client_phone: trip.client_phone || '',
    client_name_2: trip.client_name_2 || '',
    client_phone_2: trip.client_phone_2 || '',
    weight_ton: trip.weight_ton || '',
    cargo_items: trip.cargo_items || '',
    is_double: trip.is_double || false,
    vehicle_id: trip.vehicle_id || '',
  });
  const [showClient2, setShowClient2] = useState(!!(trip.client_name_2));
  const [loading, setLoading] = useState(false);

  const assignableVehicles = vehicles.filter((v) => !['SYSTEM-50FT', 'SYSTEM-47FT'].includes(v.plate_number));
  const selectedVehicle = assignableVehicles.find((v) => v.id === form.vehicle_id);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.vehicle_id && selectedVehicle?.assigned_driver_id) {
        payload.driver_id = selectedVehicle.assigned_driver_id;
      }
      await api.put(`/api/admin/trips/${trip.id}`, payload);
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update trip');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800 text-lg">Edit Trip</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">{trip.pickup_location} → {(Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]')).join(' → ')}</p>
        <form onSubmit={submit} className="space-y-3">
          {/* Payment & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
              <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Final Price (PKR)</label>
              <input type="number" value={form.admin_final_price} onChange={(e) => setForm({ ...form, admin_final_price: e.target.value })}
                placeholder="e.g. 55000" min="1"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Container & Double */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Container Type</label>
              <select value={form.container_type} onChange={(e) => setForm({ ...form, container_type: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                {Object.entries(CONTAINER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_double} onChange={(e) => setForm({ ...form, is_double: e.target.checked })}
                  className="w-4 h-4 accent-blue-600" />
                <span className="text-sm font-medium text-gray-700">Double Trip</span>
              </label>
            </div>
          </div>
          {/* Vehicle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">— Keep current vehicle —</option>
              {assignableVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plate_number} — {containerLabel(v.container_type)}{v.driver_name ? ` (${v.driver_name})` : ' ⚠ No driver'}</option>
              ))}
            </select>
          </div>
          {/* Client 1 */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Client 1</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="Client Name" className="border border-gray-300 rounded px-3 py-2 text-sm" />
              <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                placeholder="Client Phone" className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          {/* Client 2 */}
          {!showClient2 ? (
            <button type="button" onClick={() => setShowClient2(true)}
              className="text-xs text-blue-600 hover:underline font-medium">
              + Add Second Client
            </button>
          ) : (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-blue-700">Client 2</p>
                <button type="button" onClick={() => { setShowClient2(false); setForm((f) => ({ ...f, client_name_2: '', client_phone_2: '' })); }}
                  className="text-gray-400 hover:text-gray-600 text-sm">✕ Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.client_name_2} onChange={(e) => setForm({ ...form, client_name_2: e.target.value })}
                  placeholder="Client 2 Name" className="border border-gray-300 bg-white rounded px-3 py-2 text-sm" />
                <input value={form.client_phone_2} onChange={(e) => setForm({ ...form, client_phone_2: e.target.value })}
                  placeholder="Client 2 Phone" className="border border-gray-300 bg-white rounded px-3 py-2 text-sm" />
              </div>
            </div>
          )}
          {/* Cargo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (Tons)</label>
              <input type="number" step="0.1" value={form.weight_ton} onChange={(e) => setForm({ ...form, weight_ton: e.target.value })}
                placeholder="e.g. 20.5" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Items / Cargo</label>
              <input value={form.cargo_items} onChange={(e) => setForm({ ...form, cargo_items: e.target.value })}
                placeholder="e.g. Electronics, Cotton" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
                  {v.plate_number} — {containerLabel(v.container_type)}
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

// ── Complete Modal ──────────────────────────────────────────────
function CompleteModal({ trip, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasBilty, setHasBilty] = useState(false);
  const [hasPod, setHasPod] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/trips/${trip.id}/bilty-check`)
      .then(r => { setHasBilty(r.data.hasBilty); setHasPod(r.data.hasPod); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [trip.id]);

  const bothUploaded = hasBilty && hasPod;
  const missing = !hasBilty && !hasPod ? 'Bilty and POD' : !hasBilty ? 'Bilty' : 'POD';

  async function submit(force = false) {
    setLoading(true);
    try {
      await api.post(`/api/admin/trips/${trip.id}/complete`, { notes, force });
      onDone(); onClose();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-green-700">✓ Mark Trip Complete</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-3">{trip.pickup_location} → {(Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]')).join(' → ')}</p>

        {/* Bilty + POD check */}
        {checking ? (
          <div className="text-center text-gray-400 text-sm py-2 mb-3">Checking bilty & POD status...</div>
        ) : (
          <div className={`rounded-lg p-3 mb-4 ${bothUploaded ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex gap-4 text-sm mb-1">
              <span className={hasBilty ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>{hasBilty ? '✅ Bilty' : '❌ Bilty missing'}</span>
              <span className={hasPod ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>{hasPod ? '✅ POD' : '❌ POD missing'}</span>
            </div>
            {!bothUploaded && <p className="text-xs text-red-600">⚠️ {missing} not uploaded yet. You can Force Complete or cancel and wait.</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Add any completion notes..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none" />
        </div>
        <div className="flex gap-3 mt-4">
          {bothUploaded ? (
            <button onClick={() => submit(false)} disabled={loading || checking}
              className="flex-1 bg-green-700 text-white py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50">
              {loading ? 'Completing...' : '✓ Complete Trip'}
            </button>
          ) : (
            <button onClick={() => submit(true)} disabled={loading || checking}
              className="flex-1 bg-orange-600 text-white py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
              {loading ? 'Completing...' : '⚡ Force Complete'}
            </button>
          )}
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Not Complete Modal ───────────────────────────────────────────
function NotCompleteModal({ trip, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) return alert('Please enter a reason');
    setLoading(true);
    try {
      await api.post(`/api/admin/trips/${trip.id}/not-complete`, { reason });
      onDone(); onClose();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-red-700">✕ Mark Trip Not Complete</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{trip.pickup_location}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required
              placeholder="Please specify the reason for record..."
              className="w-full border border-red-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Saving...' : '✕ Confirm Not Complete'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bilty View Modal ─────────────────────────────────────────────────────────
function BiltyViewModal({ trip, onClose }) {
  const [bilty, setBilty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/trips/${trip.id}/bilty`)
      .then(r => setBilty(r.data.bilty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trip.id]);

  async function notify() {
    setNotifying(true);
    try { await api.post(`/api/admin/trips/${trip.id}/notify-bilty`, {}); alert('Notification sent!'); }
    catch { alert('Failed'); } finally { setNotifying(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">📄 Bilty — {trip.pickup_location?.slice(0,30)}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? <div className="text-center text-gray-400 py-8">Loading...</div>
          : !bilty ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No bilty uploaded by agent yet.</p>
              <button onClick={notify} disabled={notifying}
                className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {notifying ? 'Sending...' : '🔔 Notify Agent to Upload Bilty'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-blue-600">Job #{String(bilty.job_number).padStart(3,'0')}</span>
                <button onClick={notify} disabled={notifying}
                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded font-medium hover:bg-orange-600 disabled:opacity-50">
                  {notifying ? '...' : '🔔 Notify Agent'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Bilty No', bilty.bilty_number || bilty.bilty_no],
                  ['Booking Date', bilty.booking_date?.slice(0,10)],
                  ['Customer', bilty.customer_name],
                  ['Category', bilty.category?.replace('_',' ')],
                  ['Invoice', bilty.invoice_type === 'gst' ? 'GST' : 'Non-GST'],
                  ['Vehicle', bilty.vehicle_no],
                  ['Container', bilty.container_size],
                  ['Origin', bilty.origin],
                  ['Destination', bilty.destination],
                  ['Gross Weight', bilty.gross_weight_mt ? `${bilty.gross_weight_mt} MT` : null],
                  ['Freight', bilty.freight ? `Rs. ${parseFloat(bilty.freight).toLocaleString()}` : null],
                  ['POD Required', bilty.pod_required],
                  ['Credit Term', bilty.credit_term_days ? `${bilty.credit_term_days} Days` : null],
                  ['Transit Loss', bilty.transit_loss === 'customer' ? 'At Customer End' : bilty.transit_loss === 'transporter' ? 'At Transporter End' : null],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-medium capitalize">{value}</p>
                  </div>
                ))}
              </div>
              {(bilty.bilty_file_base64 || bilty.image_base64) && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Bilty Document</p>
                  {bilty.bilty_file_type === 'pdf' ? (
                    <a href={bilty.bilty_file_base64} download="Bilty.pdf"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">
                      📥 Download Bilty PDF
                    </a>
                  ) : (
                    <div>
                      <img src={bilty.bilty_file_base64 || bilty.image_base64} alt="Bilty" className="w-full rounded border border-gray-200 max-h-64 object-contain mb-2" />
                      <a href={bilty.bilty_file_base64 || bilty.image_base64} download="Bilty.jpg"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                        📥 Download Image
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── POD Modal ─────────────────────────────────────────────────────────────────
function PodModal({ trip, onClose }) {
  const [bilty, setBilty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/trips/${trip.id}/bilty`)
      .then(r => setBilty(r.data.bilty))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trip.id]);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
        await api.post(`/api/admin/trips/${trip.id}/pod`, { pod_file_base64: reader.result, pod_file_type: fileType });
        const r = await api.get(`/api/admin/trips/${trip.id}/bilty`);
        setBilty(r.data.bilty);
        alert('POD uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">✅ POD — {trip.pickup_location?.slice(0,30)}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="p-5">
          {loading ? <div className="text-center text-gray-400 py-4">Loading...</div> : (
            <>
              {bilty?.pod_file_base64 ? (
                <div className="mb-4">
                  {bilty.pod_file_type === 'pdf' ? (
                    <a href={bilty.pod_file_base64} download="POD.pdf"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 mb-3">
                      📥 Download POD PDF
                    </a>
                  ) : (
                    <div className="mb-3">
                      <img src={bilty.pod_file_base64} alt="POD" className="w-full rounded border border-gray-200 max-h-56 object-contain mb-2" />
                      <a href={bilty.pod_file_base64} download="POD.jpg"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                        📥 Download Image
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">Upload new to replace:</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">No POD uploaded yet. Upload when proof of delivery is received from the client.</p>
              )}
              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium cursor-pointer ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-green-700 text-white hover:bg-green-800'}`}>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
                {uploading ? 'Uploading...' : '📎 Upload POD (Image or PDF)'}
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── POD Upload Section (inside TripDetailsModal for completed trips) ──────────
function PodUploadSection({ tripId, bilty, onUploaded, compact = false }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';
        await api.post(`/api/admin/trips/${tripId}/pod`, { pod_file_base64: base64, pod_file_type: fileType });
        onUploaded();
        alert('POD uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  }

  return (
    <div className="mt-3 border border-green-200 bg-green-50 rounded-lg p-4">
      <p className="text-sm font-semibold text-green-800 mb-1">✅ Proof of Delivery (POD)</p>
      {bilty?.pod_file_base64 ? (
        <div>
          <p className="text-xs text-green-700 mb-2">POD already uploaded.</p>
          {bilty.pod_file_type === 'pdf' ? (
            <a href={bilty.pod_file_base64} download="POD.pdf"
              className="text-xs text-blue-600 underline">Download PDF</a>
          ) : (
            <img src={bilty.pod_file_base64} alt="POD" className="w-full rounded border border-green-200 max-h-48 object-contain mt-2" />
          )}
          <p className="text-xs text-gray-400 mt-2">Upload again to replace:</p>
        </div>
      ) : (
        <p className="text-xs text-green-700 mb-2">Upload the Proof of Delivery document received from the client.</p>
      )}
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium cursor-pointer mt-1 ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-green-700 text-white hover:bg-green-800'}`}>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
        {uploading ? 'Uploading...' : '📎 Upload POD (Image or PDF)'}
      </label>
    </div>
  );
}

// ── View Trip Details Modal ──────────────────────────────────────
function TripDetailsModal({ trip, onClose, onDone }) {
  const [penalty, setPenalty] = useState('');
  const [applying, setApplying] = useState(false);
  const [penaltyError, setPenaltyError] = useState('');
  const [bilty, setBilty] = useState(null);
  const [biltyLoading, setBiltyLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/trips/${trip.id}/bilty`)
      .then((r) => setBilty(r.data.bilty))
      .catch(() => {})
      .finally(() => setBiltyLoading(false));
  }, [trip.id]);

  async function sendBiltyReminder() {
    setNotifying(true);
    try {
      await api.post(`/api/admin/trips/${trip.id}/notify-bilty`, {});
      alert('Notification sent to agent!');
    } catch { alert('Failed to send notification'); }
    finally { setNotifying(false); }
  }
  const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
  const total = (parseFloat(trip.admin_final_price) || 0) + (parseFloat(trip.detention_penalty) || 0);

  async function applyPenalty(e) {
    e.preventDefault();
    setPenaltyError('');
    if (!penalty || isNaN(penalty) || parseFloat(penalty) <= 0) {
      setPenaltyError('Please enter a valid penalty amount greater than 0');
      return;
    }
    setApplying(true);
    try {
      await api.post(`/api/admin/trips/${trip.id}/penalty`, { penalty_amount: parseFloat(penalty) });
      onDone(); onClose();
    } catch (err) { setPenaltyError(err.response?.data?.message || 'Failed to apply penalty'); }
    finally { setApplying(false); }
  }

  const Row = ({ label, value, color }) => (
    <div className="flex justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-gray-800'}`}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-xl w-full flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-lg">Trip Details</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 pt-4">

        {/* Route */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 mb-1">Route</p>
          <p className="text-sm font-medium text-gray-800">{trip.pickup_location}</p>
          {drops.map((d, i) => <p key={i} className="text-sm text-gray-600 mt-0.5">→ {d}</p>)}
        </div>

        <div className="space-y-0 mb-4">
          <Row label="Date" value={trip.created_at?.slice(0, 10)} />
          <Row label="Agent" value={`${trip.agent_name} (${trip.agent_phone})`} />
          <Row label="Container" value={`${containerLabel(trip.container_type)}${trip.is_double ? ' • Double Trip' : ''}`} />
          <Row label="Vehicle" value={trip.plate_number} />
          <Row label="Driver" value={`${trip.driver_name || '—'}${trip.driver_phone ? ` • ${trip.driver_phone}` : ''}`} />
          <Row label="Payment" value={trip.payment_type === 'bank' ? 'Bank Transfer' : trip.payment_type === 'cash' ? 'Cash' : '—'} color={trip.payment_type === 'bank' ? 'text-blue-600' : 'text-green-600'} />
          <Row label="Status" value={trip.status?.toUpperCase()} />
          {/* Client Info */}
          {(trip.client_name || trip.client_name_2) && (
            <>
              <Row label="Client 1" value={`${trip.client_name || '—'}${trip.client_phone ? ` • ${trip.client_phone}` : ''}`} color="text-blue-700" />
              {trip.client_name_2 && <Row label="Client 2" value={`${trip.client_name_2}${trip.client_phone_2 ? ` • ${trip.client_phone_2}` : ''}`} color="text-blue-700" />}
            </>
          )}
          {/* Cargo Info */}
          {trip.weight_ton && <Row label="Weight" value={`${trip.weight_ton} Tons`} />}
          {trip.cargo_items && <Row label="Items / Cargo" value={trip.cargo_items} />}
          <Row label="System Estimate" value={trip.system_estimated_price ? `Rs. ${parseInt(trip.system_estimated_price).toLocaleString()}` : null} />
          <Row label="Agent Offer" value={trip.agent_requested_price ? `Rs. ${parseInt(trip.agent_requested_price).toLocaleString()}` : null} color="text-orange-600" />
          <Row label="Admin Final Price" value={trip.admin_final_price ? `Rs. ${parseInt(trip.admin_final_price).toLocaleString()}` : null} color="text-green-700" />
          {parseFloat(trip.detention_penalty) > 0 && (
            <Row label="Detention Penalty" value={`Rs. ${parseInt(trip.detention_penalty).toLocaleString()}`} color="text-red-600" />
          )}
          <div className="flex justify-between py-2 bg-gray-50 rounded px-2 mt-1">
            <span className="text-sm font-semibold text-gray-700">Total Amount</span>
            <span className="text-sm font-bold text-gray-900">Rs. {total.toLocaleString()}</span>
          </div>
          {trip.completion_notes && <Row label="Completion Notes" value={trip.completion_notes} />}
          {trip.not_complete_reason && <Row label="Not Complete Reason" value={trip.not_complete_reason} color="text-red-600" />}
        </div>

        {/* ── Bilty & POD Section — visible for approved + completed ── */}
        {['approved','completed','not_complete'].includes(trip.status) && (
          <div className="mt-4 space-y-3">

            {/* Bilty Card */}
            <div className="border border-blue-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
                <p className="text-sm font-semibold text-blue-800">📄 Bilty</p>
                <button onClick={sendBiltyReminder} disabled={notifying}
                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded font-medium hover:bg-orange-600 disabled:opacity-50">
                  {notifying ? 'Sending...' : '🔔 Notify Agent'}
                </button>
              </div>
              {biltyLoading ? (
                <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
              ) : !bilty ? (
                <div className="p-4 text-center text-gray-400 text-sm">No bilty uploaded by agent yet.</div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div><p className="text-xs text-gray-400">Job No</p><p className="font-bold text-blue-600">#{String(bilty.job_number).padStart(3,'0')}</p></div>
                    <div><p className="text-xs text-gray-400">Bilty No</p><p className="font-bold text-gray-800">{bilty.bilty_number || bilty.bilty_no || '—'}</p></div>
                    {bilty.customer_name && <div><p className="text-xs text-gray-400">Customer</p><p className="font-medium">{bilty.customer_name}</p></div>}
                    {bilty.booking_date && <div><p className="text-xs text-gray-400">Booking Date</p><p className="font-medium">{bilty.booking_date?.slice(0,10)}</p></div>}
                    <div><p className="text-xs text-gray-400">Category</p><p className="font-medium capitalize">{bilty.category?.replace('_',' ') || '—'}</p></div>
                    <div><p className="text-xs text-gray-400">Invoice</p><p className="font-medium">{bilty.invoice_type === 'gst' ? 'GST' : 'Non-GST'}</p></div>
                    {bilty.vehicle_no && <div><p className="text-xs text-gray-400">Vehicle</p><p className="font-medium">{bilty.vehicle_no}</p></div>}
                    {bilty.container_size && <div><p className="text-xs text-gray-400">Container</p><p className="font-medium">{bilty.container_size}</p></div>}
                    {bilty.origin && <div><p className="text-xs text-gray-400">Origin</p><p className="font-medium">{bilty.origin}</p></div>}
                    {bilty.destination && <div className="col-span-2"><p className="text-xs text-gray-400">Destination</p><p className="font-medium">{bilty.destination}</p></div>}
                    <div><p className="text-xs text-gray-400">Gross Weight</p><p className="font-medium">{bilty.gross_weight_mt ? `${bilty.gross_weight_mt} MT` : '—'}</p></div>
                    <div><p className="text-xs text-gray-400">Freight</p><p className="font-medium">{bilty.freight ? `Rs. ${parseFloat(bilty.freight).toLocaleString()}` : '—'}</p></div>
                    <div><p className="text-xs text-gray-400">POD Required</p><p className="font-medium capitalize">{bilty.pod_required || '—'}</p></div>
                    <div><p className="text-xs text-gray-400">Credit Term</p><p className="font-medium">{bilty.credit_term_days ? `${bilty.credit_term_days} Days` : '—'}</p></div>
                    <div className="col-span-2"><p className="text-xs text-gray-400">Transit Loss</p><p className="font-medium">{bilty.transit_loss === 'customer' ? 'At Customer End' : bilty.transit_loss === 'transporter' ? 'At Transporter End' : '—'}</p></div>
                  </div>
                  {/* Bilty Document */}
                  {(bilty.bilty_file_base64 || bilty.image_base64) && (
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs text-gray-500 font-medium mb-2">📎 Bilty Document</p>
                      {bilty.bilty_file_type === 'pdf' ? (
                        <a href={bilty.bilty_file_base64} download="Bilty.pdf"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">
                          📥 Download Bilty PDF
                        </a>
                      ) : (
                        <div>
                          <img src={bilty.bilty_file_base64 || bilty.image_base64} alt="Bilty" className="w-full rounded border border-gray-200 max-h-56 object-contain mb-2" />
                          <a href={bilty.bilty_file_base64 || bilty.image_base64} download="Bilty.jpg"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                            📥 Download Image
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* POD Card */}
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-200">
                <p className="text-sm font-semibold text-green-800">✅ Proof of Delivery (POD)</p>
              </div>
              {biltyLoading ? (
                <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
              ) : bilty?.pod_file_base64 ? (
                <div className="p-4">
                  {bilty.pod_file_type === 'pdf' ? (
                    <a href={bilty.pod_file_base64} download="POD.pdf"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700">
                      📥 Download POD PDF
                    </a>
                  ) : (
                    <div>
                      <img src={bilty.pod_file_base64} alt="POD" className="w-full rounded border border-gray-200 max-h-56 object-contain mb-2" />
                      <a href={bilty.pod_file_base64} download="POD.jpg"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                        📥 Download Image
                      </a>
                    </div>
                  )}
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 mb-1">Upload new POD to replace:</p>
                    <PodUploadSection tripId={trip.id} bilty={bilty} onUploaded={() => {
                      api.get(`/api/admin/trips/${trip.id}/bilty`).then(r => setBilty(r.data.bilty)).catch(()=>{});
                    }} compact />
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-3">No POD uploaded yet. Upload when proof of delivery is received.</p>
                  <PodUploadSection tripId={trip.id} bilty={bilty} onUploaded={() => {
                    api.get(`/api/admin/trips/${trip.id}/bilty`).then(r => setBilty(r.data.bilty)).catch(()=>{});
                  }} />
                </div>
              )}
            </div>

          </div>
        )}

        {/* Detention Penalty — approved trips only; completed = view only */}
        {trip.status === 'approved' ? (
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-orange-800 mb-1">⚠️ Detention Penalty</p>
            <p className="text-xs text-orange-600 mb-3">Adding a penalty will update the total amount and send a WhatsApp notification to the agent.</p>
            <form onSubmit={applyPenalty} className="flex flex-col gap-2">
              <div className="flex gap-3">
                <input type="number" value={penalty} onChange={(e) => { setPenalty(e.target.value); setPenaltyError(''); }}
                  placeholder="Penalty Amount (PKR)" min="1"
                  className="flex-1 border border-orange-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <button type="submit" disabled={applying}
                  className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap">
                  {applying ? 'Applying...' : 'Apply Penalty'}
                </button>
              </div>
              {penaltyError && <p className="text-xs text-red-600">{penaltyError}</p>}
            </form>
          </div>
        ) : trip.status === 'completed' ? (
          <div className="mt-2 p-3 bg-blue-50 rounded text-xs text-blue-700 text-center border border-blue-200">
            ✓ Trip <strong>Completed</strong>
          </div>
        ) : trip.status === 'not_complete' ? (
          <div className="mt-2 p-3 bg-orange-50 rounded text-xs text-orange-700 text-center border border-orange-200">
            ✕ Marked <strong>Not Complete</strong>. Use <strong>Re-Assign</strong> to update pricing, then <strong>Complete</strong>.
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignTrip, setAssignTrip] = useState(null);
  const [editTrip, setEditTrip] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [completeTrip, setCompleteTrip] = useState(null);
  const [notCompleteTrip, setNotCompleteTrip] = useState(null);
  const [viewTrip, setViewTrip] = useState(null);
  const [createTrip, setCreateTrip] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [biltyTrip, setBiltyTrip] = useState(null);  // for bilty view modal
  const [podTrip, setPodTrip] = useState(null);       // for pod upload modal

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

  async function handleDelete(trip) {
    if (!confirm(`Delete this trip?\n${trip.pickup_location}\n\nThis cannot be undone.`)) return;
    setDeletingId(trip.id);
    try {
      await api.delete(`/api/admin/trips/${trip.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete trip');
    } finally { setDeletingId(''); }
  }

  const filtered = statusFilter === 'all' ? trips : trips.filter((t) => t.status === statusFilter);

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Trip Requests</h1>
        <div className="flex gap-3">
          <button onClick={() => setCreateTrip(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">
            + Create Trip
          </button>
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
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'quoted', 'approved', 'not_complete', 'rejected', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
          >
            {s === 'not_complete' ? 'Not Complete' : s}
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
                    <p className="text-xs text-gray-500 mt-1">
                      Agent: {trip.agent_name} • {containerLabel(trip.container_type)}
                      {trip.is_double && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Double</span>}
                      {trip.force_completed && <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">⚡ Force Completed</span>}
                      {trip.client_name && <span className="ml-2 text-gray-400">Client: {trip.client_name}{trip.client_name_2 ? ` & ${trip.client_name_2}` : ''}</span>}
                    </p>
                    {(trip.weight_ton || trip.cargo_items) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {trip.weight_ton && `${trip.weight_ton}T`}{trip.weight_ton && trip.cargo_items && ' • '}{trip.cargo_items}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-gray-600 flex-wrap">
                      {trip.system_estimated_price && <span>Est: Rs. {parseInt(trip.system_estimated_price).toLocaleString()}</span>}
                      {trip.agent_requested_price && <span className="text-orange-600">Agent offer: Rs. {parseInt(trip.agent_requested_price).toLocaleString()}</span>}
                      {trip.admin_final_price && <span className="text-green-600 font-medium">Final: Rs. {parseInt(trip.admin_final_price).toLocaleString()}</span>}
                      {parseFloat(trip.detention_penalty) > 0 && (
                        <span className="text-red-600 font-medium">+ Penalty: Rs. {parseInt(trip.detention_penalty).toLocaleString()}</span>
                      )}
                      {parseFloat(trip.detention_penalty) > 0 && trip.admin_final_price && (
                        <span className="text-gray-800 font-bold">= Total: Rs. {(parseFloat(trip.admin_final_price) + parseFloat(trip.detention_penalty)).toLocaleString()}</span>
                      )}
                    </div>
                    {trip.plate_number && (
                      <p className="text-xs text-gray-500 mt-1">Vehicle: {trip.plate_number} • Driver: {trip.driver_name}</p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    <button onClick={() => setViewTrip(trip)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
                      View Details
                    </button>
                    <button onClick={() => setEditTrip(trip)}
                      className="px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-medium hover:bg-yellow-100">
                      Edit
                    </button>
                    {['approved','completed','not_complete'].includes(trip.status) && (
                      <>
                        <button onClick={() => setBiltyTrip(trip)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100">
                          📄 Bilty
                        </button>
                        <button onClick={() => setPodTrip(trip)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100">
                          📎 POD
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(trip)} disabled={deletingId === trip.id}
                      className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-40">
                      {deletingId === trip.id ? '...' : 'Delete'}
                    </button>
                    {trip.status === 'pending' && (
                      <button onClick={() => setAssignTrip(trip)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                        Assign
                      </button>
                    )}
                    {trip.status === 'approved' && (
                      <>
                        <button onClick={() => setCompleteTrip(trip)}
                          className="px-3 py-1.5 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-800">
                          ✓ Complete
                        </button>
                        <button onClick={() => setNotCompleteTrip(trip)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                          ✕ Not Complete
                        </button>
                      </>
                    )}
                    {trip.status === 'not_complete' && (
                      <>
                        <button onClick={() => setAssignTrip(trip)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                          Re-Assign
                        </button>
                        <button onClick={() => setCompleteTrip(trip)}
                          className="px-3 py-1.5 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-800">
                          ✓ Complete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createTrip && <CreateTripModal vehicles={vehicles} onClose={() => setCreateTrip(false)} onCreated={load} />}
      {editTrip && <EditTripModal trip={editTrip} vehicles={vehicles} onClose={() => setEditTrip(null)} onSaved={load} />}
      {assignTrip && <AssignModal trip={assignTrip} vehicles={vehicles} onClose={() => setAssignTrip(null)} onAssigned={load} />}
      {completeTrip && <CompleteModal trip={completeTrip} onClose={() => setCompleteTrip(null)} onDone={load} />}
      {notCompleteTrip && <NotCompleteModal trip={notCompleteTrip} onClose={() => setNotCompleteTrip(null)} onDone={load} />}
      {viewTrip && <TripDetailsModal trip={viewTrip} onClose={() => setViewTrip(null)} onDone={() => { load(); setViewTrip(null); }} />}
      {biltyTrip && <BiltyViewModal trip={biltyTrip} onClose={() => setBiltyTrip(null)} />}
      {podTrip && <PodModal trip={podTrip} onClose={() => setPodTrip(null)} />}
    </Layout>
  );
}
