import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { toMonthly, toActual, fmt } from '../utils'
import { CATEGORIES, FREQUENCIES, CATEGORY_COLOURS } from '../constants'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

const emptyForm = () => ({
  name: '', amount: '', category: 'Other', frequency: 'monthly',
  is_recurring: false, month: new Date().toISOString().slice(0, 7),
})

const monthLabel = (ym) => {
  if (!ym) return 'Unknown'
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function ExpensesPage() {
  const { user, household } = useAuth()
  const { showToast } = useToast()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterCat, setFilterCat] = useState('All')

  const fetchExpenses = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*')
      .eq('user_id', user.id).eq('is_shared', false).order('month', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [])

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
    setSaving(true)
    const payload = { name: form.name.trim(), amount: parseFloat(form.amount), category: form.category, frequency: form.frequency, is_recurring: form.is_recurring, month: form.month }
    const { error } = editingItem
      ? await supabase.from('expenses').update(payload).eq('id', editingItem.id)
      : await supabase.from('expenses').insert({ ...payload, user_id: user.id, household_id: household?.id, is_shared: false })
    if (error) { setError(error.message); setSaving(false); return }
    setShowModal(false); setEditingItem(null); setForm(emptyForm())
    showToast(editingItem ? 'Expense updated!' : 'Expense saved!')
    fetchExpenses(); setSaving(false)
  }

  const confirmAndDelete = async () => {
    await supabase.from('expenses').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Expense deleted', 'error'); fetchExpenses()
  }

  const filtered = filterCat === 'All' ? expenses : expenses.filter(e => e.category === filterCat)
  const grouped = filtered.reduce((acc, e) => {
    const m = e.month || 'Unknown'; if (!acc[m]) acc[m] = []; acc[m].push(e); return acc
  }, {})

  // Current month recurring total for the header (excludes one-offs)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMonthExp = expenses.filter(e => e.month === currentMonth)
  const totalMonthly = currentMonthExp.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
  const totalActual = currentMonthExp.reduce((s, e) => s + toActual(e.amount, e.frequency), 0)
  const hasOneOffs = totalActual > totalMonthly

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Expenses</h1>
            <p className="text-gray-400 text-sm mt-1">Your personal spending</p>
          </div>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Add Expense
          </button>
        </div>

        <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl p-5 text-white mb-6">
          <p className="text-rose-100 text-sm">This Month's Spending</p>
          <p className="text-3xl font-bold mt-1">${fmt(totalActual)}</p>
          {hasOneOffs && (
            <p className="text-rose-200 text-xs mt-1">Recurring: ${fmt(totalMonthly)} + one-offs: ${fmt(totalActual - totalMonthly)}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'}`}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">🧾</div>
              <p className="text-gray-500 font-medium">No expenses yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "+ Add Expense" to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([month, items]) => (
                <div key={month}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{monthLabel(month)}</p>
                  <div className="space-y-3">
                    {items.map((exp) => (
                      <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{exp.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLOURS[exp.category] || 'bg-gray-50 text-gray-600'}`}>{exp.category}</span>
                          </div>
                          <p className="text-sm text-gray-400 mt-0.5 capitalize">
                            ${fmt(exp.amount)} · {exp.frequency}
                            {exp.is_recurring && <span className="ml-2 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">recurring</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-rose-500">
                            {exp.frequency === 'one-off'
                              ? <span className="text-amber-600">${fmt(exp.amount)} one-off</span>
                              : `$${fmt(toMonthly(exp.amount, exp.frequency))}/mo`}
                          </p>
                          <button onClick={() => openEdit(exp)} className="text-xs text-gray-400 hover:text-indigo-500 font-medium transition px-2 py-1 rounded-lg hover:bg-indigo-50">Edit</button>
                          <button onClick={() => setConfirmDelete(exp)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
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
        <Modal title={editingItem ? 'Edit Expense' : 'Add Personal Expense'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
              <input name="name" value={form.name} onChange={handle} placeholder="e.g. Gym, Netflix"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount ($)</label>
              <input name="amount" value={form.amount} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
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
              <label htmlFor="recurring" className="text-sm text-gray-600">Recurring expense</label>
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
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Delete Expense?" message={`Delete "${confirmDelete.name}"? This can't be undone.`}
          onConfirm={confirmAndDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  )
}
