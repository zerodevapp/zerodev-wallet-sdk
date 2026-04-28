import { zeroDevWallet } from '@zerodev/wallet-react'
import { createConfig, http } from 'wagmi'
import { arbitrumSepolia, sepolia } from 'wagmi/chains'

const ZERODEV_PROJECT_ID = process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID ?? ''
const chains = [sepolia, arbitrumSepolia] as const

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    zeroDevWallet({
      projectId: ZERODEV_PROJECT_ID,
      chains,
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
})
