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

  const { connect, connectors } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
    }
  }, [isConnected, router])

  return (
    <div className="mx-auto h-[800px] w-[500px]">
      {sessionExpired && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
          Your session has expired. Please log in again.
        </div>
      )}
      <button
        type="button"
        onClick={() => connect({ connector: connectors[0] })}
        className="mb-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 cursor-pointer"
      >
        Connect
      </button>
      <AuthFlow />
    </div>
  )
}