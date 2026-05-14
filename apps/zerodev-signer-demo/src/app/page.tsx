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

  const { connect, connectors, status } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
      return
    }
    if (status === 'idle' && connectors[0]) {
      connect({ connector: connectors[0] })
    }
  }, [isConnected, router, status, connect, connectors])

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
