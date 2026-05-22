'use client';
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { exportCSV } from '../../lib/exportCsv';

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
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

  if (loading) return <Layout><div className="text-gray-500">Loading...</div></Layout>;

  const statusMap = {};
  metrics?.status_breakdown?.forEach((s) => { statusMap[s.status] = s.count; });

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
        <button
          onClick={() => {
            if (!metrics?.top_agents?.length) return;
            exportCSV(metrics.top_agents.map((a) => ({
              Agent: a.name, Phone: a.phone,
              Trips: a.trip_count, Revenue_PKR: a.total_revenue,
            })), 'abel_logistics_top_agents');
          }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700"
        >
          ↓ Export Top Agents
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Trips" value={metrics?.total_trips || 0} />
        <MetricCard label="Pending" value={statusMap['pending'] || 0} sub="Awaiting approval" />
        <MetricCard label="Approved" value={statusMap['approved'] || 0} sub="Active trips" />
        <MetricCard label="Completed" value={statusMap['completed'] || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-700 mb-4">Top 5 Agents by Revenue</h2>
          {metrics?.top_agents?.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          {metrics?.top_agents?.map((a, i) => (
            <div key={a.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{i + 1}. {a.name}</span>
              <span className="text-sm font-semibold text-green-600">Rs. {parseInt(a.total_revenue).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="font-semibold text-gray-700 mb-4">Top Vehicles</h2>
          {metrics?.top_vehicles?.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          {metrics?.top_vehicles?.map((v, i) => (
            <div key={v.plate_number} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{i + 1}. {v.plate_number}</span>
              <span className="text-sm text-gray-500">{v.trip_count} trips</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
