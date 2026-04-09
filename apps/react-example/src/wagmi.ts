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
      config: {
        auth: {
          magicLinkBaseUrl: 'https://yourdomain.com/auth/verify',
          enabledMethods: ['email', 'google', 'passkey'],
          onSuccess: () => {
            // handle successful authentication
          },
          onError: (_error) => {
            // handle error
          },
        },
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
})
