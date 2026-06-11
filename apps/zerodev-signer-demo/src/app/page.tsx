'use client'

import {AuthFlow} from '@zerodev/wallet-react-kit'
import {highlight} from 'sugar-high'
import {ArrowRight, CheckCircle2, CircleHelp, Mail, Settings} from 'lucide-react'
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

  const {connect, connectors, status: connectStatus} = useConnect()
  const {isConnected, status: accountStatus} = useAccount()

  const handleReconnect = () => {
    if (connectors[0]) connect({connector: connectors[0]})
  }

  useEffect(() => {
    localStorage.removeItem('zd:loggedOut')
  }, [])

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
    if (isConnected) {
      setAuthTransitioning(true)
      const timer = window.setTimeout(() => {
        router.push('/dashboard')
      }, 450)

      return () => window.clearTimeout(timer)
    }
    if (demoMode === 'whiteLabel') return
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
      <div className="relative mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[minmax(0,500px)_390px] lg:items-start lg:justify-between lg:gap-12 animate-[auth-transition-card_400ms_ease-out_forwards]">
        <DemoIntroPanel/>
        {sessionExpired && (
          <div
            className="order-3 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200 lg:hidden">
            Your session has expired. Please log in again.
          </div>
        )}
        <div className="relative order-first mx-auto flex w-full max-w-[390px] flex-col lg:order-none lg:mx-0 lg:pt-3">
          <ModeSelector mode={demoMode} onModeChange={setDemoMode}/>
          {sessionExpired && (
            <div
              className="mb-4 hidden px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200 lg:block">
              Your session has expired. Please log in again.
            </div>
          )}
          {demoMode === 'prebuilt' ? (
            <div className="h-[544px] overflow-hidden sm:w-[390px] sm:h-[624px]">
              <div className="w-[500px] h-[800px] origin-top-left flex flex-col scale-[0.68] sm:scale-[0.78]">
                <AuthFlow/>
              </div>
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
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {demoModes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onModeChange(item.value)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                mode === item.value
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {item.label}
                <InfoTooltip text={item.description}/>
              </span>
            </button>
          ))}
        </div>
        <EmailMethodSettings/>
      </div>
    </div>
  )
}

function EmailMethodSettings() {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<EmailAuthMethod>(() => {
    if (typeof window === 'undefined') return 'otp'
    return localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
      ? 'magicLink'
      : 'otp'
  })

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

function DemoIntroPanel() {
  const [activeValueIndex, setActiveValueIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveValueIndex((index) => (index + 1) % demoValueProps.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className="w-full max-w-[500px] pt-1 lg:pt-3">
      <h1 className="max-w-[500px] text-3xl font-semibold leading-tight text-gray-950">
        Auth in. Smart wallet out.
      </h1>
      <p className="mt-3 max-w-[500px] text-base leading-7 text-gray-500">
        ZeroDev turns any sign-in — passkey, email, Google — into a
        self-custodial smart account. Your users never touch a seed phrase
        or pay unexpected gas.
      </p>

      <div className="mt-6">
        <InstallBlock/>
      </div>

      <div className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
        {demoValueProps.map((item, index) => {
          const active = index === activeValueIndex

          return (
            <div key={item.title} className="py-4">
              <button
                type="button"
                onClick={() => setActiveValueIndex(index)}
                className="block w-full text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-base font-semibold text-gray-900">
                    {item.title}
                  </h2>
                  <ProgressIndicator active={active}/>
                </div>
              </button>
              <div
                className={`grid transition-all duration-500 ease-out ${
                  active
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="mb-3 max-w-[500px] text-sm leading-6 text-gray-500">
                    {item.description}
                  </p>
                  <CodeSnippet label={item.codeLabel} code={item.code}/>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function ProgressIndicator({
  active,
}: {
  active: boolean
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-10 overflow-hidden rounded-full bg-gray-100">
        {active && (
          <span
            className="block h-full origin-left animate-[demo-progress_5s_linear_forwards] rounded-full bg-blue-500"
          />
        )}
      </span>
    </span>
  )
}

function CodeSnippet({code, label}: {code: string; label: string}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-950 p-4 text-gray-100">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-xs text-gray-400">React</span>
      </div>
      <pre className="max-h-[148px] overflow-x-auto overflow-y-hidden text-sm leading-6 text-gray-200">
        <code dangerouslySetInnerHTML={{__html: highlight(code)}}/>
      </pre>
    </div>
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

function InstallBlock() {
  const [variant, setVariant] = useState<keyof typeof installVariants>('headless')

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        {(Object.keys(installVariants) as (keyof typeof installVariants)[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setVariant(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border ${
              variant === key
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            {installVariants[key].label}
          </button>
        ))}
      </div>
      <div className="px-4 py-4 font-mono text-sm text-gray-300">
        <span className="text-blue-400 select-none">{'>'}</span>{' '}
        {installVariants[variant].command}
      </div>
    </div>
  )
}

const installVariants = {
  headless: {
    label: 'Wallet Core (headless)',
    command: 'npm install @zerodev/wallet-react',
  },
  uikit: {
    label: 'Wallet Core with UI',
    command: 'npm install @zerodev/wallet-react-kit',
  },
} as const

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

const demoValueProps = [
  {
    title: 'Bring your own auth',
    description:
      'Passkeys, email, Google, or your own credential system — ZeroDev derives a wallet from whatever you already trust. No seed phrases, no browser extensions, no parallel auth stack to maintain.',
    codeLabel: 'Add Google OAuth',
    code: `import {
  OAUTH_PROVIDERS,
  useAuthenticateOAuth,
} from '@zerodev/wallet-react'

const authenticateOAuth = useAuthenticateOAuth()

authenticateOAuth.mutateAsync({
  provider: OAUTH_PROVIDERS.GOOGLE,
})`,
  },
  {
    title: 'Smart accounts, not just wallets',
    description:
      'Every user gets a programmable smart account from day one. Sponsor gas so transactions are free. Batch multiple calls into one. Automate on-chain actions users never need to sign for.',
    codeLabel: 'Drop in AuthFlow',
    code: `import { AuthFlow } from '@zerodev/wallet-react-kit'

export function SignIn() {
  return <AuthFlow />
}`,
  },
  {
    title: 'One component or raw hooks',
    description:
      'Ship with <AuthFlow /> and launch this afternoon. Or reach for raw hooks and own every pixel. The same account infrastructure works either way.',
    codeLabel: 'Own the UI',
    code: `const authenticateEmail = useAuthenticateEmail()

async function signIn(email: string) {
  await authenticateEmail.mutateAsync({ email })
}

return <EmailForm onSubmit={signIn} />`,
  },
]
