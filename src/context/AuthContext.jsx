import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I)
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [household, setHousehold] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchHousehold(session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchHousehold(session.user.id)
      else { setHousehold(null); setDisplayName(''); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchHousehold = async (userId) => {
    // Use maybeSingle to avoid errors — a user should only be in one household
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
    }
    setLoading(false)
  }

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // Create a new household with a unique invite code
    let inviteCode = generateInviteCode()
    // Retry on collision (extremely unlikely but safe)
    for (let i = 0; i < 5; i++) {
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .insert({ invite_code: inviteCode })
        .select()
        .single()

      if (!hhErr && hh) {
        await supabase.from('household_members').insert({
          household_id: hh.id,
          user_id: data.user.id,
          display_name: name,
        })
        break
      }
      inviteCode = generateInviteCode()
    }

    return { data }
  }

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const joinHousehold = async (inviteCode, name) => {
    // Look up household by invite code (case-insensitive)
    const { data: hhData, error: hhError } = await supabase
      .from('households')
      .select('id, invite_code')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .maybeSingle()

    if (hhError || !hhData) {
      return { error: { message: 'Invalid invite code. Check with your partner and try again.' } }
    }

    // Prevent joining your own household
    if (household?.id === hhData.id) {
      return { error: { message: 'You\'re already in this household!' } }
    }

    // CRITICAL FIX: Remove from ALL existing households first
    // This prevents the double-household bug that breaks .single() queries
    await supabase
      .from('household_members')
      .delete()
      .eq('user_id', user.id)

    // Join the new household
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
      signUp, signIn, signOut, joinHousehold, fetchHousehold
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
