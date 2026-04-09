import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { toMonthly, fmt } from '../utils'
import { INCOME_FREQUENCIES } from '../constants'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

const emptyForm = () => ({
  name: '', amount: '', frequency: 'monthly', is_recurring: true,
  month: new Date().toISOString().slice(0, 7),
})

const monthLabel = (ym) => {
  if (!ym) return 'Unknown'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function IncomePage() {
  const { user, household } = useAuth()
  const { showToast } = useToast()
  const [incomes, setIncomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchIncomes = async () => {
    setLoading(true)
    const { data } = await supabase.from('income').select('*')
      .eq('user_id', user.id).order('month', { ascending: false })
    setIncomes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchIncomes() }, [])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const openAdd = () => { setEditingItem(null); setForm(emptyForm()); setError(''); setShowModal(true) }
  const openEdit = (item) => {
    setEditingItem(item)
    setForm({ name: item.name, amount: item.amount, frequency: item.frequency, is_recurring: item.is_recurring, month: item.month || new Date().toISOString().slice(0, 7) })
    setError(''); setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return setError('Please enter a name')
    if (!form.amount || isNaN(form.amount)) return setError('Please enter a valid amount')
    setSaving(true)
    const payload = { name: form.name.trim(), amount: parseFloat(form.amount), frequency: form.frequency, is_recurring: form.is_recurring, month: form.month }
    const { error } = editingItem
      ? await supabase.from('income').update(payload).eq('id', editingItem.id)
      : await supabase.from('income').insert({ ...payload, user_id: user.id, household_id: household?.id })
    if (error) { setError(error.message); setSaving(false); return }
    setShowModal(false); setEditingItem(null); setForm(emptyForm())
    showToast(editingItem ? 'Income updated!' : 'Income saved!')
    fetchIncomes(); setSaving(false)
  }

  const confirmAndDelete = async () => {
    await supabase.from('income').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Income deleted', 'error'); fetchIncomes()
  }

  // toMonthly (not toActual) for the header — shows ongoing monthly commitment, excludes one-offs
  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMonthIncome = incomes.filter(i => i.month === currentMonth)
  const totalMonthly = currentMonthIncome.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)

  const grouped = incomes.reduce((acc, i) => {
    const m = i.month || 'Unknown'; if (!acc[m]) acc[m] = []; acc[m].push(i); return acc
  }, {})

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Income</h1>
            <p className="text-gray-400 text-sm mt-1">Your personal income sources</p>
          </div>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Add Income
          </button>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl p-5 text-white mb-6">
          <p className="text-indigo-100 text-sm">Recurring Monthly Income</p>
          <p className="text-3xl font-bold mt-1">${fmt(totalMonthly)}</p>
          <p className="text-indigo-200 text-xs mt-1">One-off income shown separately below</p>
        </div>

        {loading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          : incomes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">💵</div>
              <p className="text-gray-500 font-medium">No income added yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "+ Add Income" to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{monthLabel(month)}</p>
                  <div className="space-y-3">
                    {items.map((inc) => (
                      <div key={inc.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{inc.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5 capitalize">
                            ${fmt(inc.amount)} · {inc.frequency}
                            {inc.is_recurring && <span className="ml-2 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">recurring</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-indigo-600">
                            {inc.frequency === 'one-off'
                              ? <span className="text-amber-600">${fmt(inc.amount)} one-off</span>
                              : `$${fmt(toMonthly(inc.amount, inc.frequency))}/mo`}
                          </p>
                          <button onClick={() => openEdit(inc)} className="text-xs text-gray-400 hover:text-indigo-500 font-medium transition px-2 py-1 rounded-lg hover:bg-indigo-50">Edit</button>
                          <button onClick={() => setConfirmDelete(inc)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showModal && (
        <Modal title={editingItem ? 'Edit Income' : 'Add Income Source'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input name="name" value={form.name} onChange={handle} placeholder="e.g. Salary, Freelance"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount ($)</label>
              <input name="amount" value={form.amount} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Frequency</label>
              <select name="frequency" value={form.frequency} onChange={handle}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {INCOME_FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="recurring" className="text-sm text-gray-600">Recurring income</label>
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
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Income'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Delete Income?" message={`Delete "${confirmDelete.name}"? This can't be undone.`}
          onConfirm={confirmAndDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  )
}
