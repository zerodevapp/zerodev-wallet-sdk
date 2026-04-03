import { zeroDevKitWallet } from '@zerodev/wallet-react-kit'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevKitWallet({
      projectId: import.meta.env.VITE_ZERODEV_PROJECT_ID,
      proxyBaseUrl: '/api/v1',
      chains: [sepolia],
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
})
