'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '../../../../components/Layout';
import api from '../../../../lib/api';

const CONTAINER_LABELS = {
  '50ft_22_wheeler': '50ft 14-Wheeler',
  '47ft_22_wheeler_jumbo': '47ft 14-Wheeler Jumbo',
  '40ft_trailer': '40ft Trailer',
  canter: 'Canter',
};

const TX_LABELS = { invoice: 'Invoice', payment: 'Payment', adjustment: 'Adjustment' };
const TX_COLORS = {
  invoice: 'bg-orange-100 text-orange-700',
  payment: 'bg-green-100 text-green-700',
  adjustment: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
};

function fmtMoney(n) {
  const v = parseFloat(n) || 0;
  return `Rs. ${v.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function exportLedgerCSV(clientName, transactions) {
  const headers = ['Date', 'Type', 'Description', 'Trip Route', 'Ref / Mode', 'Amount (Rs)', 'Running Balance (Rs)', 'Logged By'];
  const lines = transactions.map((tx) => {
    const isCharge = tx.transaction_type !== 'payment';
    const amount = isCharge ? parseFloat(tx.amount) : -parseFloat(tx.amount);
    return [
      tx.created_at?.slice(0, 10) || '',
      TX_LABELS[tx.transaction_type] || tx.transaction_type,
      (tx.internal_notes || '').replace(/"/g, '""'),
      (tx.pickup_location || '').replace(/"/g, '""'),
      `${(tx.payment_mode || '').replace('_', ' ')}${tx.reference_number ? ' / ' + tx.reference_number : ''}`,
      amount,
      parseFloat(tx.running_balance) || 0,
      tx.processed_by_name || '',
    ].map((v) => `"${v}"`).join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledger_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Payment / Adjustment Modal ────────────────────────────────────────────────
function LedgerModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    transaction_type: 'payment',
    amount: '',
    payment_mode: 'bank_transfer',
    reference_number: '',
    internal_notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/admin/clients/${clientId}/ledger-adjustment`, form);
      onSaved();
      onClose();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  }

  const isCharge = form.transaction_type !== 'payment';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Post Transaction</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Type</label>
            <select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="payment">Record Client Payment (Clears Balance)</option>
              <option value="invoice">Manual Invoice / Charge</option>
              <option value="adjustment">Adjustment (Credit Note etc.)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {form.transaction_type === 'payment' ? 'Reduces outstanding balance — client paid us' : 'Increases outstanding balance — client owes more'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (PKR) <span className="text-red-500">*</span></label>
            <input type="number" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
            <select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="credit_note">Credit Note</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reference No. (Cheque/Transfer ID)</label>
            <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. HBL-TXN-12345" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes <span className="text-red-500">*</span></label>
            <textarea required rows={2} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
              placeholder="Describe the transaction for audit purposes..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className={`flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50 ${isCharge ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
              {saving ? 'Saving...' : 'Post Transaction'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Client Profile Page ───────────────────────────────────────────────────────
export default function ClientProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [adjModal, setAdjModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ledger');
  const [reversing, setReversing] = useState('');

  async function handleReverse(tx) {
    const label = TX_LABELS[tx.transaction_type] || tx.transaction_type;
    if (!confirm(`Reverse this ${label} of ${fmtMoney(tx.amount)}?\n\nA counter-entry will be posted to cancel it out.`)) return;
    const reverseType = tx.transaction_type === 'payment' ? 'invoice' : 'payment';
    setReversing(tx.id);
    try {
      await api.post(`/api/admin/clients/${id}/ledger-adjustment`, {
        transaction_type: reverseType,
        amount: tx.amount,
        payment_mode: tx.payment_mode || 'bank_transfer',
        reference_number: '',
        // embed original ID so we can detect duplicate reversals: "Reversal of:||<id>| <note>"
        internal_notes: `Reversal of:||${tx.id}| ${tx.internal_notes || label}`,
      });
      load(ledgerFrom || undefined, ledgerTo || undefined);
    } catch (err) {
      alert(err.response?.data?.message || 'Reversal failed');
    } finally { setReversing(''); }
  }

  async function load(from, to) {
    setLoading(true);
    try {
      let url = `/api/admin/clients/${id}/profile`;
      if (from && to) url += `?from=${from}&to=${to}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  if (loading && !data) return <Layout><div className="text-gray-400 py-20 text-center">Loading client profile...</div></Layout>;
  if (!data) return <Layout><div className="text-red-500 py-20 text-center">Client not found</div></Layout>;

  const { client, summary, transactions, trips } = data;

  return (
    <Layout>
      <button onClick={() => router.push('/dashboard/clients')}
        className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to Clients
      </button>

      {/* Client Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-800">{client.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {client.status || 'active'}
              </span>
            </div>
            {client.company_name && <p className="text-sm text-gray-500 mb-2">{client.company_name}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
              {client.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium text-gray-700">{client.phone}</p></div>}
              {client.poc_email && <div><p className="text-xs text-gray-400">Email</p><p className="font-medium text-gray-700">{client.poc_email}</p></div>}
              {client.ntn_number && <div><p className="text-xs text-gray-400">NTN</p><p className="font-medium text-gray-700">{client.ntn_number}</p></div>}
              {client.address && <div><p className="text-xs text-gray-400">Address</p><p className="font-medium text-gray-700">{client.address}</p></div>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Current Outstanding</p>
            <p className={`text-3xl font-bold ${summary.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fmtMoney(summary.outstanding_balance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{trips?.length || 0} total trips</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {[{ key: 'ledger', label: 'Financial Ledger' }, { key: 'trips', label: 'Trip History' }].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Ledger Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div>
          {/* Date filter + summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <h2 className="font-semibold text-gray-800">Accounts Receivable</h2>
              <div className="flex gap-2 items-center flex-wrap">
                <input type="date" value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
                <span className="text-gray-400 text-sm">to</span>
                <input type="date" value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
                <button onClick={() => load(ledgerFrom, ledgerTo)} disabled={!ledgerFrom || !ledgerTo}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  Apply
                </button>
                <button onClick={() => {
                  const now = new Date();
                  const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
                  const to = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
                  setLedgerFrom(from); setLedgerTo(to); load(from, to);
                }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200">
                  This Month
                </button>
                <button onClick={() => { setLedgerFrom(''); setLedgerTo(''); load(); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200">
                  All Time
                </button>
                <button onClick={() => setAdjModal(true)}
                  className="px-4 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">
                  + Post Transaction
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Invoiced / Billed', value: summary.total_invoiced, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Total Payments Received', value: summary.total_received, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Net Balance Due', value: summary.outstanding_balance, color: summary.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600', bg: summary.outstanding_balance > 0 ? 'bg-red-50' : 'bg-green-50' },
              ].map((c) => (
                <div key={c.label} className={`rounded-lg p-4 ${c.bg}`}>
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{fmtMoney(c.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Ledger Feed <span className="text-sm font-normal text-gray-400">({transactions?.length || 0} entries)</span></h2>
              {transactions?.length > 0 && (
                <button onClick={() => exportLedgerCSV(client.name, transactions)}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded font-medium hover:bg-gray-50">
                  Export CSV
                </button>
              )}
            </div>
            {!transactions?.length ? (
              <div className="py-12 text-center text-gray-400">No transactions in selected period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Description / Trip</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Ref / Mode</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Amount</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Running Balance</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Logged By</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Build set of transaction IDs that already have a reversal entry
                      const reversedIds = new Set(
                        transactions
                          .filter((tx) => tx.internal_notes?.startsWith('Reversal of:||'))
                          .map((tx) => tx.internal_notes.split('||')[1])
                      );
                      return transactions.map((tx) => {
                        const isCharge = tx.transaction_type !== 'payment';
                        const isReversal = tx.internal_notes?.startsWith('Reversal of:||');
                        const alreadyReversed = reversedIds.has(tx.id);
                        const canReverse = !isReversal && !alreadyReversed;
                        return (
                          <tr key={tx.id} className={`border-t border-gray-50 hover:bg-gray-50 ${isReversal ? 'opacity-55' : ''}`}>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{tx.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_COLORS[tx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                                {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                              <p>{isReversal ? tx.internal_notes.replace(/^Reversal of:\|\|[^|]+\|/, 'Reversal of: ') : (tx.internal_notes || '—')}</p>
                              {tx.pickup_location && <p className="text-gray-400 truncate">{tx.pickup_location}</p>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              <p className="capitalize">{tx.payment_mode?.replace('_', ' ')}</p>
                              {tx.reference_number && <p className="text-gray-400">{tx.reference_number}</p>}
                            </td>
                            <td className={`px-4 py-3 text-right text-xs font-semibold ${isCharge ? 'text-orange-600' : 'text-green-600'}`}>
                              {isCharge ? '+' : '-'}{fmtMoney(tx.amount)}
                            </td>
                            <td className={`px-4 py-3 text-right text-xs font-bold ${tx.running_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {fmtMoney(tx.running_balance)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{tx.processed_by_name || '—'}</td>
                            <td className="px-4 py-3">
                              {canReverse && (
                                <button
                                  onClick={() => handleReverse(tx)}
                                  disabled={reversing === tx.id}
                                  className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 whitespace-nowrap">
                                  {reversing === tx.id ? '...' : 'Reverse'}
                                </button>
                              )}
                              {alreadyReversed && (
                                <span className="text-xs text-gray-400 italic">Reversed</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Trips Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'trips' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Trip History <span className="text-sm font-normal text-gray-400">({trips?.length || 0} records)</span></h2>
          </div>
          {!trips?.length ? (
            <div className="py-12 text-center text-gray-400">No trips linked to this client</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Route</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Container</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Agent</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => {
                    const drops = Array.isArray(t.dropoff_locations) ? t.dropoff_locations : (() => { try { return JSON.parse(t.dropoff_locations || '[]'); } catch { return []; } })();
                    const total = (parseFloat(t.admin_final_price) || 0) + (parseFloat(t.detention_penalty) || 0);
                    return (
                      <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{t.created_at?.slice(0, 10)}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs font-medium text-gray-700 truncate">{t.pickup_location}</p>
                          <p className="text-xs text-gray-400 truncate">→ {drops.join(' → ')}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{CONTAINER_LABELS[t.container_type] || t.container_type}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{t.agent_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">{t.plate_number || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-green-700">
                          {total > 0 ? fmtMoney(total) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adjModal && (
        <LedgerModal clientId={id} onClose={() => setAdjModal(false)} onSaved={() => load(ledgerFrom || undefined, ledgerTo || undefined)} />
      )}
    </Layout>
  );
}
