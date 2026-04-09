import {
  useSendOTP as useAPISendOTP,
  useVerifyOTP as useAPIVerifyOTP,
} from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useAuthStore } from '../AuthProvider'

export function useAuth() {
  const store = useAuthStore()

  const step = useStore(store, (state) => state.authStep)
  const email = useStore(store, (state) => state.authEmail)
  const error = useStore(store, (state) => state.authError)
  const pendingMethod = useStore(store, (state) => state.authPendingMethod)
  const availableMethods = useStore(
    store,
    (state) => state.authAvailableMethods,
  )
  const resendAvailableAt = useStore(
    store,
    (state) => state.authResendAvailableAt,
  )
  const otpId = useStore(store, (state) => state.authOtpId)
  const config = useStore(store, (state) => state.authConfig)

  const { mutateAsync: sendOtp } = useAPISendOTP()
  const { mutateAsync: verifyOtp } = useAPIVerifyOTP()

  const submitEmail = async (emailValue: string) => {
    store.getState().submitAuthEmail(emailValue)
    try {
      const { otpId: newOtpId } = await sendOtp({ email: emailValue })
      store.getState().setAuthOtpId(newOtpId)
      store.getState().setAuthResendAvailableAt(Date.now() + 60000) // 60s cooldown
    } catch (err) {
      store.getState().setAuthError({
        message: err instanceof Error ? err.message : 'Failed to send OTP',
        recoverable: true,
      })
      store.getState().setAuthStep('error')
    }
  }

  const submitOtp = async (code: string) => {
    store.getState().submitAuthOtp(code)
    try {
      await verifyOtp({ otpId: otpId!, code })
      store.getState().setAuthStep('authenticated')
      config?.onSuccess?.()
    } catch (err) {
      store.getState().setAuthError({
        message: err instanceof Error ? err.message : 'Invalid OTP code',
        recoverable: true,
      })
      store.getState().setAuthStep('error')
      config?.onError?.(err)
    }
  }

  const resendOtp = async () => {
    if (!email) return

    try {
      const { otpId: newOtpId } = await sendOtp({ email })
      store.getState().setAuthOtpId(newOtpId)
      store.getState().setAuthResendAvailableAt(Date.now() + 60000) // 60s cooldown
    } catch (err) {
      store.getState().setAuthError({
        message: err instanceof Error ? err.message : 'Failed to resend OTP',
        recoverable: true,
      })
    }
  }

  // Derived: resend countdown
  const [secondsUntilResend, setSecondsUntilResend] = useState(0)
  useEffect(() => {
    if (!resendAvailableAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000),
      )
      setSecondsUntilResend(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [resendAvailableAt])

  return {
    step,
    email,
    error,
    isLoading: pendingMethod !== null,
    pendingMethod,
    availableMethods,
    canResend: secondsUntilResend <= 0,
    secondsUntilResend,
    submitEmail,
    submitOtp,
    resendOtp,
    selectMethod: store.getState().selectAuthMethod,
    showAllMethods: store.getState().showAllAuthMethods,
    switchToOtpInput: store.getState().switchToOtpInput,
    goBack: store.getState().goBackAuth,
    reset: store.getState().resetAuth,
    initialize: store.getState().initializeAuth,
  }
}
