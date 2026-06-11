import { createReactNativePasskeyStamper } from '@zerodev/wallet-core/react-native/stampers/passkey'
import { createSecureStoreStamper } from '@zerodev/wallet-core/react-native/stampers/secure-store'
import { asyncStorageAdapter } from '@zerodev/wallet-core/react-native/storage/async-storage'
import { zeroDevWallet } from '@zerodev/wallet-react'
import { createConfig, createStorage, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'
import { RP_ID } from '@/config/auth'

const ZERODEV_PROJECT_ID = process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID ?? ''
const chains = [sepolia, arbitrumSepolia] as const

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    zeroDevWallet({
      projectId: ZERODEV_PROJECT_ID,
      chains,
      rpId: RP_ID,
      apiKeyStamper: createSecureStoreStamper(),
      // Optional: omit passkeyStamper if your app doesn't use passkey auth.
      passkeyStamper: createReactNativePasskeyStamper({ rpId: RP_ID }),
      sessionStorage: asyncStorageAdapter,
      persistStorage: asyncStorageAdapter,
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  storage: createStorage({ storage: asyncStorageAdapter }),
  multiInjectedProviderDiscovery: false,
})
