import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Lets a build and a dev server coexist without trampling each other's
  // output — the .next corruption that shows up as "Cannot find module for
  // page" or a React Client Manifest 500.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: [
    '@zerodev/wallet-react',
    '@zerodev/wallet-react-ui',
    '@zerodev/wallet-core',
  ],
  experimental: {
    externalDir: true,
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/ox\/_esm\/tempo\// },
    ]

    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: path.resolve(__dirname, 'node_modules/wagmi'),
      '@wagmi/core': path.resolve(__dirname, 'node_modules/@wagmi/core'),
      '@tanstack/react-query': path.resolve(
        __dirname,
        'node_modules/@tanstack/react-query',
      ),
      // Optional peers of connectors this app doesn't use (`wagmi/connectors`
      // re-exports them all), plus pino's optional `pino-pretty`. webpack
      // warns "Module not found" for each on every compile; stub them out.
      accounts: false,
      '@base-org/account': false,
      '@metamask/connect-evm': false,
      'pino-pretty': false,
    }
    return config
  },
}

export default nextConfig
