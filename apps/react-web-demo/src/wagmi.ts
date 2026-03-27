import { zeroDevWallet } from '@zerodev/wallet-react'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevWallet({
      projectId: import.meta.env.VITE_ZERODEV_PROJECT_ID,
      organizationId: import.meta.env.VITE_TURNKEY_ORGANIZATION_ID,
      proxyBaseUrl: '/api/v1',
      chains: [sepolia],
      signingUI: { mode: 'prompt' },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
})
