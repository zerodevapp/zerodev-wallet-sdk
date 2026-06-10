'use client'

import {AuthFlow, useAuth} from '@zerodev/wallet-react-kit'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner/>
    </Suspense>
  )
}

function LandingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('session_expired') === 'true'

  const [loggedOut] = useState(() => {
    if (typeof window === 'undefined') return false
    const value = localStorage.getItem('zd:loggedOut') === 'true'
    if (value) localStorage.removeItem('zd:loggedOut')
    return value
  })

  const skipAutoConnect = sessionExpired || loggedOut
  const {connect, connectors, status: connectStatus} = useConnect()
  const {isConnected, status: accountStatus} = useAccount()
  const {step: authStep} = useAuth()
  const showReconnect =
    !isConnected &&
    authStep === null &&
    (skipAutoConnect || connectStatus !== 'idle')

  const handleReconnect = () => {
    if (connectors[0]) connect({connector: connectors[0]})
  }

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
      return
    }
    if (skipAutoConnect) return
    if (
      accountStatus === 'disconnected' &&
      connectStatus === 'idle' &&
      connectors[0]
    ) {
      connect({connector: connectors[0]})
    }
  }, [
    isConnected,
    accountStatus,
    connectStatus,
    router,
    connect,
    connectors,
    skipAutoConnect,
  ])

  return (
    <div
      className="mx-auto w-full max-w-[500px] flex flex-col flex-1 px-4 py-6 sm:max-w-none sm:flex-row sm:items-start sm:justify-center sm:px-6 sm:py-10">
      {sessionExpired && (
        <div
          className="m-4 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
          Your session has expired. Please log in again.
        </div>
      )}
      <div className="relative w-full flex flex-col sm:w-[430px] sm:h-[688px]">
        <div className="w-full flex flex-col sm:w-[500px] sm:h-[800px] sm:origin-top sm:scale-[0.86]">
          <AuthFlow/>
        </div>
        {showReconnect && (
          <div className="flex-1 flex items-center justify-center p-6">
            <button
              type="button"
              onClick={handleReconnect}
              className="px-8 py-4 rounded-3xl bg-gray-900 text-white text-body1 font-semibold hover:bg-gray-800 cursor-pointer"
            >
              Reconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
