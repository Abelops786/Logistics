'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [selectedCnic, setSelectedCnic] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  async function load() {
    setLoading(true);
    try {
      const endpoint = tab === 'pending' ? '/api/admin/agents/pending' : '/api/admin/agents';
      const { data } = await api.get(endpoint);
      setAgents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function handleAction(id, action) {
    setActionLoading(id + action);
    try {
      await api.post(`/api/admin/agents/${id}/approve`, { action });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Agent Management</h1>

      <div className="flex gap-2 mb-6">
        {['pending', 'all'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
          >
            {t === 'pending' ? 'Pending Approval' : 'All Agents'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm border border-gray-200">
          No {tab === 'pending' ? 'pending' : ''} agents found.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Name</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Phone</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">CNIC</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Region</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">CNIC Docs</th>
                {tab === 'pending' && <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{agent.name}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.cnic}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.region || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[agent.status] || ''}`}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {agent.cnic_front_base64 && (
                      <button
                        onClick={() => setSelectedCnic({ front: agent.cnic_front_base64, back: agent.cnic_back_base64, name: agent.name })}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View CNIC
                      </button>
                    )}
                  </td>
                  {tab === 'pending' && (
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        onClick={() => handleAction(agent.id, 'approve')}
                        disabled={!!actionLoading}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading === agent.id + 'approve' ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(agent.id, 'reject')}
                        disabled={!!actionLoading}
                        className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                      >
                        {actionLoading === agent.id + 'reject' ? '...' : 'Reject'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CNIC Modal */}
      {selectedCnic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">CNIC — {selectedCnic.name}</h3>
              <button onClick={() => setSelectedCnic(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedCnic.front && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Front</p>
                  <img src={selectedCnic.front} alt="CNIC Front" className="w-full rounded border" />
                </div>
              )}
              {selectedCnic.back && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Back</p>
                  <img src={selectedCnic.back} alt="CNIC Back" className="w-full rounded border" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
