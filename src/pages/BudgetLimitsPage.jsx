import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

const CATEGORIES = ['Housing', 'Transport', 'Food', 'Health', 'Entertainment', 'Clothing', 'Subscriptions', 'Education', 'Personal Care', 'Other']

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const toMonthly = (amount, frequency) => {
  const n = parseFloat(amount) || 0
  if (frequency === 'weekly') return n * 52 / 12
  if (frequency === 'fortnightly') return n * 26 / 12
  if (frequency === 'yearly') return n / 12
  return n
}

const STATUS_COLOUR = (pct) => {
  if (pct >= 100) return { bar: 'bg-red-500', badge: 'bg-red-50 text-red-600', label: 'Over budget' }
  if (pct >= 80) return { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600', label: 'Almost there' }
  return { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600', label: 'On track' }
}

export default function BudgetLimitsPage() {
  const { user, household } = useAuth()
  const { showToast } = useToast()
  const [limits, setLimits] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLimit, setEditingLimit] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ category: 'Food', monthly_limit: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentMonth = new Date().toISOString().slice(0, 7)

  const fetchData = async () => {
    setLoading(true)
    const [limitsRes, expRes] = await Promise.all([
      supabase.from('budget_limits').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_shared', false).eq('month', currentMonth),
    ])
    setLimits(limitsRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const openAdd = () => { setEditingLimit(null); setForm({ category: 'Food', monthly_limit: '' }); setError(''); setShowModal(true) }
  const openEdit = (limit) => { setEditingLimit(limit); setForm({ category: limit.category, monthly_limit: limit.monthly_limit }); setError(''); setShowModal(true) }

  const save = async () => {
    if (!form.monthly_limit || isNaN(form.monthly_limit) || parseFloat(form.monthly_limit) <= 0)
      return setError('Please enter a valid limit amount')
    setSaving(true)
    if (editingLimit) {
      const { error } = await supabase.from('budget_limits').update({ monthly_limit: parseFloat(form.monthly_limit) }).eq('id', editingLimit.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const exists = limits.find(l => l.category === form.category)
      if (exists) return setError(`A limit for ${form.category} already exists. Click Edit to update it.`)
      const { error } = await supabase.from('budget_limits').insert({ user_id: user.id, household_id: household?.id, category: form.category, monthly_limit: parseFloat(form.monthly_limit) })
      if (error) { setError(error.message); setSaving(false); return }
    }
    setShowModal(false)
    showToast(editingLimit ? 'Budget limit updated!' : 'Budget limit set!')
    fetchData(); setSaving(false)
  }

  const confirmAndDelete = async () => {
    await supabase.from('budget_limits').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    showToast('Budget limit removed', 'error')
    fetchData()
  }

  const spendByCategory = expenses.reduce((acc, e) => {
    const cat = e.category || 'Other'
    acc[cat] = (acc[cat] || 0) + toMonthly(e.amount, e.frequency)
    return acc
  }, {})

  const usedCategories = limits.map(l => l.category)
  const availableCategories = CATEGORIES.filter(c => !usedCategories.includes(c))

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Budget Limits</h1>
            <p className="text-gray-400 text-sm mt-1">Monthly spending limits per category</p>
          </div>
          <button onClick={openAdd} disabled={availableCategories.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Set Limit
          </button>
        </div>

        {loading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          : limits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-500 font-medium">No budget limits set</p>
              <p className="text-gray-400 text-sm mt-1">Set limits to get warnings when you're close to overspending</p>
            </div>
          ) : (
            <div className="space-y-4">
              {limits.map((limit) => {
                const spent = spendByCategory[limit.category] || 0
                const cap = parseFloat(limit.monthly_limit)
                const pct = Math.min((spent / cap) * 100, 100)
                const remaining = Math.max(cap - spent, 0)
                const colours = STATUS_COLOUR(pct)
                return (
                  <div key={limit.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{limit.category}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colours.badge}`}>{colours.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500"><span className="font-semibold text-gray-800">${fmt(spent)}</span> / ${fmt(cap)}</p>
                        <button onClick={() => openEdit(limit)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition">Edit</button>
                        <button onClick={() => setConfirmDelete(limit)} className="text-gray-300 hover:text-red-400 transition text-lg">✕</button>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all duration-500 ${colours.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <p className="text-xs text-gray-400">{pct.toFixed(0)}% used</p>
                      {pct < 100
                        ? <p className="text-xs text-gray-400">${fmt(remaining)} remaining</p>
                        : <p className="text-xs text-red-500 font-medium">${fmt(Math.abs(spent - cap))} over!</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        {Object.keys(spendByCategory).some(cat => !usedCategories.includes(cat)) && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-500 mb-3">Spending without a limit set</p>
            <div className="space-y-2">
              {Object.entries(spendByCategory).filter(([cat]) => !usedCategories.includes(cat)).map(([cat, spent]) => (
                <div key={cat} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">{cat}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-800">${fmt(spent)}/mo</p>
                    <button onClick={() => { setForm({ category: cat, monthly_limit: '' }); setEditingLimit(null); setError(''); setShowModal(true) }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Set limit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editingLimit ? `Edit ${editingLimit.category} Limit` : 'Set Budget Limit'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {!editingLimit && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
                <select name="category" value={form.category} onChange={handle}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {availableCategories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Monthly Limit ($)</label>
              <input name="monthly_limit" value={form.monthly_limit} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <p className="text-xs text-gray-400 mt-1">Warning shown at 80%, alert at 100%</p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={save} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50">
              {saving ? 'Saving...' : editingLimit ? 'Update Limit' : 'Set Limit'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Remove Budget Limit?" message={`Remove the limit for "${confirmDelete.category}"?`}
          onConfirm={confirmAndDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  )
}
