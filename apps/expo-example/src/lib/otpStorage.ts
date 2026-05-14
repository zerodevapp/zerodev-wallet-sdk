import AsyncStorage from '@react-native-async-storage/async-storage'
import { mutationOptions, queryOptions } from '@tanstack/react-query'

const PENDING_OTP_KEY = 'auth.otp'

export type PendingOtpMethod = 'otp' | 'magicLink'

export type PendingOtp = {
  otpId: string
  otpEncryptionTargetBundle: string
  email: string
  method: PendingOtpMethod
}

function isPendingOtp(value: unknown): value is PendingOtp {
  if (typeof value !== 'object' || value === null) return false
  const v = value as PendingOtp
  return (
    typeof v.otpId === 'string' &&
    typeof v.otpEncryptionTargetBundle === 'string' &&
    typeof v.email === 'string' &&
    (v.method === 'otp' || v.method === 'magicLink')
  )
}

export async function getPendingOtp(): Promise<PendingOtp | null> {
  const raw = await AsyncStorage.getItem(PENDING_OTP_KEY)
  if (!raw) return null

  const parsed = JSON.parse(raw)
  if (!isPendingOtp(parsed)) {
    await AsyncStorage.removeItem(PENDING_OTP_KEY)
    return null
  }
  return parsed
}

export const pendingOtpQueryOptions = queryOptions({
  queryKey: [PENDING_OTP_KEY],
  queryFn: getPendingOtp,
})

export const setPendingOtpMutationOptions = mutationOptions({
  mutationKey: [PENDING_OTP_KEY, 'set'],
  mutationFn: async (pending: PendingOtp) => {
    await AsyncStorage.setItem(PENDING_OTP_KEY, JSON.stringify(pending))
    return pending
  },
})

export const clearPendingOtpMutationOptions = mutationOptions({
  mutationKey: [PENDING_OTP_KEY, 'clear'],
  mutationFn: async () => {
    await AsyncStorage.removeItem(PENDING_OTP_KEY)
  },
})
