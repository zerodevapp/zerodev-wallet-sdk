'use client'

import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react-kit'
import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'wagmi/chains'

const rpcUrls: Record<number, string | undefined> = {
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
}

// Local testing toggle for the connector's account mode.
// Set NEXT_PUBLIC_WALLET_MODE to 'EOA' | '4337' | '7702' to override; leave
// unset for the SDK default ('7702').
const mode = process.env.NEXT_PUBLIC_WALLET_MODE as WalletMode | undefined

// Read the email auth method choice from localStorage on init. Toggled by
// the cogwheel on the landing page; changes trigger a page reload so this
// re-runs with the new value.
function getEmailAuthMethod(): 'otp' | 'magicLink' {
  if (typeof window === 'undefined') return 'otp'
  return localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
    ? 'magicLink'
    : 'otp'
}

export const config = createConfig({
  chains: [arbitrumSepolia, sepolia],
  connectors: [
    zeroDevWallet({
      projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
      proxyBaseUrl: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL!,
      chains: [arbitrumSepolia, sepolia],
      ...(mode && { mode }),
      config: {
        auth: {
          magicLinkBaseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify`,
          enabledMethods: ['email', 'google', 'passkey'],
          emailAuthMethod: getEmailAuthMethod(),
        },
        // SRA API is mainnet-only — independent from the wallet's active chains
        // (testnets above), so the demo points it at real mainnet chains.
        smartRoutingAddress: {
          enabled: true,
          destinationChains: [arbitrum],
          sourceChains: [mainnet, arbitrum],
        },
      },
    }),
  ],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http(rpcUrls[arbitrumSepolia.id]),
    [sepolia.id]: http(rpcUrls[sepolia.id]),
  },
})
