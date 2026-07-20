'use client'

import { ZeroDevLogo } from '@zerodev/react-ui'
import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia, anvil } from 'wagmi/chains'

const rpcUrls: Record<number, string | undefined> = {
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  [anvil.id]: process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? 'http://localhost:18545',
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
  chains: [arbitrumSepolia, sepolia, anvil],
  connectors: [
    zeroDevWallet({
      projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
      proxyBaseUrl: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL!,
      chains: [arbitrumSepolia, sepolia, anvil],
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
      // Local Anvil AA: route through the app's same-origin proxy (avoids
      // browser CORS and translates the SDK's zd_* dialect) to the local
      // Ultra Relay bundler, and self-fund (no hosted paymaster). Chain 31337
      // only.
      aaOverrides: {
        [anvil.id]: {
          bundlerUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/local-bundler`,
          selfFunded: true,
        },
      },
      config: {
        logo: <ZeroDevLogo variant="mark" tone="color" className="zd:h-8 zd:w-auto" />,
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
    [anvil.id]: http(rpcUrls[anvil.id])
  },
})
