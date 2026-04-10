import { useConfig } from 'wagmi'
import { useStore } from 'zustand'
import type { createStore } from '../../store'

type Store = ReturnType<typeof createStore>

function getKitStore(config: ReturnType<typeof useConfig>): Store | null {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) return null
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}

export function useAuth() {
  const config = useConfig()
  const store = getKitStore(config)

  if (!store) {
    throw new Error('useAuth must be used with zeroDevKitWallet connector')
  }

  const step = useStore(store, (state) => state.auth.step)
  const email = useStore(store, (state) => state.auth.email)
  const otpId = useStore(store, (state) => state.auth.otpId)
  const enabledMethods = useStore(store, (state) => state.auth.enabledMethods)
  const authConfig = useStore(store, (state) => state.auth.config)

  return {
    step,
    email,
    otpId,
    enabledMethods,
    config: authConfig,
    goToStep: store.getState().auth.goToStep,
    goBack: store.getState().auth.goBack,
    reset: store.getState().auth.reset,
    setEmail: store.getState().auth.setEmail,
    setOtpId: store.getState().auth.setOtpId,
  }
}
