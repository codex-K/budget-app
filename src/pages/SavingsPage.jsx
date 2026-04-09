import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fmt } from '../utils'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

const emptyForm = () => ({ name: '', target_amount: '', current_amount: '', monthly_contribution: '' })

export default function SavingsPage() {
  const { household } = useAuth()
  const { showToast } = useToast()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [showAllocateModal, setShowAllocateModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [allocateAmount, setAllocateAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchGoals = async () => {
    if (!household?.id) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('savings_goals').select('*')
      .eq('household_id', household.id).order('created_at', { ascending: true })
    setGoals(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchGoals() }, [household])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const openAdd = () => { setEditingGoal(null); setForm(emptyForm()); setError(''); setShowAddModal(true) }
  const openEdit = (goal) => {
    setEditingGoal(goal)
    setForm({
      name: goal.name, target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      monthly_contribution: goal.monthly_contribution || '',
    })
    setError(''); setShowAddModal(true)
  }

  const saveGoal = async () => {
    if (!form.name.trim()) return setError('Please enter a goal name')
    if (!form.target_amount || isNaN(form.target_amount)) return setError('Please enter a target amount')
    if (!household?.id) return setError('No household linked')
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      monthly_contribution: parseFloat(form.monthly_contribution) || 0,
    }

    const { error } = editingGoal
      ? await supabase.from('savings_goals').update(payload).eq('id', editingGoal.id)
      : await supabase.from('savings_goals').insert({ ...payload, household_id: household.id })

    if (error) { setError(error.message); setSaving(false); return }
    setShowAddModal(false); setEditingGoal(null); setForm(emptyForm())
    showToast(editingGoal ? 'Goal updated!' : 'Goal created!')
    fetchGoals(); setSaving(false)
  }

  const allocate = async () => {
    if (!allocateAmount || isNaN(allocateAmount) || parseFloat(allocateAmount) <= 0)
      return setError('Please enter a valid amount')
    setSaving(true)
    const newAmount = parseFloat(showAllocateModal.current_amount) + parseFloat(allocateAmount)
    const { error } = await supabase.from('savings_goals').update({ current_amount: newAmount }).eq('id', showAllocateModal.id)
    if (error) { setError(error.message); setSaving(false); return }
    setShowAllocateModal(null); setAllocateAmount('')
    showToast(`$${parseFloat(allocateAmount).toFixed(2)} added to "${showAllocateModal.name}"!`)
    fetchGoals(); setSaving(false)
  }

  const confirmAndDelete = async () => {
    await supabase.from('savings_goals').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null); showToast('Goal deleted', 'error'); fetchGoals()
  }

  const totalSaved = goals.reduce((s, g) => s + parseFloat(g.current_amount || 0), 0)
  const totalTarget = goals.reduce((s, g) => s + parseFloat(g.target_amount || 0), 0)
  const totalMonthlyCommitment = goals.reduce((s, g) => s + parseFloat(g.monthly_contribution || 0), 0)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Savings Goals</h1>
            <p className="text-gray-400 text-sm mt-1">Track what you're working towards together</p>
          </div>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + New Goal
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-5 text-white col-span-1">
            <p className="text-teal-100 text-xs">Total Saved</p>
            <p className="text-2xl font-bold mt-1">${fmt(totalSaved)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-gray-400 text-xs">Total Target</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">${fmt(totalTarget)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-gray-400 text-xs">Monthly Commitment</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">${fmt(totalMonthlyCommitment)}</p>
          </div>
        </div>

        {!household?.id && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-700">
            ⚠️ Savings goals are shared with your partner. Link a household in Settings first.
          </div>
        )}

        {loading ? <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          : goals.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-gray-500 font-medium">No savings goals yet</p>
              <p className="text-gray-400 text-sm mt-1">Create a goal to start tracking</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const current = parseFloat(goal.current_amount || 0)
                const target = parseFloat(goal.target_amount || 1)
                const monthly = parseFloat(goal.monthly_contribution || 0)
                const pct = Math.min((current / target) * 100, 100)
                const remaining = Math.max(target - current, 0)
                const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null
                const isComplete = current >= target

                return (
                  <div key={goal.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{goal.name}</p>
                          {isComplete && <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">✓ Complete!</span>}
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">
                          ${fmt(current)} of ${fmt(target)}
                          {!isComplete && <span className="ml-1">· ${fmt(remaining)} to go</span>}
                        </p>
                        {monthly > 0 && !isComplete && (
                          <p className="text-xs text-indigo-500 mt-0.5">
                            ${fmt(monthly)}/mo commitment
                            {monthsLeft && ` · ~${monthsLeft} month${monthsLeft !== 1 ? 's' : ''} away`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setShowAllocateModal(goal); setError(''); setAllocateAmount('') }}
                          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition">
                          + Add
                        </button>
                        <button onClick={() => openEdit(goal)}
                          className="text-xs text-gray-400 hover:text-indigo-500 font-medium transition px-2 py-1 rounded-lg hover:bg-indigo-50">
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(goal)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
                      </div>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 text-right">{pct.toFixed(0)}%</p>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {showAddModal && (
        <Modal title={editingGoal ? 'Edit Goal' : 'New Savings Goal'} onClose={() => setShowAddModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Goal Name</label>
              <input name="name" value={form.name} onChange={handle} placeholder="e.g. Holiday, House Deposit"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Target Amount ($)</label>
              <input name="target_amount" value={form.target_amount} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Already Saved ($) <span className="text-gray-400 font-normal">optional</span>
              </label>
              <input name="current_amount" value={form.current_amount} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Monthly Contribution ($) <span className="text-gray-400 font-normal">optional</span>
              </label>
              <input name="monthly_contribution" value={form.monthly_contribution} onChange={handle} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <p className="text-xs text-gray-400 mt-1">How much you plan to put towards this each month — shows an estimated completion date</p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={saveGoal} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50">
              {saving ? 'Saving...' : editingGoal ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </Modal>
      )}

      {showAllocateModal && (
        <Modal title={`Add to "${showAllocateModal.name}"`} onClose={() => setShowAllocateModal(null)}>
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-700">
              Currently saved: <strong>${fmt(showAllocateModal.current_amount)}</strong> of <strong>${fmt(showAllocateModal.target_amount)}</strong>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount to Add ($)</label>
              <input value={allocateAmount} onChange={(e) => setAllocateAmount(e.target.value)} placeholder="0.00" type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={allocate} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Add to Goal'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal title="Delete Goal?" message={`Delete "${confirmDelete.name}"? All progress will be lost.`}
          onConfirm={confirmAndDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </Layout>
  )
}
