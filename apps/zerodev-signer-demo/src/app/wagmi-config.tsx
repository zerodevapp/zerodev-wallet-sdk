'use client'

import { ZeroDevLogo } from '@zerodev/react-ui'
import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia, arbitrum, mainnet } from 'wagmi/chains'

const rpcUrls: Record<number, string | undefined> = {
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL,
  [sepolia.id]: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  [mainnet.id]: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  [arbitrum.id]: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
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
  chains: [arbitrumSepolia, sepolia, mainnet, arbitrum],
  connectors: [
    zeroDevWallet({
      projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
      proxyBaseUrl: process.env.NEXT_PUBLIC_KMS_PROXY_BASE_URL!,
      chains: [arbitrumSepolia, sepolia, mainnet, arbitrum],
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
      config: {
        logo: <ZeroDevLogo variant="mark" tone="color" className="zd:h-8 zd:w-auto" />,
        // PoC Reown Cloud project id (public client identifier).
        walletConnectProjectId: 'a6b5206ed2bb5ffce9937671b0f8f187',
        auth: {
          enabledMethods: ['email', 'passkey', 'external-wallet'],
          emailAuthMethod: getEmailAuthMethod(),
        },
      },
    }),
  ],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http(rpcUrls[arbitrumSepolia.id]),
    [sepolia.id]: http(rpcUrls[sepolia.id]),
    [mainnet.id]: http(rpcUrls[mainnet.id]),
    [arbitrum.id]: http(rpcUrls[arbitrum.id]),
  },
})
