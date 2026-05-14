import { useLoginPasskey, useRegisterPasskey } from '@zerodev/wallet-react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAccount } from 'wagmi'

export function PasskeyAuth() {
  const { isConnected } = useAccount()

  const {
    mutate: register,
    isPending: isRegistering,
    error: registerError,
  } = useRegisterPasskey()

  const {
    mutate: login,
    isPending: isLoggingIn,
    error: loginError,
  } = useLoginPasskey()

  if (isConnected) return null

  const isPending = isRegistering || isLoggingIn
  const error = registerError || loginError

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Passkey</Text>
      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
        onPress={() => register()}
        disabled={isPending}
      >
        {isRegistering ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register with Passkey</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.buttonOutline, isPending && styles.buttonDisabled]}
        onPress={() => login()}
        disabled={isPending}
      >
        {isLoggingIn ? (
          <ActivityIndicator color="#6366f1" />
        ) : (
          <Text style={styles.buttonOutlineText}>Login with Passkey</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error.message}</Text>}
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
  button: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#6366f1',
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
  buttonOutlineText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
})
