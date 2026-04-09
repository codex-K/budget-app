import { createContext, useContext, useState } from 'react'

const SettingsContext = createContext({})

export const SettingsProvider = ({ children }) => {
  const [appName, setAppNameState] = useState(
    () => localStorage.getItem('app_name') || 'OurBudget'
  )
  const [savingsMode, setSavingsModeState] = useState(
    () => localStorage.getItem('savings_mode') || 'partial'
  )

  const setAppName = (name) => {
    const trimmed = name.trim() || 'OurBudget'
    localStorage.setItem('app_name', trimmed)
    setAppNameState(trimmed)
  }

  const setSavingsMode = (mode) => {
    localStorage.setItem('savings_mode', mode)
    setSavingsModeState(mode)
  }

  return (
    <SettingsContext.Provider value={{ appName, setAppName, savingsMode, setSavingsMode }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
