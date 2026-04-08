import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SetupPage() {
  const { household, joinHousehold } = useAuth()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(household?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const join = async () => {
    if (!joinCode.trim()) return setError('Please enter an invite code')
    if (!partnerName.trim()) return setError('Please enter your name')
    setLoading(true)
    const { error } = await joinHousehold(joinCode.trim(), partnerName.trim())
    if (error) setError(error.message)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🏠</div>
          <h1 className="text-xl font-bold text-gray-800">Set Up Your Household</h1>
          <p className="text-gray-500 text-sm mt-1">Link yourself with your partner</p>
        </div>

        {/* Share your code */}
        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-indigo-700 mb-1">Your Invite Code</p>
          <p className="text-xs text-gray-500 mb-3">Share this with your partner so they can join your household</p>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex gap-1.5">
              {(household?.invite_code || '······').split('').map((char, i) => (
                <span key={i} className="w-8 h-9 bg-white border border-indigo-200 rounded-lg flex items-center justify-center text-base font-bold text-indigo-700 font-mono">
                  {char}
                </span>
              ))}
            </div>
            <button onClick={copyCode}
              className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700 transition font-medium">
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="relative flex items-center mb-6">
          <div className="flex-grow border-t border-gray-200" />
          <span className="mx-3 text-sm text-gray-400">or join your partner's household</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        <div className="space-y-3">
          <input
            placeholder="Your first name"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <input
            placeholder="Partner's invite code (e.g. ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button onClick={join} disabled={loading}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
          {loading ? 'Joining...' : 'Join Household'}
        </button>

        <button onClick={() => navigate('/dashboard')}
          className="w-full mt-2 text-gray-400 text-sm py-2 hover:text-gray-600 transition">
          Continue solo for now →
        </button>
      </div>
    </div>
  )
}
