'use client'

import {
  SmartRoutingAddress,
  SmartRoutingAddressProvider,
  type SmartRoutingAddressConfig,
} from '@zerodev/smart-routing-address-react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { AppHeader } from '../components/AppHeader'

export const dynamic = 'force-dynamic'

// Arbitrum mainnet — SRA only supports mainnet chains, so we pick a sensible
// default rather than reusing the connected chain (dashboard runs on testnets).
const CONFIG: SmartRoutingAddressConfig = {
  targetChainId: 42161,
  slippage: 50,
}

export default function DepositPage() {
  const router = useRouter()
  const { address, status } = useAccount()

  // useEffect(() => {
  //   if (status === 'disconnected') router.replace('/')
  // }, [status, router])

  if (!address) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-88px)] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--muted)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4 py-8">
        <SmartRoutingAddressProvider config={CONFIG}>
          <SmartRoutingAddress
            recipient={address}
            onClose={() => router.push('/dashboard')}
            onHelp={() => {
              /* help — deferred */
            }}
          />
        </SmartRoutingAddressProvider>
      </main>
    </div>
  )
}
