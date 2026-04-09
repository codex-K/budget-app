import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { runRecurringPopulate } from '../hooks/useRecurring'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const toMonthly = (amount, frequency) => {
  const n = parseFloat(amount) || 0
  if (frequency === 'weekly') return n * 52 / 12
  if (frequency === 'fortnightly') return n * 26 / 12
  if (frequency === 'yearly') return n / 12
  return n
}

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PIE_COLOURS = [
  '#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b',
]

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700">{d.name || d.payload?.category}</p>
      <p style={{ color: d.payload?.fill || d.fill || '#6366f1' }}>${fmt(d.value)}</p>
      {d.payload?.pct && <p className="text-gray-400 text-xs">{d.payload.pct}%</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user, household, displayName } = useAuth()

  const [myIncome, setMyIncome] = useState([])
  const [myExpenses, setMyExpenses] = useState([])
  const [sharedBills, setSharedBills] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [budgetLimits, setBudgetLimits] = useState([])
  const [partner, setPartner] = useState(null)
  const [partnerIncome, setPartnerIncome] = useState([])
  const [partnerExpenses, setPartnerExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [recurringNotice, setRecurringNotice] = useState(null)
  const [chartView, setChartView] = useState('donut') // 'donut' | 'pie' | 'bar'

  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (!user) return
    const init = async () => {
      setLoading(true)
      const newCount = await runRecurringPopulate(user, household)
      if (newCount > 0) setRecurringNotice(newCount)
      if (newCount === -1) setRecurringNotice(-1)

      const [incRes, expRes, sharedRes, savRes, limRes] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id).eq('month', currentMonth),
        supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_shared', false).eq('month', currentMonth),
        household?.id
          ? supabase.from('expenses').select('*').eq('household_id', household.id).eq('is_shared', true).eq('month', currentMonth)
          : Promise.resolve({ data: [] }),
        household?.id
          ? supabase.from('savings_goals').select('*').eq('household_id', household.id)
          : Promise.resolve({ data: [] }),
        supabase.from('budget_limits').select('*').eq('user_id', user.id),
      ])

      setMyIncome(incRes.data || [])
      setMyExpenses(expRes.data || [])
      setSharedBills(sharedRes.data || [])
      setSavingsGoals(savRes.data || [])
      setBudgetLimits(limRes.data || [])

      if (household?.id) {
        const { data: members } = await supabase
          .from('household_members')
          .select('user_id, display_name')
          .eq('household_id', household.id)
          .neq('user_id', user.id)

        if (members?.length > 0) {
          const partnerMember = members[0]
          setPartner(partnerMember)
          const [pIncRes, pExpRes] = await Promise.all([
            supabase.from('income').select('*').eq('user_id', partnerMember.user_id).eq('month', currentMonth),
            supabase.from('expenses').select('*').eq('user_id', partnerMember.user_id).eq('is_shared', false).eq('month', currentMonth),
          ])
          setPartnerIncome(pIncRes.data || [])
          setPartnerExpenses(pExpRes.data || [])
        }
      }

      setLoading(false)
    }
    init()
  }, [user, household])

  // Calculations
  const myTotalIncome = myIncome.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const myTotalExp = myExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
  const totalShared = sharedBills.reduce((s, b) => s + toMonthly(b.amount, b.frequency), 0)
  const myShareOfBills = totalShared / 2
  const myOutgoings = myTotalExp + myShareOfBills
  const myNet = myTotalIncome - myOutgoings

  const partnerTotalIncome = partnerIncome.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const partnerTotalExp = partnerExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
  const partnerOutgoings = partnerTotalExp + myShareOfBills
  const partnerNet = partnerTotalIncome - partnerOutgoings

  const householdIncome = myTotalIncome + partnerTotalIncome
  const householdExpenses = myTotalExp + partnerTotalExp + totalShared
  const householdNet = householdIncome - householdExpenses

  // Budget warnings
  const spendByCategory = myExpenses.reduce((acc, e) => {
    acc[e.category || 'Other'] = (acc[e.category || 'Other'] || 0) + toMonthly(e.amount, e.frequency)
    return acc
  }, {})
  const budgetWarnings = budgetLimits
    .map(l => ({ ...l, pct: ((spendByCategory[l.category] || 0) / l.monthly_limit) * 100 }))
    .filter(l => l.pct >= 80)
    .sort((a, b) => b.pct - a.pct)

  // Spending breakdown chart data (personal + share of shared bills)
  const categoryTotals = { ...spendByCategory }
  if (myShareOfBills > 0) categoryTotals['Shared Bills'] = myShareOfBills
  const totalSpend = Object.values(categoryTotals).reduce((s, v) => s + v, 0)

  const chartData = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value], i) => ({
      category,
      value: parseFloat(value.toFixed(2)),
      fill: PIE_COLOURS[i % PIE_COLOURS.length],
      pct: totalSpend > 0 ? ((value / totalSpend) * 100).toFixed(1) : '0',
    }))

  const isPositive = (n) => n >= 0
  const isEmpty = myIncome.length === 0 && myExpenses.length === 0 && sharedBills.length === 0

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">👋 Hey, {displayName || 'there'}!</h1>
          <p className="text-gray-400 text-sm mt-1">{monthName} snapshot</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 animate-pulse">Loading your finances...</div>
        ) : (
          <div className="space-y-6">

            {/* Recurring notice */}
            {recurringNotice !== null && recurringNotice > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-emerald-700">
                  ✅ <strong>{recurringNotice} recurring item{recurringNotice > 1 ? 's' : ''}</strong> automatically added for {monthName}
                </span>
                <button onClick={() => setRecurringNotice(null)} className="text-emerald-400 hover:text-emerald-600 text-lg leading-none">✕</button>
              </div>
            )}
            {recurringNotice === -1 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                ⚠️ Some recurring items may not have loaded. Try refreshing the page.
              </div>
            )}

            {/* Budget warnings */}
            {budgetWarnings.length > 0 && (
              <div className="space-y-2">
                {budgetWarnings.map(w => (
                  <div key={w.id} className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm
                    ${w.pct >= 100 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    <span>{w.pct >= 100 ? '🚨' : '⚠️'} <strong>{w.category}</strong> — {w.pct >= 100 ? 'over budget!' : `${w.pct.toFixed(0)}% of limit used`}</span>
                    <Link to="/budget" className="underline text-xs font-medium">View</Link>
                  </div>
                ))}
              </div>
            )}

            {isEmpty ? (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                  <p className="font-semibold text-indigo-800 mb-1">Welcome to {monthName}! 🎉</p>
                  <p className="text-indigo-600 text-sm">No data entered for this month yet. Get started below.</p>
                </div>
                {[
                  { to: '/income', icon: '💵', label: 'Add your income', desc: 'Start by entering your salary or other income sources', cta: 'Add Income' },
                  { to: '/expenses', icon: '🧾', label: 'Add personal expenses', desc: 'Track your individual spending this month', cta: 'Add Expenses' },
                  { to: '/shared', icon: '🏠', label: 'Add shared bills', desc: 'Enter bills you split with your partner', cta: 'Add Bills' },
                  { to: '/budget', icon: '📊', label: 'Set budget limits', desc: 'Get warnings before you overspend', cta: 'Set Limits' },
                  { to: '/savings', icon: '🎯', label: 'Create a savings goal', desc: 'Set a target to work towards together', cta: 'Add Goal' },
                ].map(({ to, icon, label, desc, cta }) => (
                  <Link key={to} to={to}
                    className="bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 p-4 flex items-center justify-between transition group">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-3 py-1.5 rounded-lg group-hover:bg-indigo-100 transition flex-shrink-0 ml-4">
                      {cta} →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <>
                {/* Household hero */}
                {partner && (
                  <div className={`rounded-2xl p-6 ${isPositive(householdNet)
                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500'
                    : 'bg-gradient-to-r from-red-500 to-rose-500'} text-white`}>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">🏡 Household — {monthName}</p>
                    <p className="text-white/80 text-sm">Combined monthly surplus / deficit</p>
                    <p className="text-4xl font-bold mt-1">{isPositive(householdNet) ? '+' : '-'}${fmt(Math.abs(householdNet))}</p>
                    <p className="text-white/60 text-xs mt-2">Income ${fmt(householdIncome)} − Expenses ${fmt(householdExpenses)}</p>
                  </div>
                )}

                {/* Individual cards */}
                <div className={`grid gap-4 ${partner ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className={`rounded-2xl p-5 ${isPositive(myNet)
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-br from-red-500 to-rose-500'} text-white`}>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">👤 {displayName || 'Me'}</p>
                    <p className="text-white/80 text-sm">Monthly surplus / deficit</p>
                    <p className="text-3xl font-bold mt-1">{isPositive(myNet) ? '+' : '-'}${fmt(Math.abs(myNet))}</p>
                    <div className="mt-3 space-y-1 text-xs text-white/70">
                      <p>Income: ${fmt(myTotalIncome)}</p>
                      <p>Personal exp: ${fmt(myTotalExp)}</p>
                      <p>Share of bills: ${fmt(myShareOfBills)}</p>
                    </div>
                  </div>

                  {partner && (
                    <div className={`rounded-2xl p-5 ${isPositive(partnerNet)
                      ? 'bg-gradient-to-br from-sky-500 to-blue-500'
                      : 'bg-gradient-to-br from-orange-500 to-red-500'} text-white`}>
                      <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">👤 {partner.display_name}</p>
                      <p className="text-white/80 text-sm">Monthly surplus / deficit</p>
                      <p className="text-3xl font-bold mt-1">{isPositive(partnerNet) ? '+' : '-'}${fmt(Math.abs(partnerNet))}</p>
                      <div className="mt-3 space-y-1 text-xs text-white/70">
                        <p>Income: ${fmt(partnerTotalIncome)}</p>
                        <p>Personal exp: ${fmt(partnerTotalExp)}</p>
                        <p>Share of bills: ${fmt(myShareOfBills)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Spending Breakdown Chart ── */}
                {chartData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-gray-800">My Spending Breakdown</p>
                        <p className="text-xs text-gray-400 mt-0.5">{monthName} · ${fmt(totalSpend)} total</p>
                      </div>
                      {/* Chart type toggle */}
                      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        {[
                          { key: 'donut', label: '◎' },
                          { key: 'pie',   label: '●' },
                          { key: 'bar',   label: '▦' },
                        ].map(({ key, label }) => (
                          <button key={key} onClick={() => setChartView(key)}
                            className={`w-8 h-7 text-sm rounded-lg transition font-medium ${chartView === key ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pie / Donut */}
                    {(chartView === 'donut' || chartView === 'pie') && (
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full max-w-[200px]">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                innerRadius={chartView === 'donut' ? 55 : 0}
                                outerRadius={90}
                                paddingAngle={chartView === 'donut' ? 3 : 1}
                              >
                                {chartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-2 w-full">
                          {chartData.map((entry) => (
                            <div key={entry.category} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                                <span className="text-sm text-gray-600 truncate">{entry.category}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span className="text-xs text-gray-400">{entry.pct}%</span>
                                <span className="text-sm font-semibold text-gray-800">${fmt(entry.value)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bar chart */}
                    {chartView === 'bar' && (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                            tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                          <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f5ff' }} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* Shared bills */}
                {totalShared > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-1">🏠 Shared Bills — {monthName}</p>
                    <p className="text-2xl font-bold text-gray-800">${fmt(totalShared)}<span className="text-sm text-gray-400 font-normal">/mo total</span></p>
                    <p className="text-xs text-gray-400 mt-1">Each partner contributes ${fmt(myShareOfBills)}/mo</p>
                  </div>
                )}

                {/* Savings goals */}
                {savingsGoals.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-semibold text-gray-800">🎯 Savings Goals</p>
                      <Link to="/savings" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Manage →</Link>
                    </div>
                    <div className="space-y-3">
                      {savingsGoals.map(goal => {
                        const pct = Math.min((parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100, 100)
                        return (
                          <div key={goal.id}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-700 font-medium">{goal.name}</span>
                              <span className="text-gray-400">${fmt(goal.current_amount)} / ${fmt(goal.target_amount)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { to: '/income', label: 'Income', icon: '💵', desc: `${myIncome.length} source${myIncome.length !== 1 ? 's' : ''} this month` },
                    { to: '/expenses', label: 'My Expenses', icon: '🧾', desc: `${myExpenses.length} expense${myExpenses.length !== 1 ? 's' : ''} this month` },
                    { to: '/shared', label: 'Shared Bills', icon: '🏠', desc: `${sharedBills.length} bill${sharedBills.length !== 1 ? 's' : ''} this month` },
                    { to: '/budget', label: 'Budget Limits', icon: '📊', desc: budgetWarnings.length > 0 ? `${budgetWarnings.length} warning${budgetWarnings.length > 1 ? 's' : ''}` : `${budgetLimits.length} limit${budgetLimits.length !== 1 ? 's' : ''}` },
                  ].map(({ to, label, icon, desc }) => (
                    <Link key={to} to={to}
                      className="bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 p-4 flex items-center gap-3 transition group">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
