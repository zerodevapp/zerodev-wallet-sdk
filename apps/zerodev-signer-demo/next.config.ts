import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zerodev/wallet-react', '@zerodev/wallet-core'],
  // Force a single wagmi / @wagmi/core instance in the bundle. wagmi exposes
  // its config through React Context; if two physical copies end up loaded,
  // `WagmiProvider` and `useConfig` reference different Contexts and hooks
  // throw WagmiProviderNotFoundError. Duplicates can arise whenever the same
  // wagmi version is resolved with different (optional) peer-dependency
  // contexts across paths — common in workspaces. Aliasing both packages to
  // this app's node_modules guarantees every import resolves to the same
  // module identity.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: path.resolve(__dirname, 'node_modules/wagmi'),
      '@wagmi/core': path.resolve(__dirname, 'node_modules/@wagmi/core'),
    }
    return config
  },
}

export default nextConfig
