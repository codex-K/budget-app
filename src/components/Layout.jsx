import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

const nav = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/income', icon: '💵', label: 'Income' },
  { to: '/expenses', icon: '🧾', label: 'My Expenses' },
  { to: '/shared', icon: '🏠', label: 'Shared Bills' },
  { to: '/budget', icon: '📈', label: 'Budget Limits' },
  { to: '/savings', icon: '🎯', label: 'Savings' },
  { to: '/history', icon: '📅', label: 'History' },
]

// Defined OUTSIDE Layout to prevent recreation on every render (bug fix)
function SidebarContent({ onClose }) {
  const { displayName, signOut } = useAuth()
  const { appName } = useSettings()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <>
      <div className="p-5 border-b border-gray-100">
        <div className="text-xl font-bold text-indigo-600">💰 {appName}</div>
        <div className="text-xs text-gray-400 mt-1">Hey, {displayName || 'there'}!</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`
            }>
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100 space-y-1">
        <NavLink to="/settings" onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`
          }>
          <span>⚙️</span>
          <span>Settings</span>
        </NavLink>
        <button onClick={handleSignOut}
          className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition">
          <span>🚪</span>
          <span>Sign out</span>
        </button>
      </div>
    </>
  )
}

export default function Layout({ children }) {
  const { household, loading, householdError, fetchHousehold, user } = useAuth()
  const [open, setOpen] = useState(false)
  const closeSidebar = () => setOpen(false)

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Household error banner */}
      {!loading && householdError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center gap-3 text-sm text-red-700">
          <span>⚠️ {householdError}</span>
          <button
            onClick={() => fetchHousehold(user?.id)}
            className="underline font-medium hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-100 flex-col fixed h-full z-10">
        <SidebarContent onClose={closeSidebar} />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-20" onClick={closeSidebar} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white z-30 flex flex-col shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent onClose={closeSidebar} />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-40 bg-white rounded-xl p-2.5 shadow-md border border-gray-100"
        aria-label="Open menu">
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className={`block h-0.5 bg-gray-600 rounded transition-all duration-300 ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block h-0.5 bg-gray-600 rounded transition-all duration-300 ${open ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 bg-gray-600 rounded transition-all duration-300 ${open ? '-rotate-45 -translate-y-2.5' : ''}`} />
        </div>
      </button>

      {/* Main content */}
      <main className={`lg:ml-56 flex-1 p-4 pt-16 lg:pt-8 lg:p-8 min-w-0 ${!loading && householdError ? 'mt-10' : ''}`}>
        {children}
      </main>

    </div>
  )
}
