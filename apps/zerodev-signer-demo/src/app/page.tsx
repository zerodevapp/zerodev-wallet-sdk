'use client'

import {ZeroDevLogo} from '@zerodev/react-ui'
import {ConnectWallet, SignUp, type ThemeName, useAuth} from '@zerodev/wallet-react-ui'
import {KeyRound, Layers, Loader2, Moon, Sparkles, Sun} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useCallback, useEffect, useRef, useState} from 'react'
import {useAccount, useConnect} from 'wagmi'
import { AppHeader } from './components/AppHeader'
import { cn } from './lib/utils'
import { Playground } from './components/playground/Playground'
import {
  DEFAULT_ITEMS,
  DEFAULT_SETTINGS,
  emailMethod,
  parseExcludeIds,
  type PlaygroundItem,
  type PlaygroundSettings,
} from './components/playground/utils/snippet'

export const dynamic = 'force-dynamic'

// Email auth method choice, set by the browser E2E specs (stored in localStorage).
// Read in a mount effect (specs set the key before load) — kept out of render
// so the SSR pass and first client render match.
function getEmailAuthMethod(): 'otp' | 'magicLink' {
  if (typeof window === 'undefined') return 'otp'
  return localStorage.getItem('zd:emailAuthMethod') === 'magicLink'
    ? 'magicLink'
    : 'otp'
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner/>
    </Suspense>
  )
}

const THEME_NAMES: readonly ThemeName[] = [
  'branded-light',
  'plain-light',
  'branded-dark',
  'plain-dark',
]

function LandingPageInner() {
  const router = useRouter()
  // `?theme=plain-dark` picks the starting preset; the toggle under the card
  // flips between branded light (the kit's default) and plain dark.
  const themeParam = useSearchParams().get('theme')
  const [theme, setTheme] = useState<ThemeName>(
    () => THEME_NAMES.find((name) => name === themeParam) ?? 'branded-light',
  )
  const toggleTheme = () =>
    setTheme((current) => (current === 'plain-dark' ? 'branded-light' : 'plain-dark'))

  const [items, setItems] = useState<PlaygroundItem[]>(DEFAULT_ITEMS)
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS)

  const {connect, connectors, status: connectStatus} = useConnect()
  const {isConnected, status: accountStatus} = useAccount()
  const {step: authStep} = useAuth()
  // Auth has succeeded (ConnectWallet unmounts once step hits `authenticated`) but
  // wagmi hasn't flipped `isConnected` yet, so the redirect to /dashboard is
  // still pending. Cover this window (and the eventual redirect) with a
  // loading screen so the page doesn't sit blank and then jump.
  const isRedirecting = isConnected || authStep === 'authenticated'
  // wagmi failed to (re)connect — offer a manual Reconnect instead of a
  // misleading CTA.
  const showReconnect =
    !isConnected && authStep === null && connectStatus === 'error'
  // ConnectWallet renders nothing until it has a `step`, so any time we're not
  // connected and have no step yet — initial session probe, auto-connect in
  // flight, or landing back here right after logout — show the loader instead
  // of a blank column. Keeps the login <-> dashboard transition smooth in
  // both directions.
  // Once a card has rendered (its height is recorded below), a later
  // `step === null` is a closed card waiting for wagmi to settle, not the
  // initial probe: keep the page and hold the card's slot instead of
  // flashing the full-page loader on the way to the Reconnect fallback.
  const [cardHeight, setCardHeight] = useState<number | null>(null)
  const cardShown = cardHeight !== null
  const showLoading =
    isRedirecting ||
    (!isConnected && authStep === null && !showReconnect && !cardShown)
  // The slot shows something other than the card: the Reconnect fallback,
  // or a spinner while the dismissed connect settles.
  const holdSlot = showReconnect || (authStep === null && cardShown)

  const handleReconnect = () => {
    if (connectors[0]) connect({connector: connectors[0]})
  }

  // The card slot keeps the height of the last rendered wallet card while
  // the Reconnect fallback shows, so closing the card does not resize the
  // column and shift the theme switch and footnote around it.
  const holdSlotRef = useRef(holdSlot)
  holdSlotRef.current = holdSlot
  const slotObserver = useRef<ResizeObserver | null>(null)
  // A callback ref: the slot mounts after the loading screen, so an effect
  // keyed on state would miss it.
  const cardSlotRef = useCallback((slot: HTMLDivElement | null) => {
    slotObserver.current?.disconnect()
    slotObserver.current = null
    if (!slot) return
    const observer = new ResizeObserver(([entry]) => {
      // Only the card's own height counts, not the held one.
      if (entry && !holdSlotRef.current) {
        setCardHeight(entry.contentRect.height)
      }
    })
    observer.observe(slot)
    slotObserver.current = observer
  }, [])

  useEffect(() => {
    localStorage.removeItem('zd:loggedOut')
    // Seed the Email unit's method from the E2E localStorage toggle.
    const method = getEmailAuthMethod()
    setItems((prev) =>
      prev.map((i) => (i.type === 'email' ? { ...i, method } : i)),
    )
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

  if (showLoading) {
    return (
      <div className="min-h-screen">
        <AppHeader/>
        <div className="flex min-h-[calc(100vh-88px)] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--muted)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppHeader/>
      <main
        className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-[1080px] items-center gap-x-10 gap-y-4 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-0 lg:py-12">
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

        <div className="mx-auto flex w-full flex-col items-center lg:mx-0">
          <ThemeSwitch dark={theme === 'plain-dark'} onToggle={toggleTheme} />
          <div
            ref={cardSlotRef}
            className="flex w-[360px] flex-col items-center justify-center"
            style={holdSlot ? {height: cardHeight ?? 729} : undefined}
          >
          {showReconnect ? (
              <button
                type="button"
                onClick={handleReconnect}
                className="cursor-pointer rounded-3xl bg-[var(--ink)] px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
              >
                Reconnect
              </button>
          ) : holdSlot ? (
              <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
          ) : (
              // Live preview of the playground's composition. With no units
              // selected, renderSignUp is omitted and ConnectWallet falls back
              // to <SignUp.Default />.
              <ConnectWallet
                size="md"
                theme={theme}
                logo={<ZeroDevLogo variant="lockup" tone="auto" className="zd:h-8 zd:w-auto" />}
                renderSignUp={
                  items.length === 0
                    ? undefined
                    : () => (
                        <SignUp
                          emailAuthMethod={emailMethod(items)}
                          termsAndConditionsUrl={settings.termsUrl || undefined}
                          privacyPolicyUrl={settings.privacyUrl || undefined}
                        >
                          {items.map(renderSignUpItem)}
                        </SignUp>
                      )
                }
              />
          )}
          </div>

          <p className="mt-3 max-w-[360px] text-center text-xs leading-5 text-[var(--muted)]">
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

      <Playground
        items={items}
        onChange={setItems}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  )
}

function renderSignUpItem(item: PlaygroundItem) {
  switch (item.type) {
    case 'passkey':
      return <SignUp.Passkey key={item.key} />
    case 'google':
      return <SignUp.Google key={item.key} />
    case 'email':
      return <SignUp.Email key={item.key} />
    case 'wallet':
      return <SignUp.Wallet key={item.key} walletId={item.walletId} />
    case 'walletConnect':
      return <SignUp.WalletConnect key={item.key} />
    case 'installedWallets':
      return (
        <SignUp.InstalledWallets
          key={item.key}
          excludeWalletIds={parseExcludeIds(item.exclude)}
          {...(item.maxWallets !== null && { maxWallets: item.maxWallets })}
        />
      )
    case 'moreWallets':
      return <SignUp.MoreWallets key={item.key} />
    case 'divider':
      return <SignUp.Divider key={item.key} />
  }
}

/**
 * Sliding pill switch between the two demo themes. The knob carries the
 * active icon and slides to its side of the track; the other icon stays
 * ghosted behind it so both options read at a glance.
 */
function ThemeSwitch({
  dark,
  onToggle,
}: {
  dark: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Theme: non-branded dark' : 'Theme: branded light'}
      onClick={onToggle}
      className={cn(
        'relative mb-4 h-9 w-[68px] shrink-0 cursor-pointer rounded-full border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-warm)]',
        dark
          ? 'border-[#2a2420] bg-[#19110b]'
          : 'border-[var(--border-warm)] bg-[var(--surface-warm)]',
      )}
    >
      {/* Ghosted icons on the track, one per side. */}
      <Sun
        aria-hidden
        className={cn(
          'absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-opacity duration-300',
          dark ? 'text-[#f7f5f0] opacity-40' : 'opacity-0',
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          'absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-opacity duration-300',
          dark ? 'opacity-0' : 'text-[var(--muted)] opacity-50',
        )}
      />
      {/* The knob, carrying the active icon. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-[3px] left-[3px] grid h-7 w-7 place-items-center rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
          dark ? 'translate-x-[34px] bg-[#f7f5f0]' : 'translate-x-0 bg-white',
        )}
      >
        {dark ? (
          <Moon className="h-4 w-4 text-[#19110b]" strokeWidth={2.25} />
        ) : (
          <Sun className="h-4 w-4 text-[var(--accent-warm)]" strokeWidth={2.25} />
        )}
      </span>
    </button>
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
