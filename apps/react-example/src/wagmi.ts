import { zeroDevKitWallet } from '@zerodev/wallet-react-kit'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevKitWallet({
      projectId: import.meta.env.VITE_ZERODEV_PROJECT_ID,
      chains: [sepolia],
      config: {
        auth: {
          magicLinkBaseUrl: 'http://localhost:3000/verify',
          enabledMethods: ['email', 'google', 'passkey'],
          // emailAuthMethod: 'otp', // set email auth method, 'magicLink' or 'otp', default is 'magicLink'
          termsAndConditionsUrl: 'https://www.example.com',
          privacyPolicyUrl: 'https://www.example.com',
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
