import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'

export function useAuth() {
  const store = useKitStore()

  const step = useStore(store, (state) => state.auth.step)
  const stepHistory = useStore(store, (state) => state.auth.stepHistory)
  const email = useStore(store, (state) => state.auth.email)
  const otpId = useStore(store, (state) => state.auth.otpId)
  const otpEncryptionTargetBundle = useStore(
    store,
    (state) => state.auth.otpEncryptionTargetBundle,
  )
  const enabledMethods = useStore(store, (state) => state.auth.enabledMethods)
  const authConfig = useStore(store, (state) => state.auth.config)

  return {
    step,
    email,
    otpId,
    otpEncryptionTargetBundle,
    enabledMethods,
    config: authConfig,
    goToStep: store.getState().auth.goToStep,
    goBack: stepHistory.length > 0 ? store.getState().auth.goBack : null,
    reset: store.getState().auth.reset,
    setEmail: store.getState().auth.setEmail,
    setOtpSession: store.getState().auth.setOtpSession,
    clearOtpSession: store.getState().auth.clearOtpSession,
  }
}
