import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zerodev/wallet-react', '@zerodev/wallet-core'],
}

export default nextConfig
