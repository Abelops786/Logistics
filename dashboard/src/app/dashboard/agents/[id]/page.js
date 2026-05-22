'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '../../../../components/Layout';
import api from '../../../../lib/api';
import { exportCSV } from '../../../../lib/exportCsv';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

function fmt(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1_000_000) return `Rs. ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `Rs. ${(v / 1000).toFixed(1)}K`;
  return `Rs. ${v.toFixed(0)}`;
}

// ── Trip Detail Modal (view-only for completed trips) ────────────────────
function TripDetailModal({ trip, onClose }) {
  const drops = Array.isArray(trip.dropoff_locations)
    ? trip.dropoff_locations
    : (() => { try { return JSON.parse(trip.dropoff_locations || '[]'); } catch { return []; } })();

  const total = (parseFloat(trip.admin_final_price) || 0) + (parseFloat(trip.detention_penalty) || 0);

  const Row = ({ label, value, color }) => value ? (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Trip Details</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[trip.status] || ''}`}>{trip.status?.toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>

        {/* Route */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 mb-1">Route</p>
          <p className="text-sm font-medium text-gray-800">{trip.pickup_location}</p>
          {drops.map((d, i) => <p key={i} className="text-sm text-gray-500 mt-0.5">→ {d}</p>)}
        </div>

        <div className="space-y-0">
          <Row label="Date" value={trip.created_at?.slice(0, 10)} />
          <Row label="Container" value={trip.container_type?.replace(/_/g, ' ')} />
          <Row label="Vehicle" value={trip.plate_number} />
          <Row label="Driver" value={trip.driver_name ? `${trip.driver_name}${trip.driver_phone ? ' • ' + trip.driver_phone : ''}` : null} />
          {trip.payment_type && <Row label="Payment" value={trip.payment_type === 'bank' ? 'Bank Transfer' : 'Cash'} color={trip.payment_type === 'bank' ? 'text-blue-600' : 'text-green-600'} />}
          <Row label="System Estimate" value={trip.system_estimated_price ? `Rs. ${parseInt(trip.system_estimated_price).toLocaleString()}` : null} />
          <Row label="Agent Offer" value={trip.agent_requested_price ? `Rs. ${parseInt(trip.agent_requested_price).toLocaleString()}` : null} color="text-orange-600" />
          <Row label="Admin Final Price" value={trip.admin_final_price ? `Rs. ${parseInt(trip.admin_final_price).toLocaleString()}` : null} color="text-green-700" />
          {parseFloat(trip.detention_penalty) > 0 && <Row label="Detention Penalty" value={`Rs. ${parseInt(trip.detention_penalty).toLocaleString()}`} color="text-red-600" />}
          {total > 0 && (
            <div className="flex justify-between py-2 bg-gray-50 rounded px-2 mt-1">
              <span className="text-sm font-semibold text-gray-700">Total Amount</span>
              <span className="text-sm font-bold text-gray-900">Rs. {total.toLocaleString()}</span>
            </div>
          )}
          {trip.completion_notes && <Row label="Completion Notes" value={trip.completion_notes} />}
          {trip.not_complete_reason && <Row label="Not Complete Reason" value={trip.not_complete_reason} color="text-red-600" />}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-600 text-center">
          This is a read-only view. Editing completed trips is not allowed.
        </div>
      </div>
    </div>
  );
}

// ── Main Agent Profile Page ──────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

export default function AgentProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [viewTrip, setViewTrip] = useState(null);
  const [cnicModal, setCnicModal] = useState(false);

  async function load(p, from, to) {
    setLoading(true);
    try {
      let url = `/api/admin/agents/${id}/profile?period=${p}`;
      if (p === 'custom' && from && to) url += `&from=${from}&to=${to}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load('month'); }, [id]);

  function handlePeriod(p) {
    setPeriod(p);
    if (p !== 'custom') load(p);
  }

  function handleCustomApply() {
    if (customFrom && customTo) load('custom', customFrom, customTo);
  }

  if (loading && !data) return <Layout><div className="text-gray-400 py-20 text-center">Loading agent profile...</div></Layout>;
  if (!data) return <Layout><div className="text-red-500 py-20 text-center">Agent not found</div></Layout>;

  const { agent, stats, period_revenue, period_trips, trips } = data;

  return (
    <Layout>
      {/* Back */}
      <button onClick={() => router.push('/dashboard/agents')} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to Agents
      </button>

      {/* Agent Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            {agent.cnic_front_base64 ? (
              <img src={agent.cnic_front_base64} alt={agent.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 cursor-pointer"
                onClick={() => setCnicModal(true)} />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                {agent.name?.charAt(0).toUpperCase()}
              </div>
            )}
            {agent.cnic_front_base64 && (
              <button onClick={() => setCnicModal(true)} className="text-xs text-blue-600 hover:underline mt-1 text-center w-full">View CNIC</button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{agent.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                agent.status === 'active' ? 'bg-green-100 text-green-700' : agent.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>{agent.status}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-400 text-xs">Phone</p><p className="font-medium text-gray-700">{agent.phone}</p></div>
              <div><p className="text-gray-400 text-xs">CNIC</p><p className="font-medium text-gray-700">{agent.cnic}</p></div>
              <div><p className="text-gray-400 text-xs">Region</p><p className="font-medium text-gray-700">{agent.region || '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Joined</p><p className="font-medium text-gray-700">{new Date(agent.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
            </div>
          </div>

          {/* All-time revenue */}
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-400">All-Time Revenue</p>
            <p className="text-2xl font-bold text-green-600">{fmt(stats.total_revenue_alltime)}</p>
            <p className="text-xs text-gray-400">{stats.total_requests} total requests</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-4 border-t border-gray-100">
          {[
            { label: 'Total Requests', value: stats.total_requests, color: 'text-blue-600' },
            { label: 'Approved', value: stats.approved, color: 'text-green-600' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Quoted', value: stats.quoted, color: 'text-purple-600' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue period selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm font-semibold text-gray-700">Revenue Period:</span>
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => handlePeriod(p.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${period === p.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-3 items-center flex-wrap mb-4">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <span className="text-gray-400">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <button onClick={handleCustomApply} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
              Apply
            </button>
          </div>
        )}
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-400">Revenue ({PERIODS.find((p2) => p2.key === period)?.label})</p>
            <p className="text-2xl font-bold text-green-600">{fmt(period_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Trips ({PERIODS.find((p2) => p2.key === period)?.label})</p>
            <p className="text-2xl font-bold text-blue-600">{period_trips}</p>
          </div>
        </div>
      </div>

      {/* Trip History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Trip History <span className="text-sm font-normal text-gray-400">({trips?.length || 0} records)</span></h2>
          <button onClick={() => exportCSV(trips?.map((t) => {
            const drops = Array.isArray(t.dropoff_locations) ? t.dropoff_locations : JSON.parse(t.dropoff_locations || '[]');
            return { Date: t.created_at?.slice(0,10), Pickup: t.pickup_location, Dropoffs: drops.join(' | '), Container: t.container_type, Final_Price: t.admin_final_price || '', Status: t.status };
          }) || [], `${agent.name}_trips`)}
            className="text-xs text-green-600 hover:underline">↓ Export CSV</button>
        </div>

        {!trips?.length ? (
          <div className="py-12 text-center text-gray-400">No trips found for this agent</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Route</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Container</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Vehicle / Driver</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Final Price</th>
                  <th className="px-4 py-3 text-center text-xs text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => {
                  const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : (() => { try { return JSON.parse(trip.dropoff_locations || '[]'); } catch { return []; } })();
                  const total = (parseFloat(trip.admin_final_price) || 0) + (parseFloat(trip.detention_penalty) || 0);
                  return (
                    <tr key={trip.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{trip.created_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-gray-700 truncate font-medium text-xs">{trip.pickup_location}</p>
                        <p className="text-gray-400 truncate text-xs">→ {drops.join(' → ')}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{trip.container_type?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        {trip.plate_number ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700">{trip.plate_number}</p>
                            <p className="text-xs text-gray-400">{trip.driver_name || '—'}</p>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[trip.status] || 'bg-gray-100 text-gray-600'}`}>
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {total > 0 ? (
                          <div>
                            <span className="text-xs font-semibold text-green-700">Rs. {total.toLocaleString()}</span>
                            {parseFloat(trip.detention_penalty) > 0 && (
                              <p className="text-xs text-red-500">+Rs. {parseInt(trip.detention_penalty).toLocaleString()} penalty</p>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setViewTrip(trip)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CNIC Modal */}
      {cnicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">CNIC Documents — {agent.name}</h3>
              <button onClick={() => setCnicModal(false)} className="text-gray-400 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {agent.cnic_front_base64 && <div><p className="text-xs text-gray-400 mb-1">Front</p><img src={agent.cnic_front_base64} alt="CNIC Front" className="w-full rounded border" /></div>}
              {agent.cnic_back_base64 && <div><p className="text-xs text-gray-400 mb-1">Back</p><img src={agent.cnic_back_base64} alt="CNIC Back" className="w-full rounded border" /></div>}
            </div>
          </div>
        </div>
      )}

      {viewTrip && <TripDetailModal trip={viewTrip} onClose={() => setViewTrip(null)} />}
    </Layout>
  );
}
