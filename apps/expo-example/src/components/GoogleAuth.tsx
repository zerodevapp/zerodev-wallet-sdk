import { OAUTH_PROVIDERS } from '@zerodev/wallet-react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAccount } from 'wagmi'
import { useAuthenticateOAuth } from '@/hooks/useAuthenticateOAuth'
import { RedirectUriDebug } from './RedirectUriDebug'

export function GoogleAuth() {
  const { isConnected } = useAccount()

  const { mutate: authenticate, isPending, error } = useAuthenticateOAuth()

  if (isConnected) return null

  const handleGoogleSignIn = () => {
    authenticate({ provider: OAUTH_PROVIDERS.GOOGLE })
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Google</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error.message}</Text>}
      <RedirectUriDebug />
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
  button: {
    backgroundColor: '#4285F4',
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
})
