'use client'

import {AuthFlow, useAuth} from '@zerodev/wallet-react-kit'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'

export const dynamic = 'force-dynamic'

type DemoMode = 'prebuilt' | 'whiteLabel'

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
  const [demoMode, setDemoMode] = useState<DemoMode>('prebuilt')

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
    if (demoMode === 'whiteLabel') return
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
    demoMode,
    skipAutoConnect,
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:flex-row lg:items-start lg:justify-between lg:gap-14">
      <DemoIntroPanel mode={demoMode} onModeChange={setDemoMode}/>
      {sessionExpired && (
        <div
          className="px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200 lg:hidden">
          Your session has expired. Please log in again.
        </div>
      )}
      <div className="relative mx-auto flex w-full max-w-[430px] flex-col sm:h-[688px] lg:mx-0 lg:shrink-0">
        {sessionExpired && (
          <div
            className="mb-4 hidden px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200 lg:block">
            Your session has expired. Please log in again.
          </div>
        )}
        {demoMode === 'prebuilt' ? (
          <div className="w-full flex flex-col sm:w-[500px] sm:h-[800px] sm:origin-top sm:scale-[0.86]">
            <AuthFlow/>
          </div>
        ) : (
          <WhiteLabelWalletPreview onConnect={handleReconnect}/>
        )}
        {demoMode === 'prebuilt' && showReconnect && (
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

function DemoIntroPanel({
  mode,
  onModeChange,
}: {
  mode: DemoMode
  onModeChange: (mode: DemoMode) => void
}) {
  return (
    <aside className="w-full max-w-2xl pt-2 lg:pt-8">
      <p className="mb-4 text-sm font-semibold uppercase text-blue-500">
        Wallet Demo
      </p>
      <h1 className="max-w-[620px] text-4xl font-semibold leading-tight text-gray-950">
        The first AA native embedded wallet
      </h1>
      <p className="mt-5 max-w-[620px] text-lg leading-8 text-gray-500">
        ZeroDev Wallet combines embedded authentication with smart accounts by
        default, so account abstraction features are native to the wallet
        experience.
      </p>

      <div className="mt-10 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {demoModes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onModeChange(item.value)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              mode === item.value
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-16 divide-y divide-gray-200 border-y border-gray-200">
        {demoValueProps.map((item) => (
          <div key={item.title} className="py-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-mono text-2xl font-semibold text-gray-900">
                {item.title}
              </h2>
              <span className="h-2 w-2 rounded-full bg-gray-400"/>
            </div>
            <p className="mt-4 max-w-[620px] text-base leading-7 text-gray-500">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </aside>
  )
}

function WhiteLabelWalletPreview({onConnect}: {onConnect: () => void}) {
  return (
    <div className="flex min-h-[620px] w-full flex-col rounded-[34px] border border-gray-200 bg-[#101828] p-1.5 text-white shadow-2xl sm:h-[688px]">
      <div className="flex flex-1 flex-col rounded-[30px] bg-white px-6 py-7 text-gray-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Acme Finance</p>
            <h2 className="mt-1 text-2xl font-semibold">Create your wallet</h2>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
            A
          </div>
        </div>

        <div className="mt-12 rounded-2xl bg-gray-50 p-5">
          <p className="text-sm font-semibold text-gray-900">
            Powered by ZeroDev Wallet Core
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Keep the authentication, key management, and smart account APIs
            underneath while your app owns every pixel of the wallet UI.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onConnect}
            className="rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Continue with passkey
          </button>
          <button
            type="button"
            onClick={onConnect}
            className="rounded-2xl border border-gray-200 px-5 py-4 text-base font-semibold text-gray-900 hover:bg-gray-50 cursor-pointer"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={onConnect}
            className="rounded-2xl border border-gray-200 px-5 py-4 text-base font-semibold text-gray-900 hover:bg-gray-50 cursor-pointer"
          >
            Continue with email
          </button>
        </div>

        <div className="mt-auto border-t border-gray-100 pt-6">
          <p className="text-xs leading-5 text-gray-500">
            This mode demonstrates a white-label integration: your design
            system owns the interface, while ZeroDev provides the wallet
            primitive underneath.
          </p>
        </div>
      </div>
    </div>
  )
}

const demoModes: {value: DemoMode; label: string}[] = [
  {value: 'prebuilt', label: 'Pre-built UI'},
  {value: 'whiteLabel', label: 'White-label'},
]

const demoValueProps = [
  {
    title: '<SmartByDefault/>',
    description:
      'Use EIP-7702 and ERC-4337 smart accounts as the default wallet model, not as a secondary add-on.',
  },
  {
    title: '<NativeAA/>',
    description:
      'Build with gas sponsorship, transaction batching, automation, and chain abstraction as native APIs.',
  },
  {
    title: '<HybridSecurity/>',
    description:
      'Combine off-chain key management with on-chain smart account controls for a self-custodial wallet flow.',
  },
]
