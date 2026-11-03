'use client'

import { zeroDevWallet, zeroDevWalletConnect } from '@zerodev/wallet-react-ui'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'

// One config for both routes. The Solana door is enabled here because it is a
// config-level choice: an app turns it on once, and each sign-up composition
// then decides whether to offer Solana wallets. What the two routes differ in
// is how they READ and DRIVE the connection, which is the thing under test.
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
  chains: [arbitrumSepolia, sepolia],
  connectors: [
    zeroDevWallet({
      projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
      proxyBaseUrl: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL!,
      chains: [arbitrumSepolia, sepolia],
    }),
    ...(wcProjectId
      ? [zeroDevWalletConnect({ projectId: wcProjectId, solana: true })]
      : // ? [zeroDevWalletConnect({ projectId: wcProjectId })]
        []),
  ],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
})
