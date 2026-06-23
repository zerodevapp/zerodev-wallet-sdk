'use client'

import {AuthFlow, useAuth} from '@zerodev/wallet-react-kit'
import {clearWalletBrowserState} from '../lib/wallet-reset'
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Mail,
  Settings,
} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import type {FormEvent} from 'react'
import {Suspense, useEffect, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'

export const dynamic = 'force-dynamic'

type DemoMode = 'prebuilt' | 'whiteLabel'
type EmailAuthMethod = 'otp' | 'magicLink'

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
  const loggedOutSuccess = searchParams.get('logged_out') === 'true'
  const [videoReady, setVideoReady] = useState(false)
  const [demoMode, setDemoMode] = useState<DemoMode>('prebuilt')
  const [authTransitioning, setAuthTransitioning] = useState(false)
  const [showLogoutToast, setShowLogoutToast] = useState(loggedOutSuccess)
  const [loggedOut, setLoggedOut] = useState(false)
  // Wallet status is only known on the client (wagmi reads its stored session),
  // so gate status-dependent UI until after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  // Safety net: if the reconnect never resolves, stop blocking the wallet UI.
  const [resolveTimedOut, setResolveTimedOut] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const value = localStorage.getItem('zd:loggedOut') === 'true'
    if (value) {
      localStorage.removeItem('zd:loggedOut')
      setLoggedOut(true)
    }
  }, [])

  const {connect, connectors, status: connectStatus} = useConnect()
  const {isConnected, status: accountStatus} = useAccount()
  const {step: authStep} = useAuth()
  const skipAutoConnect = sessionExpired || loggedOut || loggedOutSuccess
  const isResolvingSession =
    accountStatus === 'reconnecting' ||
    accountStatus === 'connecting' ||
    connectStatus === 'pending'
  const showLoading =
    mounted &&
    !isConnected &&
    authStep === null &&
    isResolvingSession &&
    !resolveTimedOut
  const showReconnect =
    mounted &&
    !isConnected &&
    authStep === null &&
    !isResolvingSession &&
    (skipAutoConnect || connectStatus === 'error')
  const showStalled =
    mounted && !isConnected && authStep === null && resolveTimedOut

  // Detect a stalled session restore. A stale/incompatible stored session can
  // hang the reconnect forever (works in a fresh/incognito profile but not
  // here); flag it after a grace period instead of blocking the UI.
  useEffect(() => {
    if (!isResolvingSession) {
      setResolveTimedOut(false)
      try {
        sessionStorage.removeItem('zd:recovering')
      } catch {}
      return
    }
    const timer = window.setTimeout(() => setResolveTimedOut(true), 8000)
    return () => window.clearTimeout(timer)
  }, [isResolvingSession])

  // Auto-recover once: a stalled restore is almost always a stale stored
  // session (kept in IndexedDB), so clear it and reload to start fresh. The
  // per-tab guard prevents a reload loop; if it still stalls, "Start over" shows.
  useEffect(() => {
    if (!resolveTimedOut) return
    let alreadyTried = false
    try {
      alreadyTried = sessionStorage.getItem('zd:recovering') === '1'
      if (!alreadyTried) sessionStorage.setItem('zd:recovering', '1')
    } catch {}
    if (alreadyTried) return
    void clearWalletBrowserState().finally(() => window.location.reload())
  }, [resolveTimedOut])

  const handleReconnect = () => {
    setResolveTimedOut(false)
    if (connectors[0]) connect({connector: connectors[0]})
  }

  const handleStartOver = () => {
    try {
      sessionStorage.removeItem('zd:recovering')
    } catch {}
    void clearWalletBrowserState().finally(() => window.location.reload())
  }

  useEffect(() => {
    if (!loggedOutSuccess) return
    setShowLogoutToast(true)

    const hideTimer = window.setTimeout(() => {
      setShowLogoutToast(false)
    }, 3000)
    const cleanUrlTimer = window.setTimeout(() => {
      router.replace('/')
    }, 3500)

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(cleanUrlTimer)
    }
  }, [loggedOutSuccess, router])

  useEffect(() => {
    if (!sessionExpired) return

    const cleanUrlTimer = window.setTimeout(() => {
      router.replace('/')
    }, 3500)

    return () => window.clearTimeout(cleanUrlTimer)
  }, [sessionExpired, router])

  useEffect(() => {
    if (isConnected) {
      setAuthTransitioning(true)
      const timer = window.setTimeout(() => {
        router.push('/dashboard')
      }, 450)

      return () => window.clearTimeout(timer)
    }
    if (demoMode === 'whiteLabel' || skipAutoConnect || authStep !== null) return
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
    authStep,
  ])

  return (
    <div className="relative flex-1">
      <div
        className="fixed inset-0 -z-10 h-screen w-screen bg-cover bg-center opacity-[0.18]"
        style={{backgroundImage: 'url(/videos/hero-bg-poster.jpg)'}}
      />
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setVideoReady(true)}
        className={`fixed inset-0 -z-10 h-screen w-screen object-cover pointer-events-none transition-opacity duration-700 ${
          videoReady ? 'opacity-[0.18]' : 'opacity-0'
        }`}
        poster="/videos/hero-bg-poster.jpg"
        src="/videos/hero-bg.mp4"
      />
      <div
        className={`fixed left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-green-100 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-all duration-300 ${
          showLogoutToast
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <CheckCircle2 className="h-4 w-4 text-green-600"/>
        Logged out successfully
      </div>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
          authTransitioning
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex flex-col items-center gap-3 animate-[auth-transition-card_450ms_ease-out_forwards]">
          <div className="h-10 w-10 rounded-full border-2 border-blue-100 border-t-blue-500 animate-spin"/>
          <p className="text-sm font-medium text-gray-500">
            Opening wallet...
          </p>
        </div>
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,600px)_390px] lg:justify-center lg:gap-10 animate-[auth-transition-card_400ms_ease-out_forwards]">
        <div className="text-center lg:text-left">
          <span className="mb-4 block text-sm font-medium uppercase tracking-wider text-[#19110B]/70 [font-family:var(--font-dm-sans)]">
            Wallet demo
          </span>
          <h1 className="mx-auto max-w-[600px] text-4xl font-medium leading-[1.05] text-[#19110B] sm:text-5xl md:text-6xl lg:mx-0 lg:text-[76px] [font-family:var(--font-dm-sans)]">
            Auth in.
            <br />
            Smart wallet out.
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-base leading-7 text-[#19110B] lg:mx-0 [font-family:var(--font-dm-sans)]">
            ZeroDev turns any sign-in — passkey, email, Google — into a
            self-custodial smart account. Your users never touch a seed phrase
            or pay unexpected gas.
          </p>
        </div>
        <div className="relative mx-auto flex w-full max-w-[390px] flex-col lg:mx-0">
          <ModeSelector mode={demoMode} onModeChange={setDemoMode}/>
          {sessionExpired && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
              Your session has expired. Please log in again.
            </div>
          )}
          {demoMode === 'prebuilt' ? (
            <div className="relative h-[544px] overflow-hidden sm:w-[390px] sm:h-[624px]">
              <div className="w-[500px] h-[800px] origin-top-left flex flex-col scale-[0.68] sm:scale-[0.78]">
                <AuthFlow/>
              </div>
              {showLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500"/>
                    Restoring session...
                  </div>
                </div>
              )}
              {showReconnect && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="flex max-w-[280px] flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
                    <p className="text-sm font-medium text-gray-900">
                      Ready to continue
                    </p>
                    <p className="text-xs leading-5 text-gray-500">
                      Reconnect your session to open the wallet.
                    </p>
                    <button
                      type="button"
                      onClick={handleReconnect}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                      Reconnect
                    </button>
                  </div>
                </div>
              )}
              {showStalled && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                  <div className="flex max-w-[280px] flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
                    <p className="text-sm font-medium text-gray-900">
                      Couldn&apos;t restore your session
                    </p>
                    <p className="text-xs leading-5 text-gray-500">
                      An old saved session is stuck. Start over to sign in
                      fresh.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                      Start over
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <WhiteLabelWalletPreview onConnect={handleReconnect}/>
          )}
        </div>
      </div>
    </div>
  )
}

function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: DemoMode
  onModeChange: (mode: DemoMode) => void
}) {
  return (
    <div className="mb-4">
      <div className="relative">
        <div className="relative grid w-full grid-cols-2 rounded-full bg-[#E7E2DD]/30 px-1.5 py-2 backdrop-blur-[30px]">
          {/* Sliding selected-tab thumb (Contact sales styling). */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-2 left-1.5 w-[calc((100%-0.75rem)/2)] rounded-full bg-[#19110B] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'whiteLabel' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          {demoModes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onModeChange(item.value)}
              className={`relative z-10 rounded-full px-3 py-2 text-base font-semibold transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer [font-family:var(--font-dm-sans)] ${
                mode === item.value
                  ? 'text-[#faf7f4]'
                  : 'text-[#19110B] hover:text-gray-950'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {item.label}
                <InfoTooltip text={item.description}/>
              </span>
            </button>
          ))}
        </div>
        <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2">
          <EmailMethodSettings/>
        </div>
      </div>
    </div>
  )
}

function EmailMethodSettings() {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<EmailAuthMethod>('otp')
  useEffect(() => {
    setMethod(localStorage.getItem('zd:emailAuthMethod') === 'magicLink' ? 'magicLink' : 'otp')
  }, [])

  const handleSave = (next: EmailAuthMethod) => {
    localStorage.setItem('zd:emailAuthMethod', next)
    window.location.reload()
  }

  const handleOpen = () => {
    setMethod(
      localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
        ? 'magicLink'
        : 'otp',
    )
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Email method settings"
        className="inline-flex h-8 w-8 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 cursor-pointer"
      >
        <Settings className="h-4 w-4"/>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-[320px] flex-col gap-4 rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">
              Email auth method
            </h2>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="emailAuthMethod"
                value="otp"
                checked={method === 'otp'}
                onChange={() => setMethod('otp')}
              />
              <span className="text-gray-700">OTP code</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="emailAuthMethod"
                value="magicLink"
                checked={method === 'magicLink'}
                onChange={() => setMethod('magicLink')}
              />
              <span className="text-gray-700">Magic link</span>
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(method)}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 cursor-pointer"
              >
                Save and reload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoTooltip({text}: {text: string}) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 outline-none transition-colors hover:text-gray-700 focus-visible:text-gray-700"
      >
        <CircleHelp className="h-3.5 w-3.5"/>
      </span>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-gray-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  )
}

function WhiteLabelWalletPreview({onConnect}: {onConnect: () => void}) {
  const [email, setEmail] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onConnect()
  }

  return (
    <div className="flex min-h-[620px] w-full flex-col rounded-[34px] border border-zinc-800 bg-[#111111] p-1.5 text-white shadow-2xl sm:h-[624px]">
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-hidden rounded-[30px] bg-[#151515]"
      >
        <div className="relative overflow-hidden px-6 py-5">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#0b0f14_0%,#111111_48%,#17131f_100%)]"/>
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(177,132,255,0.85),transparent)]"/>
          <div className="absolute -right-10 -top-20 h-44 w-44 rounded-full bg-[#b184ff]/16 blur-3xl"/>
          <div className="absolute -left-20 bottom-0 h-36 w-36 rounded-full bg-[#6dd8ff]/10 blur-3xl"/>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6f2ff] text-2xl font-black italic text-[#111111] shadow-[0_18px_50px_rgba(177,132,255,0.22)]">
                N
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-normal text-white">
                  NOVA
                </p>
                <p className="text-xs font-medium text-zinc-500">
                  Banking and wallets
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[#b184ff]/30 bg-[#b184ff]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ccb6ff]">
              Demo
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 py-7">
          <div className="mb-7 text-center">
            <h2 className="text-3xl font-semibold text-zinc-100">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in to continue to your account.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-600"/>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-[#1b1b1b] pl-12 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#b184ff]"
              />
            </label>
            <button
              type="submit"
              className="flex h-12 items-center gap-2 rounded-xl bg-[#f6f2ff] px-4 text-sm font-semibold text-[#111111] hover:bg-white cursor-pointer"
            >
              Continue
              <ArrowRight className="h-4 w-4"/>
            </button>
          </div>

          <div className="my-5 flex items-center gap-4">
            <div className="h-px flex-1 bg-zinc-800"/>
            <span className="text-xs font-semibold text-zinc-600">OR</span>
            <div className="h-px flex-1 bg-zinc-800"/>
          </div>

          <button
            type="button"
            onClick={onConnect}
            className="flex h-12 items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-[#1b1b1b] px-4 text-sm font-medium text-zinc-200 hover:border-[#b184ff]/60 cursor-pointer"
          >
            <GoogleLogo/>
            Continue with Google
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
            By continuing you agree to NOVA&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </form>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

const demoModes: {value: DemoMode; label: string; description: string}[] = [
  {
    value: 'prebuilt',
    label: 'Pre-built UI',
    description:
      'A production-ready auth component with state management, error handling, and redirect flows already wired up. Customize as your product matures.',
  },
  {
    value: 'whiteLabel',
    label: 'White-label',
    description:
      'Raw hooks against the same account infrastructure — no ZeroDev chrome, no constraints. Your design, your flow, same smart wallet underneath.',
  },
]

