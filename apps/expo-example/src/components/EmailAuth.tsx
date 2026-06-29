import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSendMagicLink, useSendOTP } from '@zerodev/wallet-react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
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

export function EmailAuth() {
  const [emailInput, setEmailInput] = useState('')
  const router = useRouter()

  const queryClient = useQueryClient()
  const invalidatePending = () =>
    queryClient.invalidateQueries({ queryKey: pendingOtpQueryOptions.queryKey })

  const { data: pending, isPending: isHydrating } = useQuery(
    pendingOtpQueryOptions,
  )

  const { mutate: setPending } = useMutation({
    ...setPendingOtpMutationOptions,
    onSuccess: () => {
      invalidatePending()
      router.push('/verify-email')
    },
  })

  const { mutate: clearPending } = useMutation({
    ...clearPendingOtpMutationOptions,
    onSuccess: invalidatePending,
  })

  const {
    mutate: sendOtp,
    isPending: isSendingOtp,
    error: sendOtpError,
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
    isPending: isSendingMagicLink,
    error: sendMagicLinkError,
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

  const isSending = isSendingOtp || isSendingMagicLink
  const sendError = sendOtpError ?? sendMagicLinkError

  if (isHydrating) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#6366f1" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {pending && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Verification in progress</Text>
          <Text style={styles.bannerText}>
            We sent a {pending.method === 'magicLink' ? 'magic link' : 'code'}{' '}
            to {pending.email}.
          </Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={[styles.button, styles.bannerPrimary]}
              onPress={() => router.push('/verify-email')}
            >
              <Text style={styles.buttonText}>Resume verification</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => clearPending()}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.title}>Sign in with email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email address"
        value={emailInput}
        onChangeText={setEmailInput}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSending}
      />
      <TouchableOpacity
        style={[
          styles.button,
          (!emailInput || isSending) && styles.buttonDisabled,
        ]}
        onPress={() => sendOtp({ email: emailInput })}
        disabled={isSending || !emailInput}
      >
        {isSendingOtp ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send code</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          styles.secondary,
          (!emailInput || isSending) && styles.buttonDisabled,
        ]}
        onPress={() =>
          sendMagicLink({
            email: emailInput,
          })
        }
        disabled={isSending || !emailInput}
      >
        {isSendingMagicLink ? (
          <ActivityIndicator color="#6366f1" />
        ) : (
          <Text style={[styles.buttonText, styles.secondaryText]}>
            Send magic link
          </Text>
        )}
      </TouchableOpacity>
      {sendError && <Text style={styles.error}>{sendError.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  banner: {
    padding: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    gap: 8,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
  bannerText: {
    fontSize: 13,
    color: '#4338ca',
  },
  bannerActions: {
    gap: 8,
    marginTop: 4,
  },
  bannerPrimary: {
    backgroundColor: '#4338ca',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
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
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  secondaryText: {
    color: '#6366f1',
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
