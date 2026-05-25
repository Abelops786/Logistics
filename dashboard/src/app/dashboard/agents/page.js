'use client';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';
import { exportCSV } from '../../../lib/exportCsv';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
};

function EditAgentModal({ agent, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: agent.name || '',
    phone: agent.phone || '',
    region: agent.region || '',
    cnic: agent.cnic || '',
    new_password: '',
    cnic_front_base64: agent.cnic_front_base64 || null,
    cnic_back_base64: agent.cnic_back_base64 || null,
  });
  const [saving, setSaving] = useState(false);

  async function pickImage(side) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, [side]: reader.result }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      if (form.name !== agent.name) payload.name = form.name;
      if (form.phone !== agent.phone) payload.phone = form.phone;
      if (form.region !== agent.region) payload.region = form.region;
      if (form.cnic !== agent.cnic) payload.cnic = form.cnic;
      if (form.new_password) payload.new_password = form.new_password;
      if (form.cnic_front_base64 !== agent.cnic_front_base64) payload.cnic_front_base64 = form.cnic_front_base64;
      if (form.cnic_back_base64 !== agent.cnic_back_base64) payload.cnic_back_base64 = form.cnic_back_base64;

      await api.put(`/api/admin/agents/${agent.id}`, payload);
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Edit Agent — {agent.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CNIC</label>
              <input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password (leave blank to keep current)</label>
            <input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="Min 6 characters" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['cnic_front_base64', 'cnic_back_base64'].map((side) => (
              <div key={side}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{side === 'cnic_front_base64' ? 'CNIC Front' : 'CNIC Back'}</label>
                <div
                  onClick={() => pickImage(side)}
                  className="border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 overflow-hidden"
                  style={{ height: 80 }}
                >
                  {form[side] ? (
                    <img src={form[side]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400">Click to upload</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [cnicModal, setCnicModal] = useState(null);
  const [editAgent, setEditAgent] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  async function load() {
    setLoading(true);
    try {
      const endpoint = tab === 'pending' ? '/api/admin/agents/pending' : '/api/admin/agents';
      const { data } = await api.get(endpoint);
      setAgents(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tab]);

  async function handleAction(id, action) {
    setActionLoading(id + action);
    try {
      await api.post(`/api/admin/agents/${id}/approve`, { action });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    } finally { setActionLoading(''); }
  }

  async function handleRemove(agent) {
    if (!confirm(`Remove agent "${agent.name}"? If they have trip history they will be suspended instead.`)) return;
    setActionLoading(agent.id + 'remove');
    try {
      const res = await api.delete(`/api/admin/agents/${agent.id}`);
      alert(res.data?.message || 'Done');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove agent');
    } finally { setActionLoading(''); }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Agent Management</h1>
        <button
          onClick={() => {
            const rows = agents.map((a) => ({
              Name: a.name, Phone: a.phone, CNIC: a.cnic,
              Region: a.region || '', Status: a.status,
              Registered: a.created_at?.slice(0, 10) || '',
            }));
            exportCSV(rows, 'abel_logistics_agents');
          }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 flex items-center gap-2"
        >
          ↓ Export CSV
        </button>
      </div>
      <div className="flex gap-2 mb-6">
        {['pending', 'all'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
            {t === 'pending' ? 'Pending Approval' : 'All Agents'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-gray-500">Loading...</div> : agents.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-400 shadow-sm border border-gray-200">No agents found.</div>
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
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a href={`/dashboard/agents/${agent.id}`} className="font-medium text-blue-600 hover:underline">
                      {agent.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{agent.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.cnic}</td>
                  <td className="px-4 py-3 text-gray-600">{agent.region || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[agent.status] || ''}`}>{agent.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(agent.cnic_front_base64 || agent.cnic_back_base64) ? (
                      <button onClick={() => setCnicModal({ front: agent.cnic_front_base64, back: agent.cnic_back_base64, name: agent.name })}
                        className="text-blue-600 hover:underline text-xs">View CNIC</button>
                    ) : <span className="text-xs text-gray-400">Not uploaded</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setEditAgent(agent)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">Edit</button>
                      {tab === 'pending' && (
                        <>
                          <button onClick={() => handleAction(agent.id, 'approve')} disabled={!!actionLoading}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                            {actionLoading === agent.id + 'approve' ? '...' : 'Approve'}
                          </button>
                          <button onClick={() => handleAction(agent.id, 'reject')} disabled={!!actionLoading}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">
                            {actionLoading === agent.id + 'reject' ? '...' : 'Reject'}
                          </button>
                        </>
                      )}
                      <button onClick={() => handleRemove(agent)} disabled={!!actionLoading}
                        className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-800 disabled:opacity-50">
                        {actionLoading === agent.id + 'remove' ? '...' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CNIC Modal */}
      {cnicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">CNIC — {cnicModal.name}</h3>
              <button onClick={() => setCnicModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {cnicModal.front && <div><p className="text-xs text-gray-500 mb-1">Front</p><img src={cnicModal.front} alt="CNIC Front" className="w-full rounded border" /></div>}
              {cnicModal.back && <div><p className="text-xs text-gray-500 mb-1">Back</p><img src={cnicModal.back} alt="CNIC Back" className="w-full rounded border" /></div>}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} onSaved={load} />}
    </Layout>
  );
}
