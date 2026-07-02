'use client'

import {AuthFlow, useAuth} from '@zerodev/wallet-react-kit'
import {KeyRound, Layers, Loader2, Sparkles} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {Suspense, useEffect} from 'react'
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
    connectStatus === 'error'

  const handleReconnect = () => {
    if (connectors[0]) connect({connector: connectors[0]})
  }

  useEffect(() => {
    localStorage.removeItem('zd:loggedOut')
  }, [])

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard')
      return
    }
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
  ])

  return (
    <div className="min-h-screen">
      <AppHeader/>
      <main
        className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-[1040px] items-center gap-x-10 gap-y-4 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-0 lg:py-12">
        <section className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <h1 className="font-[var(--font-dm-sans)] text-4xl font-bold leading-[1.06] text-[var(--ink)] sm:text-5xl">
            Embedded Smart Wallets
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-8 text-[var(--muted)]">
            Give users a seamless wallet experience with built-in auth, gas sponsorship, batching, and smart account infrastructure behind one integration.
          </p>

          <div className="mt-8 space-y-5 text-left">
            <DemoStep
              icon={Sparkles}
              title="Gas Sponsorship Built In"
              text="Configure and customize gas policies in a few clicks, with no code changes required."
            />
            <DemoStep
              icon={KeyRound}
              title="One-click onchain flows"
              text="Batch multiple onchain actions into a single user approval, from sponsored transactions to app-specific workflows."
            />
            <DemoStep
              icon={Layers}
              title="Unified developer platform"
              text="Smart accounts, modules, permissions, policies, tracking, and billing bundled into one integration with less maintenance."
            />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[380px] flex-col items-center lg:mx-0">
          <div className="h-[570px] w-[380px] overflow-hidden">
            <div className="origin-top-left scale-[0.74]">
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
                      className="cursor-pointer rounded-3xl bg-[var(--ink)] px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
                    >
                      Reconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-1 max-w-[340px] text-center text-xs leading-5 text-[var(--muted)]">
            By signing up for ZeroDev Wallet Demo, you agree to our{' '}
            <a
              href="https://zerodev.app/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--ink)] underline underline-offset-2"
            >
              Terms of Service
            </a>{' '}
            and to receive product updates. View our{' '}
            <a
              href="https://zerodev.app/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--ink)] underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </p>
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
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="font-[var(--font-dm-sans)] text-base font-bold text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
      </div>
    </div>
  )
}
