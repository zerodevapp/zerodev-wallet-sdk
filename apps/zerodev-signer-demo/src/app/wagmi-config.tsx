'use client'

import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'
import { walletConnect } from 'wagmi/connectors'

const rpcUrls: Record<number, string | undefined> = {
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
}

// Local testing toggle for the connector's account mode.
// Set NEXT_PUBLIC_WALLET_MODE to 'EOA' | '4337' | '7702' to override; leave
// unset for the SDK default ('7702').
const mode = process.env.NEXT_PUBLIC_WALLET_MODE as WalletMode | undefined

// Reown Cloud project id (public client identifier). Unset → no WalletConnect
// connector registers and the kit hides all WalletConnect flows.
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
  chains: [arbitrumSepolia, sepolia],
  connectors: [
    zeroDevWallet({
      projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
      proxyBaseUrl: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL!,
      chains: [arbitrumSepolia, sepolia],
      // Bundler/paymaster host override (defaults to the SDK's prod host).
      // CI/e2e sets this to staging to match NEXT_PUBLIC_KMS_PROXY_BASE_URL.
      ...(process.env.NEXT_PUBLIC_ZERODEV_AA_HOST && {
        aaHost: process.env.NEXT_PUBLIC_ZERODEV_AA_HOST,
      }),
      // Local testing override: our docker backend's Turnkey base org differs
      // from the SDK's hardcoded prod default, so point the connector at it.
      ...(process.env.NEXT_PUBLIC_ORG_ID && {
        organizationId: process.env.NEXT_PUBLIC_ORG_ID,
      }),
      ...(mode && { mode }),
    }),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, showQrModal: false })]
      : []),
  ],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http(rpcUrls[arbitrumSepolia.id]),
    [sepolia.id]: http(rpcUrls[sepolia.id]),
  },
})
