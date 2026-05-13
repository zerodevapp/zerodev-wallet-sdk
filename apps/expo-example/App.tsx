import 'react-native-get-random-values'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useAccount, WagmiProvider } from 'wagmi'
import { ChainSwitcher } from './components/ChainSwitcher'
import { ConnectionStatusBar } from './components/ConnectionStatusBar'
import { OTPAuth } from './components/OTPAuth'
import { SendTransaction } from './components/SendTransaction'
import { wagmiConfig } from './wagmi.config'

const queryClient = new QueryClient()

function Content() {
  const { status } = useAccount()

  return (
    <View style={styles.container}>
      <ConnectionStatusBar />
      <ChainSwitcher />
      <ScrollView contentContainerStyle={styles.content}>
        <OTPAuth />
        {status === 'connected' && <SendTransaction />}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  )
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Content />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    flexGrow: 1,
  },
})
