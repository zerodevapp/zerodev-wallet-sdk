'use client'

import { AuthFlow } from '@zerodev/wallet-react-kit'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useAccount, useConnect } from 'wagmi'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner />
    </Suspense>
  )
}

function LandingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('session_expired') === 'true'

  const { connect, connectors, status: connectStatus } = useConnect()
  const { isConnected, status: accountStatus } = useAccount()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
      return
    }
    // Only auto-connect once wagmi has settled to disconnected (no in-flight
    // reconnect) and no connect attempt is already in-flight or pending reset.
    // Without these gates, connect() races wagmi's reconnect and flashes the
    // SignUp screen before isConnected hydrates.
    if (
      accountStatus === 'disconnected' &&
      connectStatus === 'idle' &&
      connectors[0]
    ) {
      connect({ connector: connectors[0] })
    }
  }, [
    isConnected,
    accountStatus,
    connectStatus,
    router,
    connect,
    connectors,
  ])

  return (
    <div className="mx-auto h-screen w-[500px] flex items-center">
      {sessionExpired && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
          Your session has expired. Please log in again.
        </div>
      )}
      <div className='h-[800px]'>
        <AuthFlow />
      </div>
    </div>
  )
}
