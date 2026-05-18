import { Stack } from 'expo-router'
import { createContext, useContext, useState } from 'react'
import { useAppChangeListener } from '@/hooks/useAppChangeListener'

type ExportConsentValue = {
  consented: boolean
  setConsented: (v: boolean) => void
}

const ExportConsentContext = createContext<ExportConsentValue | null>(null)

export function useExportConsent() {
  const ctx = useContext(ExportConsentContext)
  if (!ctx) {
    throw new Error('useExportConsent must be used inside the /export layout')
  }
  return ctx
}

/**
 * Layout for the /export route group. Holds the consent flag the user must
 * tick on the index screen before the wallet/private-key reveal screens
 * will render. Two ways consent resets:
 *   1. The user leaves /export entirely (back to /) — the layout unmounts.
 *   2. The app backgrounds — `useAppChangeListener` fires the handler below.
 *      Combined with the consent guard in wallet.tsx / private-key.tsx,
 *      this guarantees that returning from background to a reveal route
 *      redirects to the consent screen with the box unchecked.
 */
export default function ExportLayout() {
  const [consented, setConsented] = useState(false)

  useAppChangeListener((next) => {
    if (next === 'background') setConsented(false)
  })

  return (
    <ExportConsentContext.Provider value={{ consented, setConsented }}>
      <Stack screenOptions={{ headerShown: false }} />
    </ExportConsentContext.Provider>
  )
}
