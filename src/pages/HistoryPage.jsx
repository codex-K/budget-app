import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { toActual, fmt } from '../utils'
import { PIE_COLOURS } from '../constants'
import Layout from '../components/Layout'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

const getMonths = (n) => {
  const months = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}

const monthLabelLong = (ym) => {
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: ${fmt(p.value)}</p>)}
    </div>
  )
}

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>${fmt(payload[0].value)}</p>
      <p className="text-gray-400 text-xs">{payload[0].payload.pct}%</p>
    </div>
  )
}

const RANGE_OPTIONS = [
  { label: '6 months', value: 6 },
  { label: '12 months', value: 12 },
  { label: '24 months', value: 24 },
]

// CSV export helper
const exportCSV = (transactions, month) => {
  const headers = ['Date', 'Name', 'Type', 'Category', 'Frequency', 'Amount']
  const rows = transactions.map(t => [
    t.created_at ? t.created_at.slice(0, 10) : month,
    `"${t.name}"`,
    t._type === 'income' ? 'Income' : t._type === 'shared' ? 'Shared Bill (your half)' : 'Expense',
    t._type === 'income' ? t.frequency : (t.category || 'Other'),
    t.frequency || '',
    t._type === 'income' ? t._monthly.toFixed(2) : `-${t._monthly.toFixed(2)}`,
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ourbudget-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryPage() {
  const { user, household } = useAuth()
  const [allExpenses, setAllExpenses] = useState([])
  const [allIncome, setAllIncome] = useState([])
  const [allShared, setAllShared] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [chartType, setChartType] = useState('bar')
  const [monthRange, setMonthRange] = useState(6)

  const months = getMonths(monthRange)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const oldest = getMonths(monthRange)[0]
      const [expRes, incRes, sharedRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_shared', false).gte('month', oldest),
        supabase.from('income').select('*').eq('user_id', user.id).gte('month', oldest),
        household?.id
          ? supabase.from('expenses').select('*').eq('household_id', household.id).eq('is_shared', true).gte('month', oldest)
          : Promise.resolve({ data: [] }),
      ])
      setAllExpenses(expRes.data || [])
      setAllIncome(incRes.data || [])
      setAllShared(sharedRes.data || [])
      setLoading(false)
    }
    fetchAll()
  }, [user, household, monthRange])

  useEffect(() => {
    if (!months.includes(selectedMonth)) setSelectedMonth(months[months.length - 1])
  }, [monthRange])

  // Use toActual throughout history — we're reporting real spending per month
  const trendData = months.map((m) => {
    const monthIncome = allIncome.filter(i => i.month === m).reduce((s, i) => s + toActual(i.amount, i.frequency), 0)
    const monthPersonal = allExpenses.filter(e => e.month === m).reduce((s, e) => s + toActual(e.amount, e.frequency), 0)
    const monthShared = allShared.filter(b => b.month === m).reduce((s, b) => s + toActual(b.amount, b.frequency), 0) / 2
    const total = monthPersonal + monthShared
    return {
      month: monthLabel(m),
      Income: parseFloat(monthIncome.toFixed(2)),
      Expenses: parseFloat(total.toFixed(2)),
      Surplus: parseFloat(Math.max(monthIncome - total, 0).toFixed(2)),
    }
  })

  const selectedExpenses = allExpenses.filter(e => e.month === selectedMonth)
  const selectedIncome = allIncome.filter(i => i.month === selectedMonth)
  const selectedShared = allShared.filter(b => b.month === selectedMonth)

  const categoryTotals = selectedExpenses.reduce((acc, e) => {
    const cat = e.category || 'Other'
    acc[cat] = (acc[cat] || 0) + toActual(e.amount, e.frequency)
    return acc
  }, {})
  const sharedTotal = selectedShared.reduce((s, b) => s + toActual(b.amount, b.frequency), 0) / 2
  if (sharedTotal > 0) categoryTotals['Shared Bills'] = sharedTotal

  const totalSpend = Object.values(categoryTotals).reduce((s, v) => s + v, 0)
  const pieData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name, value: parseFloat(value.toFixed(2)),
      fill: PIE_COLOURS[i % PIE_COLOURS.length],
      pct: totalSpend > 0 ? ((value / totalSpend) * 100).toFixed(1) : '0',
    }))

  const totalMonthIncome = selectedIncome.reduce((s, i) => s + toActual(i.amount, i.frequency), 0)
  const selectedNet = totalMonthIncome - totalSpend

  const transactions = [
    ...selectedIncome.map(i => ({ ...i, _type: 'income', _monthly: toActual(i.amount, i.frequency) })),
    ...selectedExpenses.map(e => ({ ...e, _type: 'expense', _monthly: toActual(e.amount, e.frequency) })),
    ...selectedShared.map(b => ({ ...b, _type: 'shared', _monthly: toActual(b.amount, b.frequency) / 2 })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">History</h1>
            <p className="text-gray-400 text-sm mt-1">Your financial trends over time</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {RANGE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setMonthRange(o.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${monthRange === o.value ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 animate-pulse">Loading history...</div>
        ) : (
          <div className="space-y-6">

            {/* Trend chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="font-semibold text-gray-800">Income vs Expenses</p>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {['bar', 'line'].map(t => (
                    <button key={t} onClick={() => setChartType(t)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition capitalize ${chartType === t ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                {chartType === 'bar' ? (
                  <BarChart data={trendData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Income" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="Income" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
                    <Line type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: '#f43f5e' }} />
                    <Line type="monotone" dataKey="Surplus" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#10b981' }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Month selector + Export */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-500">Monthly breakdown</p>
                <button
                  onClick={() => exportCSV(transactions, selectedMonth)}
                  disabled={transactions.length === 0}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                  ↓ Export CSV — {monthLabel(selectedMonth)}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[...months].reverse().map(m => (
                  <button key={m} onClick={() => setSelectedMonth(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${selectedMonth === m ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Income', value: totalMonthIncome, colour: 'text-indigo-600' },
                { label: 'Spending', value: totalSpend, colour: 'text-rose-500' },
                { label: selectedNet >= 0 ? 'Surplus' : 'Deficit', value: Math.abs(selectedNet), colour: selectedNet >= 0 ? 'text-emerald-600' : 'text-red-500' },
              ].map(({ label, value, colour }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${colour}`}>${fmt(value)}</p>
                </div>
              ))}
            </div>

            {/* Pie chart */}
            {pieData.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="font-semibold text-gray-800 mb-4">Spending by Category — {monthLabelLong(selectedMonth)}</p>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-full max-w-xs">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                          <span className="text-sm text-gray-600">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{entry.pct}%</span>
                          <span className="text-sm font-semibold text-gray-800">${fmt(entry.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">No expenses recorded for {monthLabelLong(selectedMonth)}</p>
              </div>
            )}

            {/* Transaction list with CSV export */}
            {transactions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-gray-800">All Transactions — {monthLabelLong(selectedMonth)}</p>
                </div>
                <div className="space-y-1">
                  {transactions.map((t) => {
                    const isIncome = t._type === 'income'
                    return (
                      <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${isIncome ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-500'}`}>
                            {isIncome ? '↑' : '↓'}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{t.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400 capitalize">{isIncome ? t.frequency : (t.category || 'Shared')}</span>
                              {t._type === 'shared' && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">shared (your half)</span>}
                              {t.frequency === 'one-off' && <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">one-off</span>}
                              {t.is_recurring && t.frequency !== 'one-off' && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">recurring</span>}
                            </div>
                          </div>
                        </div>
                        <p className={`text-sm font-semibold flex-shrink-0 ml-2 ${isIncome ? 'text-indigo-600' : 'text-rose-500'}`}>
                          {isIncome ? '+' : '−'}${fmt(t._monthly)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </Layout>
  )
}
