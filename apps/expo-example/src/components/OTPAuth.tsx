import { useSendOTP, useVerifyOTP } from '@zerodev/wallet-react'
import { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAccount } from 'wagmi'

export function OTPAuth() {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpId, setOtpId] = useState<string | null>(null)
  const [otpEncryptionTargetBundle, setOtpEncryptionTargetBundle] =
    useState<string>('')

  const { isConnected } = useAccount()

  const {
    mutate: sendOTP,
    isPending: isSending,
    error: sendError,
  } = useSendOTP({
    mutation: {
      onSuccess(data) {
        setOtpId(data.otpId)
        setOtpEncryptionTargetBundle(data.otpEncryptionTargetBundle)
      },
    },
  })

  const {
    mutate: verifyOTP,
    isPending: isVerifying,
    error: verifyError,
  } = useVerifyOTP()

  const reset = () => {
    setOtpId(null)
    setOtpCode('')
    setEmail('')
  }

  if (isConnected) return null

  if (!otpId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sign in with OTP</Text>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[
            styles.button,
            (!email || isSending) && styles.buttonDisabled,
          ]}
          onPress={() => sendOTP({ email })}
          disabled={isSending || !email}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>
        {sendError && <Text style={styles.error}>{sendError.message}</Text>}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter verification code</Text>
      <Text style={styles.subtitle}>Sent to {email}</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter OTP code"
        value={otpCode}
        onChangeText={setOtpCode}
        keyboardType="number-pad"
        autoFocus
      />
      <TouchableOpacity
        style={[
          styles.button,
          (!otpCode || isVerifying) && styles.buttonDisabled,
        ]}
        onPress={() =>
          verifyOTP({ code: otpCode, otpId, otpEncryptionTargetBundle })
        }
        disabled={isVerifying || !otpCode}
      >
        {isVerifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={reset}>
        <Text style={styles.link}>Use a different email</Text>
      </TouchableOpacity>
      {verifyError && <Text style={styles.error}>{verifyError.message}</Text>}
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
  disconnectButton: {
    backgroundColor: '#ef4444',
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
  address: {
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    color: '#666',
  },
})
