import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const SAVINGS_MODES = [
  {
    key: 'off',
    label: 'Off',
    desc: 'Surplus shown as-is. Savings commitments not mentioned.',
  },
  {
    key: 'partial',
    label: 'Partial',
    desc: 'Surplus shown normally, with a small note showing the savings-adjusted figure alongside.',
  },
  {
    key: 'on',
    label: 'On',
    desc: 'Savings-adjusted surplus shown as the primary figure. Original surplus shown in smaller text.',
  },
]

export default function SettingsPage() {
  const { user, household, displayName, joinHousehold } = useAuth()
  const { appName, setAppName, savingsMode, setSavingsMode } = useSettings()
  const { showToast } = useToast()

  const [partner, setPartner] = useState(null)
  const [partnerLoading, setPartnerLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinForm, setJoinForm] = useState({ inviteCode: '', name: '' })
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [appNameInput, setAppNameInput] = useState(appName)
  const [appNameSaved, setAppNameSaved] = useState(false)

  const fetchPartner = async () => {
    if (!household?.id) { setPartnerLoading(false); return }
    setPartnerLoading(true)
    const { data } = await supabase
      .from('household_members')
      .select('user_id, display_name')
      .eq('household_id', household.id)
      .neq('user_id', user.id)
    setPartner(data?.[0] || null)
    setPartnerLoading(false)
  }

  useEffect(() => { fetchPartner() }, [household, user])

  const copyInviteCode = () => {
    navigator.clipboard.writeText(household?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Invite code copied!')
  }

  const handleJoin = async () => {
    if (!joinForm.inviteCode.trim()) return setJoinError('Please enter an invite code')
    if (!joinForm.name.trim()) return setJoinError('Please enter your display name')
    setJoining(true)
    const { error } = await joinHousehold(joinForm.inviteCode, joinForm.name)
    if (error) {
      setJoinError(error.message)
    } else {
      setShowJoinModal(false)
      showToast('Successfully joined household!')
      fetchPartner()
    }
    setJoining(false)
  }

  const saveAppName = () => {
    setAppName(appNameInput)
    setAppNameSaved(true)
    setTimeout(() => setAppNameSaved(false), 2000)
    showToast('App name updated!')
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your account and preferences</p>
        </div>

        {/* Account */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium text-gray-800">{displayName || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-800">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Household */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Household</p>

          {household?.invite_code && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Your Invite Code</p>
              <p className="text-xs text-gray-400 mb-2">Share this 6-character code with your partner</p>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {household.invite_code.split('').map((char, i) => (
                    <span key={i} className="w-9 h-10 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-center text-lg font-bold text-indigo-700 font-mono">
                      {char}
                    </span>
                  ))}
                </div>
                <button onClick={copyInviteCode}
                  className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-xl hover:bg-indigo-700 transition font-medium">
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-gray-50">
            <div>
              <p className="text-sm text-gray-500">Partner</p>
              {partnerLoading ? (
                <p className="text-sm text-gray-400 mt-0.5 animate-pulse">Checking...</p>
              ) : partner ? (
                <p className="text-sm font-medium text-gray-800 mt-0.5">✅ {partner.display_name} is linked</p>
              ) : (
                <p className="text-sm text-amber-600 mt-0.5">⚠️ No partner linked yet</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* UX fix: manual refresh button so partner linking shows without full page reload */}
              <button onClick={fetchPartner}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium transition px-2 py-1.5 rounded-lg hover:bg-gray-50">
                ↻ Refresh
              </button>
              {!partner && (
                <button onClick={() => { setShowJoinModal(true); setJoinError('') }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
                  Join household →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard preferences */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Dashboard Preferences</p>

          {/* Savings mode */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Savings Goals Display</p>
            <p className="text-xs text-gray-400 mb-3">Controls how savings commitments appear on your surplus / deficit card</p>
            <div className="space-y-2">
              {SAVINGS_MODES.map(({ key, label, desc }) => (
                <button key={key} onClick={() => { setSavingsMode(key); showToast('Savings display updated!') }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${savingsMode === key
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${savingsMode === key ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`} />
                    <span className={`text-sm font-medium ${savingsMode === key ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</span>
                  </div>
                  <p className="text-xs text-gray-400 ml-5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customisation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Customisation</p>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">App Name</label>
            <p className="text-xs text-gray-400 mb-2">Shown in the sidebar and on the login page</p>
            <div className="flex gap-2">
              <input
                value={appNameInput}
                onChange={(e) => setAppNameInput(e.target.value)}
                placeholder="OurBudget"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button onClick={saveAppName}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition">
                {appNameSaved ? '✓' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Data & privacy */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Data & Privacy</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your data is stored securely in Supabase and is only accessible to you and your linked partner.
            Each person signs in with their own account. Your invite code is a short 6-character code — only share it with your partner.
          </p>
        </div>
      </div>

      {showJoinModal && (
        <Modal title="Join a Household" onClose={() => setShowJoinModal(false)}>
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
              ⚠️ This will link you to your partner's household. You'll leave your current one.
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Your Display Name</label>
              <input value={joinForm.name} onChange={e => setJoinForm({ ...joinForm, name: e.target.value })}
                placeholder="Your first name"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Partner's Invite Code</label>
              <input value={joinForm.inviteCode}
                onChange={e => setJoinForm({ ...joinForm, inviteCode: e.target.value.toUpperCase() })}
                placeholder="e.g. ABC123" maxLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <p className="text-xs text-gray-400 mt-1">6-character code from your partner's Settings page</p>
            </div>
            {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
            <button onClick={handleJoin} disabled={joining}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition disabled:opacity-50">
              {joining ? 'Joining...' : 'Join Household'}
            </button>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
