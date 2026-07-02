'use client'

import { Icon } from '@zerodev/react-ui'
import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/react-wallet-ui'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'

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
      // Local testing override: our docker backend's Turnkey base org differs
      // from the SDK's hardcoded prod default, so point the connector at it.
      ...(process.env.NEXT_PUBLIC_ORG_ID && {
        organizationId: process.env.NEXT_PUBLIC_ORG_ID,
      }),
      ...(mode && { mode }),
      config: {
        logo: <Icon name="zerodevLogo" className="zd:h-8 zd:w-auto" />,
        auth: {
          enabledMethods: ['email', 'google', 'passkey'],
          emailAuthMethod: getEmailAuthMethod(),
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
