import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: [
    '@zerodev/wallet-react',
    '@zerodev/wallet-react-ui',
    '@zerodev/wallet-core',
  ],
  // Same aliases the other demos need, and for the same reasons: one physical
  // copy of wagmi / @wagmi/core / @tanstack/react-query, or provider and
  // consumer end up on different React Contexts and the hooks throw.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: path.resolve(__dirname, 'node_modules/wagmi'),
      '@wagmi/core': path.resolve(__dirname, 'node_modules/@wagmi/core'),
      '@tanstack/react-query': path.resolve(
        __dirname,
        'node_modules/@tanstack/react-query',
      ),
      // `wagmi/connectors` re-exports @wagmi/core's tempo module, which
      // imports its optional `accounts` peer. It isn't installed (nothing
      // here uses tempo), so stub the specifier out of the bundle.
      accounts: false,
    }
    return config
  },
}

export default nextConfig
