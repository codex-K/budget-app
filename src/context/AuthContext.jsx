import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const createHouseholdForUser = async (userId, displayName) => {
  let inviteCode = generateInviteCode()
  for (let i = 0; i < 5; i++) {
    const { data: hh, error: hhErr } = await supabase
      .from('households')
      .insert({ invite_code: inviteCode })
      .select()
      .single()
    if (!hhErr && hh) {
      await supabase.from('household_members').insert({
        household_id: hh.id,
        user_id: userId,
        display_name: displayName,
      })
      return hh
    }
    inviteCode = generateInviteCode()
  }
  return null
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [household, setHousehold] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingName, setPendingName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchHousehold(session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchHousehold(session.user.id)
      else { setHousehold(null); setDisplayName(''); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchHousehold = async (userId) => {
    const { data } = await supabase
      .from('household_members')
      .select('household_id, display_name, households(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setHousehold(data.households)
      setDisplayName(data.display_name)
    } else {
      // No household found — create one automatically.
      // This handles cases where email confirmation delayed household creation.
      const storedName = pendingName || localStorage.getItem('pending_display_name') || 'User'
      const hh = await createHouseholdForUser(userId, storedName)
      if (hh) {
        setHousehold(hh)
        setDisplayName(storedName)
        localStorage.removeItem('pending_display_name')
      }
    }
    setLoading(false)
  }

  const signUp = async (email, password, name) => {
    // Store name so fetchHousehold can use it after email confirmation if needed
    localStorage.setItem('pending_display_name', name)
    setPendingName(name)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // If we have an active session immediately (email confirmation disabled),
    // create the household now. Otherwise fetchHousehold will handle it on first login.
    if (data.session) {
      await createHouseholdForUser(data.user.id, name)
    }

    return { data }
  }

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

  const joinHousehold = async (inviteCode, name) => {
    const { data: hhData, error: hhError } = await supabase
      .from('households')
      .select('id, invite_code')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .maybeSingle()

    if (hhError || !hhData) {
      return { error: { message: 'Invalid invite code. Check with your partner and try again.' } }
    }

    if (household?.id === hhData.id) {
      return { error: { message: "You're already in this household!" } }
    }

    // Remove from all existing households first (prevents double-household bug)
    await supabase.from('household_members').delete().eq('user_id', user.id)

    const { error } = await supabase.from('household_members').insert({
      household_id: hhData.id,
      user_id: user.id,
      display_name: name || displayName,
    })

    if (!error) await fetchHousehold(user.id)
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, household, displayName, loading,
      signUp, signIn, signOut, resetPassword, joinHousehold, fetchHousehold,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
