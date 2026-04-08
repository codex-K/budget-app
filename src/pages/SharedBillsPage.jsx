import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

const CATEGORIES = ['Housing', 'Utilities', 'Groceries', 'Transport', 'Insurance', 'Subscriptions', 'Other']
const FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'yearly', 'one-off']

const toMonthly = (amount, frequency) => {
  const n = parseFloat(amount) || 0
  if (frequency === 'weekly') return n * 52 / 12
  if (frequency === 'fortnightly') return n * 26 / 12
  if (frequency === 'yearly') return n / 12
  return n
}

const emptyForm = () => ({
  name: '', amount: '', category: 'Other', frequency: 'monthly',
  is_recurring: true, month: new Date().toISOString().slice(0, 7)
})

const monthLabel = (ym) => {
  if (!ym) return 'Unknown'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function SharedBillsPage() {
  const { user, household } = useAuth()
  const { showToast } = useToast()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchBills = async () => {
    if (!household?.id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*')
      .eq('household_id', household.id).eq('is_shared', true)
      .order('month', { ascending: false })
    setBills(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBills() }, [household])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setError(''); setShowModal(true) }
  const openEdit = (item) => {
    setEditingItem(item)
    setForm({ name: item.name, amount: item.amount, category: item.category, frequency: item.frequency, is_recurring: item.is_recurring, month: item.month || new Date().toISOString().slice(0, 7) })
    setError(''); setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return setError('Please enter a name')
    if (!form.amount || isNaN(form.amount)) return setError('Please enter a valid amount')
    if (!household?.id) return setError('No household linked yet')
    setSaving(true)
    const payload = { name: form.name.trim(), amount: parseFloat(form.amount), category: form.category, frequency: form.frequency, is_recurring: form.is_recurring, month: form.month }
    const { error } = editingItem
      ? await supabase.from('expenses').update(payload).eq('id', editingItem.id)
      : await supabase.from('expenses').insert({ ...payload, user_id: user.id, household_id: household.id, is_shared: true })
    if (error) { setError(error.message); setSaving(false); return }
    setShowModal(false); setEditingItem(null); setForm(emptyForm())
    showToast(editingItem ? 'Bill updated!' : 'Bill saved!')
    fetchBills(); setSaving(false)
  }

  const confirmAndDelete = async () => {
    await supabase.from('expenses').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    showToast('Bill deleted', 'error')
    fetchBills()
  }

  const totalMonthly = bills.reduce((s, b) => s + toMonthly(b.amount, b.frequency), 0)
  const eachMonthly = totalMonthly / 2
  const grouped = bills.reduce((acc, b) => { const m = b.month || 'Unknown'; if (!acc[m]) acc[m] = []; acc[m].push(b); return acc }, {})

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Shared Bills</h1>
            <p className="text-gray-400 text-sm mt-1">Household expenses split 50/50</p>
          </div>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Add Bill
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
            <p className="text-amber-100 text-sm">Total Household Bills</p>
            <p className="text-2xl font-bold mt-1">${totalMonthly.toLocaleString('en-AU', { minimumFractionDigits: 2 })}<span className="text-sm font-normal">/mo</span></p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-gray-400 text-sm">Each Person Pays</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">${eachMonthly.toLocaleString('en-AU', { minimumFractionDigits: 2 })}<span className="text-sm font-normal text-gray-400">/mo</span></p>
          </div>
        </div>

        {!household?.id && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-700">
            ⚠️ You haven't linked a household yet. Go to Settings to link with your partner.
          </div>
        )}

        {loading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          : bills.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">🏠</div>
              <p className="text-gray-500 font-medium">No shared bills yet</p>
              <p className="text-gray-400 text-sm mt-1">Add bills you share with your partner</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{monthLabel(month)}</p>
                  <div className="space-y-3">
                    {items.map((bill) => {
                      const monthly = toMonthly(bill.amount, bill.frequency)
                      return (
                        <div key={bill.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-800">{bill.name}</p>
                              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">{bill.category}</span>
                              {bill.is_recurring && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">recurring</span>}
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5 capitalize">
                              ${parseFloat(bill.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })} · {bill.frequency}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-amber-600">${monthly.toLocaleString('en-AU', { minimumFractionDigits: 2 })}/mo</p>
                              <p className="text-xs text-gray-400">each: ${(monthly / 2).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <button onClick={() => openEdit(bill)} className="text-xs text-gray-400 hover:text-indigo-500 font-medium transition px-2 py-1 rounded-lg hover:bg-indigo-50">Edit</button>
                            <button onClick={() => setConfirmDelete(bill)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showModal && (
        <Modal title={editingItem ? 'Edit Shared Bill' : 'Add Shared Bill'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Bill Name</label>
              <input name="name" value={form.name} onChange={handle} placeholder="e.g. Rent, Electricity"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Total Amount ($)</label>
              <input name="amount" value={form.amount} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <p className="text-xs text-gray-400 mt-1">Each person will pay half</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
              <select name="category" value={form.category} onChange={handle}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Frequency</label>
              <select name="frequency" value={form.frequency} onChange={handle}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="recurring" className="text-sm text-gray-600">Recurring bill</label>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Month</label>
              <input name="month" type="month" value={form.month} onChange={handle} max={new Date().toISOString().slice(0, 7)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <p className="text-xs text-gray-400 mt-1">Change to backfill a previous month</p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={save} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50">
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Bill'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Delete Shared Bill?" message={`Are you sure you want to delete "${confirmDelete.name}"? This can't be undone.`}
          onConfirm={confirmAndDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  )
}
