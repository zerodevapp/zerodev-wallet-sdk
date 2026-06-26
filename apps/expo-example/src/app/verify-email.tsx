import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useSendMagicLink,
  useSendOTP,
  useVerifyMagicLink,
  useVerifyOTP,
} from '@zerodev/wallet-react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  clearPendingOtpMutationOptions,
  pendingOtpQueryOptions,
  setPendingOtpMutationOptions,
} from '@/lib/otpStorage'

export default function VerifyEmail() {
  const router = useRouter()
  const { code: codeFromUrl } = useLocalSearchParams<{ code?: string }>()

  const [codeInput, setCodeInput] = useState('')

  const queryClient = useQueryClient()
  const invalidatePending = () =>
    queryClient.invalidateQueries({ queryKey: pendingOtpQueryOptions.queryKey })

  const { data: pending, isPending: isHydrating } = useQuery(
    pendingOtpQueryOptions,
  )

  const { mutate: setPending } = useMutation({
    ...setPendingOtpMutationOptions,
    onSuccess: invalidatePending,
  })

  const { mutate: clearPending } = useMutation({
    ...clearPendingOtpMutationOptions,
    onSuccess: invalidatePending,
  })

  const verifyMutationOptions = {
    mutation: { onSuccess: () => clearPending() },
  } as const

  const {
    mutate: verifyOtp,
    isPending: isVerifyingOtp,
    error: verifyOtpError,
  } = useVerifyOTP(verifyMutationOptions)

  const {
    mutate: verifyMagicLink,
    isPending: isVerifyingMagic,
    error: verifyMagicError,
  } = useVerifyMagicLink(verifyMutationOptions)

  const {
    mutate: sendOtp,
    isPending: isResendingOtp,
    error: resendOtpError,
  } = useSendOTP({
    mutation: {
      onSuccess(data, variables) {
        setPending({
          otpId: data.otpId,
          otpEncryptionTargetBundle: data.otpEncryptionTargetBundle,
          email: variables.email,
          method: 'otp',
        })
      },
    },
  })

  const {
    mutate: sendMagicLink,
    isPending: isResendingMagic,
    error: resendMagicError,
  } = useSendMagicLink({
    mutation: {
      onSuccess(data, variables) {
        setPending({
          otpId: data.otpId,
          otpEncryptionTargetBundle: data.otpEncryptionTargetBundle,
          email: variables.email,
          method: 'magicLink',
        })
      },
    },
  })

  const isVerifying = isVerifyingOtp || isVerifyingMagic
  const isResending = isResendingOtp || isResendingMagic
  const verifyError = verifyOtpError ?? verifyMagicError
  const resendError = resendOtpError ?? resendMagicError

  const handleVerify = useCallback(
    (code: string) => {
      if (!pending || !code) return
      if (pending.method === 'magicLink') {
        verifyMagicLink({
          otpId: pending.otpId,
          otpEncryptionTargetBundle: pending.otpEncryptionTargetBundle,
          code,
        })
      } else {
        verifyOtp({
          otpId: pending.otpId,
          otpEncryptionTargetBundle: pending.otpEncryptionTargetBundle,
          code,
        })
      }
    },
    [pending, verifyMagicLink, verifyOtp],
  )

  const handleResend = () => {
    if (!pending) return
    if (pending.method === 'magicLink') {
      sendMagicLink({
        email: pending.email,
      })
    } else {
      sendOtp({ email: pending.email })
    }
  }

  const handleBack = () => {
    clearPending()
    router.replace('/login')
  }

  // When a code arrives via deep link, pre-fill the input and auto-submit
  // through the same render path the user would see when typing manually.
  // Ref-guard so it fires exactly once per code value across re-renders
  // (including React Strict Mode's dev-only effect double-invoke).
  const autoSubmittedFor = useRef<string | null>(null)
  useEffect(() => {
    if (isHydrating || !pending || !codeFromUrl) return
    if (autoSubmittedFor.current === codeFromUrl) return
    autoSubmittedFor.current = codeFromUrl
    setCodeInput(codeFromUrl)
    handleVerify(codeFromUrl)
  }, [codeFromUrl, pending, isHydrating, handleVerify])

  if (isHydrating) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  if (!pending) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No verification in progress</Text>
        <Text style={styles.subtitle}>
          We don't have a pending sign-in on this device. Start over from the
          sign-in screen.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleBack}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter verification code</Text>
      <Text style={styles.subtitle}>
        {pending.method === 'magicLink'
          ? `Tap the link we sent to ${pending.email}, or enter the code below.`
          : `We sent a code to ${pending.email}.`}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter code"
        value={codeInput}
        onChangeText={setCodeInput}
        keyboardType="number-pad"
        autoFocus
        editable={!isVerifying}
      />
      <TouchableOpacity
        style={[
          styles.button,
          (!codeInput || isVerifying) && styles.buttonDisabled,
        ]}
        onPress={() => handleVerify(codeInput.trim())}
        disabled={isVerifying || !codeInput}
      >
        {isVerifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleResend} disabled={isResending}>
        <Text style={styles.link}>
          {isResending
            ? 'Resending…'
            : pending.method === 'magicLink'
              ? 'Resend magic link'
              : 'Resend code'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleBack}>
        <Text style={styles.link}>Use a different email</Text>
      </TouchableOpacity>
      {verifyError && <Text style={styles.error}>{verifyError.message}</Text>}
      {resendError && <Text style={styles.error}>{resendError.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    color: '#6366f1',
    fontSize: 14,
    textAlign: 'center',
  },
})
