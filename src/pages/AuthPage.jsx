import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const { appName } = useSettings()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const switchMode = (m) => { setMode(m); setError(''); setSuccess('') }

  const submit = async () => {
    setError(''); setSuccess('')
    setLoading(true)

    if (mode === 'reset') {
      if (!form.email) { setError('Please enter your email address'); setLoading(false); return }
      const { error } = await resetPassword(form.email)
      if (error) setError(error.message)
      else setSuccess('Password reset email sent! Check your inbox.')
      setLoading(false)
      return
    }

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message)
      else navigate('/dashboard')
    } else {
      if (!form.name.trim()) { setError('Please enter your name'); setLoading(false); return }
      if (!form.email) { setError('Please enter your email'); setLoading(false); return }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
      const { error } = await signUp(form.email, form.password, form.name.trim())
      if (error) setError(error.message)
      else navigate('/setup')
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') submit() }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-gray-800">{appName}</h1>
          <p className="text-gray-500 text-sm mt-1">Finance, together</p>
        </div>

        {mode !== 'reset' && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Reset Password</h2>
            <p className="text-sm text-gray-400">Enter your email and we'll send a reset link.</p>
          </div>
        )}

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {mode === 'signup' && (
            <input name="name" placeholder="Your first name" value={form.name} onChange={handle}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          )}
          <input name="email" type="email" placeholder="Email address" value={form.email} onChange={handle}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {mode !== 'reset' && (
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handle}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          )}
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        {success && <p className="text-emerald-600 text-sm mt-3">{success}</p>}

        <button onClick={submit} disabled={loading}
          className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
        </button>

        {mode === 'login' && (
          <button onClick={() => switchMode('reset')}
            className="w-full mt-2 text-sm text-gray-400 hover:text-indigo-500 transition py-2">
            Forgot your password?
          </button>
        )}

        {mode === 'reset' && (
          <button onClick={() => switchMode('login')}
            className="w-full mt-2 text-sm text-gray-400 hover:text-indigo-500 transition py-2">
            ← Back to login
          </button>
        )}
      </div>
    </div>
  )
}
