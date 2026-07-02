'use client'

import {AuthFlow, useAuth} from '@zerodev/wallet-react-kit'
import {KeyRound, Layers, Loader2, Sparkles} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'
import { AppHeader } from './components/AppHeader'

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
  // wagmi is still resolving the session (reconnect on mount, or an explicit
  // connect in flight). Show a spinner instead of the Reconnect button so we
  // don't flash a misleading CTA before the redirect to /dashboard.
  const isResolvingSession =
    accountStatus === 'reconnecting' ||
    accountStatus === 'connecting' ||
    connectStatus === 'pending'
  const showLoading =
    !isConnected && authStep === null && isResolvingSession
  const showReconnect =
    !isConnected &&
    authStep === null &&
    !isResolvingSession &&
    (skipAutoConnect || connectStatus === 'error')

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
    <div className="min-h-screen bg-white">
      <AppHeader/>
      <main
        className="mx-auto grid min-h-[calc(100vh-92px)] w-full max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-8 lg:py-12">
        {sessionExpired && (
          <div
            className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-700 lg:col-span-2">
            Your session has expired. Please log in again.
          </div>
        )}

        <section className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-5xl">
            ZeroDev Smart Wallet
          </h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">
            A pre-built wallet experience for auth, sponsored transactions, message signing, and batch transfers.
          </p>

          <div className="mt-8 space-y-5 text-left">
            <DemoStep
              icon={Sparkles}
              title="Mint without gas"
              text="Try a sponsored NFT mint from a smart wallet without funding native gas first."
            />
            <DemoStep
              icon={KeyRound}
              title="Sign anything"
              text="Sign messages or typed data from the same embedded wallet session."
            />
            <DemoStep
              icon={Layers}
              title="Batch transactions"
              text="Split ETH or USDC across recipients and preview the batch flow."
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[400px] justify-center overflow-hidden lg:mx-0">
          <div className="h-[630px] w-[400px] overflow-hidden">
            <div className="origin-top-left scale-[0.78]">
              <div className="flex h-[770px] w-[512px] flex-col">
                <AuthFlow/>
                {showLoading && (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  </div>
                )}
                {showReconnect && (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <button
                      type="button"
                      onClick={handleReconnect}
                      className="rounded-3xl bg-gray-900 px-8 py-4 text-body1 font-semibold text-white hover:bg-gray-800 cursor-pointer"
                    >
                      Reconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function DemoStep({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles
  title: string
  text: string
}) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-950 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
      </div>
    </div>
  )
}
