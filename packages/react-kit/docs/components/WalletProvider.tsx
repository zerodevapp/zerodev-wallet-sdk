import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { zeroDevKitWallet } from '@zerodev/wallet-react-kit'
import { type ReactNode, useState } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { sepolia } from 'wagmi/chains'

const config = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevKitWallet({
      projectId: import.meta.env.VITE_ZERODEV_PROJECT_ID,
      chains: [sepolia],
      config: {
        auth: {
          magicLinkBaseUrl: 'https://yourdomain.com/auth/verify',
          enabledMethods: ['email', 'google', 'passkey'],
        },
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  )
}
