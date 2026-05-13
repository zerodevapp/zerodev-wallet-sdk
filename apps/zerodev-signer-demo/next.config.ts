import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@zerodev/wallet-react',
    '@zerodev/wallet-core',
    '@zerodev/wallet-react-kit',
  ],
}

export default nextConfig
