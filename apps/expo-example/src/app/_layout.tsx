import 'react-native-get-random-values'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SplashScreen, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useAccount, useReconnect, WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/wagmi/config'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    // `reconnectOnMount={false}` because wagmi's built-in reconnect runs
    // synchronously inside `<Hydrate>`'s render and mutates the store,
    // which surfaces as "Cannot update a component while rendering a
    // different component" warnings whenever this provider re-renders
    // (e.g. on expo-router navigation transitions). We trigger reconnect
    // ourselves from a mount effect below, after commit.
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <App />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

function App() {
  const { address } = useAccount()
  const { reconnect, isSuccess, isError } = useReconnect()

  // Manual replacement for `reconnectOnMount` (see WagmiProvider above).
  useEffect(() => {
    reconnect()
  }, [reconnect])

  // Gate the UI on the reconnect mutation settling rather than on
  // `useConnection().status`. With `reconnectOnMount={false}` the store
  // initially reports `disconnected`, which would otherwise flash the
  // login screen for a moment before the saved session is restored.
  const isReady = isSuccess || isError

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync()
  }, [isReady])

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#E6F4FE',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={address !== undefined}>
        <Stack.Screen name="index" />
        <Stack.Screen name="export" />
      </Stack.Protected>
      <Stack.Protected guard={address === undefined}>
        <Stack.Screen name="login" />
        <Stack.Screen name="oauth-callback" options={{ animation: 'none' }} />
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
    </Stack>
  )
}
