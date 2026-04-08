import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import AuthPage from './pages/AuthPage'
import SetupPage from './pages/SetupPage'
import Dashboard from './pages/Dashboard'
import IncomePage from './pages/IncomePage'
import ExpensesPage from './pages/ExpensesPage'
import SharedBillsPage from './pages/SharedBillsPage'
import SavingsPage from './pages/SavingsPage'
import BudgetLimitsPage from './pages/BudgetLimitsPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-indigo-500 text-lg animate-pulse">Loading...</div>
    </div>
  )
  return user ? children : <Navigate to="/" />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
      <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/income" element={<ProtectedRoute><IncomePage /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
      <Route path="/shared" element={<ProtectedRoute><SharedBillsPage /></ProtectedRoute>} />
      <Route path="/savings" element={<ProtectedRoute><SavingsPage /></ProtectedRoute>} />
      <Route path="/budget" element={<ProtectedRoute><BudgetLimitsPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
