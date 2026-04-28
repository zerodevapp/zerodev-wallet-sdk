import { zeroDevWallet } from '@zerodev/wallet-react'
import { createConfig, createStorage, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'
import { asyncSessionStorage } from '@/lib/asyncSessionStorage'
import { createReactNativePasskeyStamper } from '@/lib/reactNativePasskeyStamper'
import { createSecureStoreStamper } from '@/lib/secureStoreStamper'

const ZERODEV_PROJECT_ID = process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID ?? ''
// RP_ID needs to be the same as Origin
// RP_ID needs to match the domain that hosts /.well-known/assetlinks.json
// (shared across contributors; see README "Running with Passkeys on Android").
const RP_ID = 'zerodev-expo-example.vercel.app'
const chains = [sepolia, arbitrumSepolia] as const

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    zeroDevWallet({
      projectId: ZERODEV_PROJECT_ID,
      chains,
      rpId: RP_ID,
      fetchOptions: {
        headers: { Origin: `https://${RP_ID}` },
      },
      apiKeyStamper: createSecureStoreStamper(),
      passkeyStamper: createReactNativePasskeyStamper({
        rpId: RP_ID,
      }),
      sessionStorage: asyncSessionStorage,
      persistStorage: asyncSessionStorage,
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  storage: createStorage({ storage: asyncSessionStorage }),
  multiInjectedProviderDiscovery: false,
})
