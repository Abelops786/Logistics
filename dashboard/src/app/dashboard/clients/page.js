'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import api from '../../../lib/api';

function ClientModal({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    company_name: client?.company_name || '',
    address: client?.address || '',
    notes: client?.notes || '',
    poc_email: client?.poc_email || '',
    ntn_number: client?.ntn_number || '',
    status: client?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    try {
      if (client) {
        await api.put(`/api/admin/clients/${client.id}`, form);
      } else {
        await api.post('/api/admin/clients', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">{client ? 'Edit Client' : 'Add New Client'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
            <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input value={form.poc_email} onChange={(e) => setForm({ ...form, poc_email: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" type="email" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">NTN Number</label>
            <input value={form.ntn_number} onChange={(e) => setForm({ ...form, ntn_number: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Tax registration number" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
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

function exportCSV(rows) {
  const headers = ['Name', 'Company', 'Phone', 'Email', 'NTN', 'Address', 'Status', 'Active Trips', 'Outstanding Balance (Rs)'];
  const lines = rows.map((c) => [
    c.name || '',
    c.company_name || '',
    c.phone || '',
    c.poc_email || '',
    c.ntn_number || '',
    (c.address || '').replace(/,/g, ' '),
    c.status || 'active',
    c.active_trips || 0,
    parseFloat(c.outstanding_balance) || 0,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | client object
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const res = await api.get('/api/admin/clients');
      setClients(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(c) {
    if (!confirm(`Delete client "${c.name}"?`)) return;
    try {
      await api.delete(`/api/admin/clients/${c.id}`);
      load();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  }

  const filtered = clients.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
          <p className="text-sm text-gray-400">{clients.length} registered clients</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded font-medium hover:bg-gray-50 disabled:opacity-40">
            Export CSV
          </button>
          <button onClick={() => setModal('add')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700">
            + Add Client
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or company..."
          className="border border-gray-300 rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-10 text-center text-gray-400 border border-gray-200">
          {search ? 'No clients match your search.' : 'No clients yet. Add your first client.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Name / Company</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Contact</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Active Trips</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Outstanding Balance</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const balance = parseFloat(c.outstanding_balance) || 0;
                return (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      {c.company_name && <p className="text-xs text-gray-400">{c.company_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <p>{c.phone || '—'}</p>
                      {c.poc_email && <p className="text-gray-400">{c.poc_email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">{c.active_trips || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Rs. {balance.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/dashboard/clients/${c.id}`)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200">
                          View
                        </button>
                        <button onClick={() => setModal(c)}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100">
                          Delete
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

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <ClientModal
          client={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </Layout>
  );
}
