'use client';
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { exportCSV } from '../../lib/exportCsv';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
  };
  return (
    <div className={`rounded-lg p-5 border ${colors[color]} flex flex-col gap-1`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color = '#2563eb', formatValue }) {
  if (!data?.length) return <p className="text-sm text-gray-400 py-4">No data yet</p>;
  const max = Math.max(...data.map((d) => parseFloat(d[valueKey]) || 0));
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const val = parseFloat(d[valueKey]) || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{d[labelKey]}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              >
                {pct > 20 && <span className="text-white text-xs font-medium">{formatValue ? formatValue(val) : val}</span>}
              </div>
            </div>
            {pct <= 20 && <span className="text-xs text-gray-600 w-20">{formatValue ? formatValue(val) : val}</span>}
          </div>
        );
      })}
    </div>
  );
}

const CONTAINER_LABELS = {
  '50ft_22_wheeler': '50ft 14-Wheeler',
  '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo',
  '40ft_trailer': '40ft Trailer',
  canter: 'Canter',
};
function containerLabel(key) {
  return CONTAINER_LABELS[key] || (key?.replace(/_/g, ' ') ?? '');
}

function DonutStat({ items, labelFn }) {
  const total = items.reduce((s, i) => s + parseInt(i.count || i.trip_count || 0), 0);
  const colors = {
    pending: '#f59e0b', quoted: '#8b5cf6', approved: '#10b981',
    rejected: '#ef4444', completed: '#3b82f6',
    '50ft_22_wheeler': '#2563eb', '47ft_22_wheeler_jumbo': '#7c3aed',
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const key = item.status || item.container_type;
        const count = parseInt(item.count || item.trip_count || 0);
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[key] || '#6b7280' }} />
            <span className="text-sm text-gray-700 flex-1 capitalize">{labelFn ? labelFn(key) : key?.replace(/_/g, ' ')}</span>
            <span className="text-sm font-semibold text-gray-800">{count}</span>
            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
          </div>
        );
      })}
      <div className="border-t pt-2 flex justify-between text-xs text-gray-500">
        <span>Total</span><span className="font-semibold">{total}</span>
      </div>
    </div>
  );
}

function fmtMoney(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1_000_000) return `Rs. ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `Rs. ${(v / 1000).toFixed(0)}K`;
  return `Rs. ${v.toFixed(0)}`;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/metrics')
      .then((r) => setMetrics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout><div className="text-gray-400 py-20 text-center">Loading analytics...</div></Layout>;

  const statusMap = {};
  metrics?.status_breakdown?.forEach((s) => { statusMap[s.status] = parseInt(s.count); });
  const pending = statusMap['pending'] || 0;
  const approved = statusMap['approved'] || 0;
  const completed = statusMap['completed'] || 0;
  const rejected = statusMap['rejected'] || 0;

  return (
    <Layout>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400">R Transport — Live Overview</p>
        </div>
        <button
          onClick={() => exportCSV(metrics?.top_agents?.map((a) => ({
            Agent: a.name, Phone: a.phone, Trips: a.trip_count, Revenue_PKR: a.total_revenue,
          })) || [], 'abel_top_agents')}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700"
        >
          ↓ Export Top Agents
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Revenue" value={fmtMoney(metrics?.total_revenue)} sub="Approved + Completed" color="green" />
        <StatCard label="Total Trips" value={metrics?.total_trips || 0} sub={`${pending} pending`} color="blue" />
        <StatCard label="Approved Trips" value={approved + completed} sub={`${completed} completed`} color="orange" />
        <StatCard label="Active Agents" value={metrics?.active_agents || 0} sub="Registered & active" color="purple" />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-semibold text-gray-800">Monthly Revenue</h2>
            <p className="text-xs text-gray-400">Last 6 months</p>
          </div>
          <button
            onClick={() => exportCSV(metrics?.monthly_revenue?.map((m) => ({
              Month: m.month, Revenue_PKR: m.revenue, Trips: m.trips,
            })) || [], 'abel_monthly_revenue')}
            className="text-xs text-green-600 hover:underline"
          >↓ Export</button>
        </div>
        <BarChart
          data={metrics?.monthly_revenue || []}
          valueKey="revenue"
          labelKey="month"
          color="#10b981"
          formatValue={fmtMoney}
        />
      </div>

      {/* Status + Container breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-4">Trip Status Breakdown</h2>
          {metrics?.status_breakdown?.length ? (
            <DonutStat items={metrics.status_breakdown} />
          ) : <p className="text-sm text-gray-400">No data yet</p>}
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-4">Container Type Split</h2>
          {metrics?.container_breakdown?.length ? (
            <>
              <DonutStat items={metrics.container_breakdown.map((c) => ({ ...c, count: c.trip_count }))} labelFn={containerLabel} />
              <div className="mt-4 pt-4 border-t space-y-1">
                {metrics.container_breakdown.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">{containerLabel(c.container_type)}</span>
                    <span className="font-semibold text-gray-800">{fmtMoney(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-gray-400">No data yet</p>}
        </div>
      </div>

      {/* Daily Activity — last 30 days */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Daily Trip Activity <span className="text-xs font-normal text-gray-400">(last 30 days)</span></h2>
        {metrics?.daily_trips?.length ? (
          <div className="flex items-end gap-1 h-24 overflow-x-auto">
            {(() => {
              const maxTrips = Math.max(...metrics.daily_trips.map((d) => parseInt(d.trips)));
              return metrics.daily_trips.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 20 }}>
                  <div
                    title={`${d.day}: ${d.trips} trips`}
                    className="w-4 bg-blue-400 rounded-t hover:bg-blue-600 cursor-default transition-colors"
                    style={{ height: `${maxTrips > 0 ? (parseInt(d.trips) / maxTrips) * 80 : 4}px`, minHeight: 4 }}
                  />
                  <span className="text-gray-300 text-xs" style={{ fontSize: 8, writingMode: 'vertical-rl' }}>{d.day}</span>
                </div>
              ));
            })()}
          </div>
        ) : <p className="text-sm text-gray-400">No trips in the last 30 days</p>}
      </div>

      {/* Top Agents + Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-4">Top 5 Agents by Revenue</h2>
          <BarChart
            data={metrics?.top_agents || []}
            valueKey="total_revenue"
            labelKey="name"
            color="#f59e0b"
            formatValue={fmtMoney}
          />
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-800 mb-4">Top Vehicles by Trips</h2>
          <BarChart
            data={metrics?.top_vehicles || []}
            valueKey="trip_count"
            labelKey="plate_number"
            color="#8b5cf6"
          />
        </div>
      </div>
    </Layout>
  );
}
