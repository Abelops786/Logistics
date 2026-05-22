'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

function fmt(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1_000_000) return `Rs. ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `Rs. ${(v / 1000).toFixed(1)}K`;
  return `Rs. ${v.toFixed(0)}`;
}

function MonthCard({ label, revenue, trips, highlight, growth }) {
  return (
    <div className={`rounded-xl p-6 border-2 ${highlight ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{fmt(revenue)}</p>
      <p className="text-sm text-gray-500 mt-1">{trips} trips</p>
      {growth !== undefined && growth !== null && (
        <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${parseFloat(growth) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {parseFloat(growth) >= 0 ? '▲' : '▼'} {Math.abs(growth)}% vs last month
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  async function load(month) {
    setLoading(true);
    try {
      const url = month ? `/api/dashboard/reports?month=${month}` : '/api/dashboard/reports';
      const res = await api.get(url);
      setData(res.data);
      setSelectedMonth(res.data.selected_month);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(''); }, []);

  const filteredTrips = data?.trips?.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchSearch = !search || t.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
      t.plate_number?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }) || [];

  function handleExport() {
    exportCSV(filteredTrips.map((t) => {
      const drops = Array.isArray(t.dropoff_locations) ? t.dropoff_locations : JSON.parse(t.dropoff_locations || '[]');
      return {
        Date: t.created_at?.slice(0, 10),
        Agent: t.agent_name, Phone: t.agent_phone,
        Pickup: t.pickup_location, Dropoffs: drops.join(' | '),
        Container: t.container_type, Final_Price: t.admin_final_price || '',
        Status: t.status, Vehicle: t.plate_number || '', Driver: t.driver_name || '',
      };
    }), `abel_report_${selectedMonth}`);
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Income Reports</h1>
          <p className="text-sm text-gray-400">Month-by-month breakdown with full trip details</p>
        </div>
        <div className="flex gap-3 items-center">
          {data?.available_months?.length > 0 && (
            <select
              value={selectedMonth}
              onChange={(e) => load(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {data.available_months.map((m) => {
                const [year, month] = m.split('-');
                const label = new Date(parseInt(year), parseInt(month) - 1, 1)
                  .toLocaleString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          )}
          <button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">
            ↓ Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 py-20 text-center">Loading report...</div>
      ) : (
        <>
          {/* This month vs Last month */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <MonthCard
              label={`This Month (${(() => { const [y,m] = (data?.selected_month||'').split('-'); return y && m ? new Date(+y,+m-1,1).toLocaleString('en-US',{month:'long',year:'numeric'}) : data?.selected_month; })()})`}
              revenue={data?.this_month?.revenue}
              trips={data?.this_month?.trips}
              growth={data?.growth_pct}
              highlight
            />
            <MonthCard
              label="Last Month"
              revenue={data?.last_month?.revenue}
              trips={data?.last_month?.trips}
            />
          </div>

          {/* By Agent + By Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* Agent breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-gray-800">Income by Agent</h2>
                <button
                  onClick={() => exportCSV(data?.by_agent?.map((a) => ({ Agent: a.name, Phone: a.phone, Trips: a.trips, Revenue_PKR: a.revenue })) || [], `abel_agents_${selectedMonth}`)}
                  className="text-xs text-green-600 hover:underline"
                >↓ Export</button>
              </div>
              {data?.by_agent?.length === 0 ? (
                <p className="text-sm text-gray-400 p-5">No data for this month</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Agent</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Trips</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.by_agent?.map((a, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{a.trips}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(a.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right font-semibold">{data?.this_month?.trips}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(data?.this_month?.revenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Container type breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Income by Container Type</h2>
              </div>
              {data?.by_container?.length === 0 ? (
                <p className="text-sm text-gray-400 p-5">No data for this month</p>
              ) : (
                <div className="p-5 space-y-4">
                  {data?.by_container?.map((c, i) => {
                    const totalRev = data.by_container.reduce((s, x) => s + parseFloat(x.revenue), 0);
                    const pct = totalRev > 0 ? (parseFloat(c.revenue) / totalRev * 100).toFixed(0) : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">{c.container_type?.replace(/_/g, ' ')}</span>
                          <span className="text-gray-500">{c.trips} trips · {fmt(c.revenue)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: i === 0 ? '#2563eb' : '#7c3aed' }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{pct}% of total revenue</p>
                      </div>
                    );
                  })}
                  <div className="pt-3 border-t border-gray-100 flex justify-between">
                    <span className="font-semibold text-gray-700">Total Revenue</span>
                    <span className="font-bold text-green-700">{fmt(data?.this_month?.revenue)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Trip List */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                All Trips — {selectedMonth}
                <span className="ml-2 text-sm font-normal text-gray-400">({filteredTrips.length} records)</span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agent, route, vehicle..."
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  {['all', 'pending', 'quoted', 'approved', 'rejected', 'completed'].map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>
                  ))}
                </select>
                <button onClick={handleExport} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  ↓ Export
                </button>
              </div>
            </div>

            {filteredTrips.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No trips found for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Agent</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Route</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Container</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Vehicle / Driver</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Status</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Final Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrips.map((t) => {
                      const drops = Array.isArray(t.dropoff_locations) ? t.dropoff_locations : (() => { try { return JSON.parse(t.dropoff_locations || '[]'); } catch { return []; } })();
                      return (
                        <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.created_at?.slice(0, 10)}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{t.agent_name}</p>
                            <p className="text-xs text-gray-400">{t.agent_phone}</p>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-gray-700 truncate">{t.pickup_location}</p>
                            <p className="text-xs text-gray-400 truncate">→ {drops.join(' → ')}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{t.container_type?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3">
                            {t.plate_number ? (
                              <>
                                <p className="text-gray-700 text-xs font-medium">{t.plate_number}</p>
                                <p className="text-gray-400 text-xs">{t.driver_name || '—'}</p>
                              </>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">
                            {t.admin_final_price ? fmt(t.admin_final_price) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {filteredTrips.some((t) => t.admin_final_price) && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 font-semibold text-gray-700">
                          Total (shown rows)
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">
                          {fmt(filteredTrips.reduce((s, t) => s + (parseFloat(t.admin_final_price) || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
