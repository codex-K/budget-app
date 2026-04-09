import { useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export async function runRecurringPopulate(user, household) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const flagKey = `recurring_populated_${user.id}_${currentMonth}`
  if (localStorage.getItem(flagKey)) return 0

  try {
    const [{ data: recurringIncome, error: incErr }, { data: recurringExpenses, error: expErr }] = await Promise.all([
      supabase.from('income').select('*').eq('user_id', user.id).eq('is_recurring', true),
      supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_recurring', true).eq('is_shared', false),
    ])
    if (incErr) throw new Error(incErr.message)
    if (expErr) throw new Error(expErr.message)

    let recurringShared = []
    if (household?.id) {
      const { data, error } = await supabase.from('expenses').select('*')
        .eq('household_id', household.id).eq('is_recurring', true).eq('is_shared', true)
      if (error) throw new Error(error.message)
      recurringShared = data || []
    }

    const [{ data: existingIncome }, { data: existingExpenses }] = await Promise.all([
      supabase.from('income').select('name').eq('user_id', user.id).eq('month', currentMonth),
      supabase.from('expenses').select('name, category').eq('user_id', user.id).eq('is_shared', false).eq('month', currentMonth),
    ])

    const existingIncomeNames = new Set((existingIncome || []).map(i => i.name))
    // Use name+category composite key to avoid false deduplication matches
    const existingExpenseKeys = new Set((existingExpenses || []).map(e => `${e.name}|${e.category || ''}`))

    let existingSharedKeys = new Set()
    if (household?.id) {
      const { data } = await supabase.from('expenses').select('name, category')
        .eq('household_id', household.id).eq('is_shared', true).eq('month', currentMonth)
      existingSharedKeys = new Set((data || []).map(b => `${b.name}|${b.category || ''}`))
    }

    const newIncome = (recurringIncome || [])
      .filter(i => !existingIncomeNames.has(i.name))
      .map(({ id, created_at, ...rest }) => ({ ...rest, month: currentMonth }))

    const newExpenses = (recurringExpenses || [])
      .filter(e => !existingExpenseKeys.has(`${e.name}|${e.category || ''}`))
      .map(({ id, created_at, ...rest }) => ({ ...rest, month: currentMonth }))

    const newShared = recurringShared
      .filter(b => !existingSharedKeys.has(`${b.name}|${b.category || ''}`))
      .map(({ id, created_at, ...rest }) => ({ ...rest, month: currentMonth }))

    const inserts = []
    if (newIncome.length > 0) inserts.push(supabase.from('income').insert(newIncome))
    if (newExpenses.length > 0) inserts.push(supabase.from('expenses').insert(newExpenses))
    if (newShared.length > 0) inserts.push(supabase.from('expenses').insert(newShared))

    if (inserts.length > 0) {
      const results = await Promise.all(inserts)
      const errors = results.filter(r => r.error).map(r => r.error.message)
      if (errors.length > 0) throw new Error(errors.join(', '))
    }

    const total = newIncome.length + newExpenses.length + newShared.length
    localStorage.setItem(flagKey, 'true')
    return total

  } catch (err) {
    console.error('Recurring auto-populate failed:', err.message)
    return -1
  }
}

export function useRecurring() {
  const { user, household } = useAuth()
  useEffect(() => {
    if (user) runRecurringPopulate(user, household)
  }, [user, household])
}
