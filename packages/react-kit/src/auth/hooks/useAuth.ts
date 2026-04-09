import {
  useSendOTP as useAPISendOTP,
  useVerifyOTP as useAPIVerifyOTP,
} from '@zerodev/wallet-react'
import { useCallback, useEffect, useState } from 'react'
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
  const error = useStore(store, (state) => state.auth.error)
  const pendingMethod = useStore(store, (state) => state.auth.pendingMethod)
  const availableMethods = useStore(
    store,
    (state) => state.auth.availableMethods,
  )
  const resendAvailableAt = useStore(
    store,
    (state) => state.auth.resendAvailableAt,
  )
  const otpId = useStore(store, (state) => state.auth.otpId)
  const authConfig = useStore(store, (state) => state.auth.config)

  const { mutateAsync: sendOtp } = useAPISendOTP()
  const { mutateAsync: verifyOtp } = useAPIVerifyOTP()

  const submitEmail = async (emailValue: string) => {
    store.getState().auth.submitEmail(emailValue)
    try {
      const { otpId: newOtpId } = await sendOtp({ email: emailValue })
      store.getState().auth.setOtpId(newOtpId)
      store.getState().auth.setResendAvailableAt(Date.now() + 60000) // 60s cooldown
    } catch (err) {
      store.getState().auth.setError({
        message: err instanceof Error ? err.message : 'Failed to send OTP',
        recoverable: true,
      })
      store.getState().auth.setStep('error')
    }
  }

  const submitOtp = async (code: string) => {
    store.getState().auth.submitOtp()
    try {
      await verifyOtp({ otpId: otpId!, code })
      store.getState().auth.setStep('authenticated')
      authConfig?.onSuccess?.()
    } catch (err) {
      store.getState().auth.setError({
        message: err instanceof Error ? err.message : 'Invalid OTP code',
        recoverable: true,
      })
      store.getState().auth.setStep('error')
      authConfig?.onError?.(err)
    }
  }

  const resendOtp = async () => {
    if (!email) return

    try {
      const { otpId: newOtpId } = await sendOtp({ email })
      store.getState().auth.setOtpId(newOtpId)
      store.getState().auth.setResendAvailableAt(Date.now() + 60000) // 60s cooldown
    } catch (err) {
      store.getState().auth.setError({
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
    selectMethod: useCallback(
      (
        method: Parameters<
          ReturnType<typeof store.getState>['auth']['selectMethod']
        >[0],
      ) => {
        store.getState().auth.selectMethod(method)
      },
      [store],
    ),
    showAllMethods: useCallback(() => {
      store.getState().auth.showAllMethods()
    }, [store]),
    switchToOtpInput: useCallback(() => {
      store.getState().auth.switchToOtpInput()
    }, [store]),
    goBack: useCallback(() => {
      store.getState().auth.goBack()
    }, [store]),
    reset: useCallback(() => {
      store.getState().auth.reset()
    }, [store]),
  }
}
