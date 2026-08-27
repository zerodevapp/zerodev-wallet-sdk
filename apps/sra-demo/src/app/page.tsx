'use client'

import {
  type OnrampWidgetParams,
  SmartRoutingAddress,
  type SmartRoutingAddressConfig,
  SmartRoutingAddressProvider,
  useCreateSmartRoutingAddress,
  useSmartRoutingAddress,
} from '@zerodev/smart-routing-address-react-ui'
import { useEffect, useMemo, useState } from 'react'
import type { Chain } from 'viem'
import { type Address, isAddress } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import { MockPanel } from './components/MockPanel'
import {
  installMockFetch,
  loadPastDeposits,
  type MockErrorMode,
  setMockDeposits,
  uninstallMockFetch,
} from './mock'

// Vitalik's address — a valid, well-known target used only as a default in
// SIMULATED mode so the widget renders immediately without the user typing
// anything. In MAINNET mode we clear the recipient so the user is forced to
// enter their own address before any real deposit address is generated.
const SIMULATED_DEFAULT_RECIPIENT: Address =
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

// Destination chains offered in the "Settings" configurator.
const CHAINS: Chain[] = [arbitrum, base, optimism, polygon, mainnet]

/** Demo run mode. In `simulated` the mock fetch layer intercepts every SRA
 * server call so the widget can be exercised without any real network / funds
 * / project ID. In `mainnet` the mock is disabled and the widget speaks to
 * the live SRA server — real deposit addresses, real routing, real funds. */
type DemoMode = 'simulated' | 'mainnet'

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export default function Home() {
  // Run mode drives every safety-relevant behaviour below (mock fetch
  // install, default recipient, whether the widget renders at all).
  const [mode, setMode] = useState<DemoMode>('simulated')
  // Whether the SRA widget is mounted. TopNav's `X` sets this to false;
  // the "+ Fund" button reopens it. Mirrors the auth demo's pattern of
  // dismissable card + explicit re-open trigger.
  const [sraOpen, setSraOpen] = useState(true)

  // Applied config drives the widget. Draft state below is edited freely and
  // only applied (regenerating the routing address) when "Save & regenerate"
  // is clicked.
  // In mainnet mode `recipient` starts empty so the widget doesn't render
  // until the user enters their own address (safety default).
  const [recipient, setRecipient] = useState<Address | ''>(
    SIMULATED_DEFAULT_RECIPIENT,
  )
  // Remembers the last address the user typed in mainnet mode so switching
  // simulated → mainnet doesn't force them to re-enter it. Reset only on
  // page refresh. `null` until the user commits a mainnet recipient.
  const [lastMainnetRecipient, setLastMainnetRecipient] =
    useState<Address | null>(null)
  const [targetChainId, setTargetChainId] = useState<number>(arbitrum.id)
  const [slippage, setSlippage] = useState<number>(100)
  // Bumped by `MockControls` after inserting/clearing mock deposits or
  // toggling error/sponsored modes — re-mounts the widget so freshly-added
  // deposits re-baseline as past and new mock state takes effect.
  const [mockNonce, setMockNonce] = useState(0)
  const regenerate = () => setMockNonce((n) => n + 1)
  // Toggle state for the "Simulate states" section of MockControls. Lifted
  // out of MockControls so it survives the widget's re-mounts (bumping
  // `mockNonce` tears down the whole provider subtree, which used to reset
  // the local toggle state while the mock's module-level state persisted —
  // producing a UI ↔ mock mismatch).
  const [mockErrorMode, setMockErrorMode] = useState<MockErrorMode>('none')
  const [mockSponsored, setMockSponsored] = useState(false)
  // Shows the widget's "Buy with card" (Transak) entry. Defaults on when a
  // real partner key is configured; toggleable from Mock controls otherwise
  // so the entry's UX is previewable with a placeholder key.
  const [mockOnramp, setMockOnramp] = useState(
    !!process.env.NEXT_PUBLIC_TRANSAK_API_KEY,
  )
  // Lifted for the same reason as the toggles above: the mock-controls
  // <details> would otherwise reset to closed every time an action bumps
  // `mockNonce` and remounts the subtree.
  const [mockControlsOpen, setMockControlsOpen] = useState(false)

  const [draftRecipient, setDraftRecipient] = useState<string>(
    SIMULATED_DEFAULT_RECIPIENT,
  )
  const [draftChain, setDraftChain] = useState<number>(targetChainId)
  const [draftSlippage, setDraftSlippage] = useState<number>(slippage)

  // Mock lifecycle owned at page level so the toggle can flip it cleanly.
  // Simulated → install the fetch interceptor + seed past-deposits from
  // localStorage. Mainnet → uninstall so the widget hits the live SRA
  // server. Runs on every mode change.
  useEffect(() => {
    if (mode === 'simulated') {
      installMockFetch()
      setMockDeposits(loadPastDeposits())
    } else {
      uninstallMockFetch()
    }
  }, [mode])

  // Persist the mode across page refreshes so a mainnet session stays on
  // mainnet after reload. Restored on mount via `switchMode` (not a raw
  // setMode) so the recipient / draft resets happen too — that keeps the
  // mainnet safety default (empty recipient) intact after refresh.
  useEffect(() => {
    const stored = localStorage.getItem('sra-demo-mode')
    if (stored === 'mainnet' || stored === 'simulated') {
      switchMode(stored)
    }
    // Intentionally mount-only: further mode changes are persisted by the
    // effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    localStorage.setItem('sra-demo-mode', mode)
  }, [mode])

  // Reset recipient defaults when the run mode changes. Simulated re-seeds
  // Vitalik's address so the widget works without input; mainnet clears the
  // recipient so the user MUST enter their own address before a real deposit
  // address is generated.
  const switchMode = (next: DemoMode) => {
    if (next === mode) return
    setMode(next)
    // Fresh mode = fresh session, so the widget always re-opens.
    setSraOpen(true)
    if (next === 'simulated') {
      setRecipient(SIMULATED_DEFAULT_RECIPIENT)
      setDraftRecipient(SIMULATED_DEFAULT_RECIPIENT)
    } else {
      // Restore the last mainnet address the user committed this session
      // so they don't have to re-enter it after visiting simulated mode.
      const restored = lastMainnetRecipient ?? ''
      setRecipient(restored)
      setDraftRecipient(restored)
    }
  }

  const draftValid = isAddress(draftRecipient)
  const showError = draftRecipient !== '' && !draftValid
  const dirty =
    draftRecipient !== recipient ||
    draftChain !== targetChainId ||
    draftSlippage !== slippage
  const destChain = CHAINS.find((c) => c.id === draftChain)

  const save = () => {
    if (!draftValid) return
    const next = draftRecipient as Address
    setRecipient(next)
    // Snapshot the mainnet recipient so it survives a simulated round trip.
    if (mode === 'mainnet') setLastMainnetRecipient(next)
    setTargetChainId(draftChain)
    setSlippage(draftSlippage)
  }

  const config = useMemo<SmartRoutingAddressConfig>(
    () => ({
      targetChainId,
      slippage,
      // Fiat onramp is partner-gated (needs a KYB'd Transak key + secret).
      // Widget URLs must be minted server-side (Transak refuses plain
      // apiKey iframes), so the widget calls our /api/transak-session route
      // — the same recipe a real host implements on their backend. Without
      // env credentials the route 501s and the sheet shows its error state.
      ...(mockOnramp && {
        onramp: {
          getWidgetUrl: async (params: OnrampWidgetParams) => {
            const res = await fetch('/api/transak-session', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(params),
            })
            if (!res.ok) throw new Error(`transak session: ${res.status}`)
            const { widgetUrl } = (await res.json()) as { widgetUrl: string }
            return widgetUrl
          },
        },
      }),
    }),
    [targetChainId, slippage, mockOnramp],
  )

  const recipientReady = isAddress(recipient)

  return (
    <main>
      {/* Persistent warning strip on mainnet mode — reminder that this is a
          live SRA path and any deposit sent to the generated address is real. */}
      {mode === 'mainnet' && (
        <div className="w-full bg-danger/10 px-8 py-2.5 text-center text-[13px] font-semibold text-danger">
          Live SRA — real funds will be routed. Verify the delivery address
          before sending.
        </div>
      )}

      {/* Remount only on the two axes where re-instantiating the widget is
          the goal: switching mock lifecycle (`mode`) and the mock-controls
          reset (`mockNonce`). Recipient / chain / slippage flow through as
          `config` prop updates — the provider refetches internally, so the
          picker's token/chain selection survives "Save & regenerate". */}
      <SmartRoutingAddressProvider key={`${mode}-${mockNonce}`} config={config}>
        {mode === 'simulated' && <SimulatedCopyGuard />}
        {/* Grid uses an arbitrary breakpoint of 900px — Tailwind's default
            `md` (768) is too eager and `lg` (1024) too late for this
            two-column ↔ stacked flip. */}
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-start justify-items-center gap-10 px-8 pt-12 pb-16 min-[900px]:grid-cols-[minmax(0,1fr)_400px] min-[900px]:gap-16 min-[900px]:justify-items-stretch">
          <section className="flex max-w-[480px] flex-col gap-8">
            {/* Mode toggle — segmented control. Default is `simulated`; the
                user has to explicitly flip to `mainnet` to unlock the real
                SRA path. Kept above the header so it's the first thing seen. */}
            <div className="inline-flex self-start rounded-full border border-border-warm bg-white/55 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => switchMode('simulated')}
                className={`cursor-pointer rounded-full px-4 py-1.5 transition-colors ${
                  mode === 'simulated'
                    ? 'bg-ink text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Simulated
              </button>
              <button
                type="button"
                onClick={() => switchMode('mainnet')}
                className={`cursor-pointer rounded-full px-4 py-1.5 transition-colors ${
                  mode === 'mainnet'
                    ? 'bg-danger text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Mainnet
              </button>
            </div>

            <header className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9c958c]">
                Interactive demo
              </span>
              <h1 className="m-0 text-[clamp(34px,4vw,48px)] font-bold leading-[1.05] tracking-tight">
                Smart Routing Address UI
              </h1>
              <p className="m-0 max-w-[48ch] text-base leading-[1.6] text-muted">
                A pre-built, customizable React UI for ZeroDev Smart Routing
                Address — the whole deposit flow, ready to drop into your app
                and cut the funding friction that hurts onboarding conversion.
              </p>
              {/* "React package coming soon" chip — only shown in simulated
                  mode so nothing implies the mainnet flow is a prototype. */}
              {mode === 'simulated' && (
                <span className="mt-0.5 inline-flex items-center gap-[7px] self-start rounded-full border border-border-warm bg-white/55 px-[11px] py-[5px] text-xs font-semibold tracking-[0.01em] text-muted">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                  React package coming soon
                </span>
              )}
            </header>

            {/* Simulated wallet — mock fetch layer intercepts every SRA
                server call, so this whole path drives fake deposits through
                the widget. Only mounted in simulated mode so its banner
                (which claims the address can't receive real funds) can't
                mislead mainnet users. */}
            {mode === 'simulated' && (
              <MockPanel
                destChainId={targetChainId}
                regenerate={regenerate}
                mockErrorMode={mockErrorMode}
                setMockErrorMode={setMockErrorMode}
                mockSponsored={mockSponsored}
                setMockSponsored={setMockSponsored}
                mockOnramp={mockOnramp}
                setMockOnramp={setMockOnramp}
                controlsOpen={mockControlsOpen}
                setControlsOpen={setMockControlsOpen}
              />
            )}

            {/* Mainnet mode primer — a compact info card that replaces the
                Simulated wallet. Reminds the user to set their own delivery
                address and send only from the source chain the widget picked. */}
            {mode === 'mainnet' && (
              <div className="flex flex-col gap-3 rounded-2xl border border-danger/35 bg-danger/5 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  <span className="text-sm font-semibold text-danger">
                    Live mode
                  </span>
                </div>
                <p className="m-0 text-sm leading-[1.5] text-ink">
                  The widget now speaks to the live SRA server. Any address it
                  generates is a real deposit address — funds sent to it are
                  routed on-chain.
                </p>
                <ol className="m-0 ml-4 flex list-decimal flex-col gap-1 text-sm leading-[1.5] text-ink">
                  <li>
                    Open <b>Settings</b> below and set <b>Delivery address</b>{' '}
                    to your own address.
                  </li>
                  <li>
                    Click <b>Save &amp; regenerate address</b>.
                  </li>
                  <li>
                    Send only from the source chain the widget selected under{' '}
                    <b>Send</b>, at least the shown <b>Min deposit</b>.
                  </li>
                  <li>Start with a small test amount.</li>
                </ol>
              </div>
            )}

            {/* `group` lets the summary chevron rotate on `[open]` via the
                `group-open:` variant. `<details>` list styles + webkit marker
                are neutralised globally in `globals.css`. */}
            <details
              open
              className="group overflow-hidden rounded-2xl border border-border-warm bg-white/55"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold">
                Settings
                <span className="text-lg text-muted transition-transform duration-150 group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="flex flex-col gap-[22px] px-5 pt-1 pb-5">
                <label className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between text-sm font-semibold">
                    Delivery address
                  </span>
                  <input
                    value={draftRecipient}
                    onChange={(e) => setDraftRecipient(e.target.value.trim())}
                    placeholder="0x…"
                    spellCheck={false}
                    className="rounded-lg border border-border-warm bg-white px-3.5 py-3 font-mono text-sm text-ink outline-primary data-[invalid=true]:border-danger"
                    data-invalid={showError}
                  />
                  <span
                    className={`text-[13px] ${showError ? 'text-danger' : 'text-muted'}`}
                  >
                    {showError
                      ? 'Not a valid address'
                      : mode === 'mainnet'
                        ? 'Real funds sent to the generated address are routed to this account. Use your own address.'
                        : 'Generated deposit addresses route funds to this account.'}
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between text-sm font-semibold">
                    Destination chain
                  </span>
                  {/* `appearance-none` strips the native OS dropdown arrow so
                      the sibling `›` chevron below (rotated 90° to point down)
                      matches the Settings / Mock controls summaries. */}
                  <div className="relative">
                    <select
                      value={draftChain}
                      onChange={(e) => setDraftChain(Number(e.target.value))}
                      className="w-full appearance-none rounded-lg border border-border-warm bg-white px-3.5 py-3 pr-9 text-sm text-ink outline-primary"
                    >
                      {CHAINS.map((chain) => (
                        <option key={chain.id} value={chain.id}>
                          {chain.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-lg text-muted"
                      aria-hidden
                    >
                      ›
                    </span>
                  </div>
                  <span className="text-[13px] text-muted">
                    Where deposits settle, regardless of which chain the funds
                    are sent from.
                  </span>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="flex items-baseline justify-between text-sm font-semibold">
                    Max slippage
                    <span className="text-muted tabular-nums">
                      {`${(draftSlippage / 100).toFixed(2)}%`}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={draftSlippage}
                    onChange={(e) => setDraftSlippage(Number(e.target.value))}
                    className="w-full accent-ink"
                  />
                  <span className="text-[13px] text-muted">
                    Max price movement tolerated while swapping. A tighter value
                    protects the price but raises the minimum deposit, and can
                    make it fluctuate significantly with gas.
                  </span>
                </label>

                <div className="flex flex-col gap-1 rounded-2xl border border-border-warm bg-[rgba(231,226,221,0.35)] px-[18px] py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                    Routing to
                  </span>
                  {draftValid ? (
                    <p className="m-0 text-[15px] leading-[1.5]">
                      <code className="font-mono text-sm">
                        {shortAddress(draftRecipient)}
                      </code>{' '}
                      on <b>{destChain?.name ?? `chain ${draftChain}`}</b>
                    </p>
                  ) : (
                    <p className="m-0 text-[15px] leading-[1.5] text-muted">
                      Enter a valid address to set a destination.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-ink bg-ink px-4 py-3 text-sm font-semibold text-white transition-[opacity,background-color] duration-150 hover:not-disabled:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={save}
                  disabled={!dirty || !draftValid}
                >
                  {dirty ? 'Save & regenerate address' : 'Saved'}
                </button>
              </div>
            </details>
          </section>

          <aside className="justify-self-center min-[900px]:justify-self-end">
            {!sraOpen ? (
              // Widget dismissed via TopNav's X — surface an explicit
              // re-open trigger so the user can bring it back without a
              // full page reload. Mirrors the "Reconnect" pattern in
              // zerodev-signer-demo after logout: the outer wrapper
              // preserves the SRA card's footprint so the surrounding
              // layout doesn't reflow when the widget is closed.
              <FundReopenCard
                recipient={recipientReady ? (recipient as Address) : undefined}
                onOpen={() => setSraOpen(true)}
              />
            ) : recipientReady ? (
              <SmartRoutingAddress
                recipient={recipient as Address}
                onClose={() => setSraOpen(false)}
              />
            ) : (
              // Mainnet mode without a recipient — inline entry point so the
              // user can seed the address here without opening Settings.
              // Shares `draftRecipient` state with the Settings panel so both
              // stay in sync; saving here is equivalent to Save & regenerate.
              <div className="flex h-[600px] w-[400px] max-w-full flex-col items-center justify-center gap-4 rounded-4xl border border-border-warm bg-white/55 p-8">
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[15px] font-semibold text-ink">
                    Enter a delivery address
                  </span>
                  <span className="text-sm text-muted">
                    Funds routed via this widget will land here.
                  </span>
                </div>
                <input
                  value={draftRecipient}
                  onChange={(e) => setDraftRecipient(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftValid) save()
                  }}
                  placeholder="0x…"
                  spellCheck={false}
                  className="w-full rounded-xl border border-border-warm bg-white px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none focus:border-ink"
                />
                {showError && (
                  <span className="text-xs text-danger">
                    That doesn't look like a valid address.
                  </span>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={!draftValid}
                  className="w-full cursor-pointer rounded-xl bg-ink px-[18px] py-[13px] text-[15px] font-semibold text-white transition-opacity duration-150 hover:not-disabled:bg-[#2a1d12] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Generate deposit address
                </button>
              </div>
            )}
          </aside>
        </div>
      </SmartRoutingAddressProvider>
    </main>
  )
}

/**
 * Re-open card shown while the widget is dismissed — and a live demo of the
 * companion-hook split. Hovering (or focusing) "+ Fund" pre-creates the
 * deposit address via `useCreateSmartRoutingAddress().getOrCreateAddress` (the
 * write half), while the status line mirrors `addressState` from
 * `useSmartRoutingAddress` (the read half) so the pre-warm is visible:
 * idle → creating → ready before the click ever lands. `getOrCreateAddress` is
 * idempotent per recipient, so repeated hovers are free.
 */
function FundReopenCard({
  recipient,
  onOpen,
}: {
  /** Undefined while no valid recipient is set (mainnet before entry). */
  recipient: Address | undefined
  onOpen: () => void
}) {
  const { addressState } = useSmartRoutingAddress()
  const { getOrCreateAddress } = useCreateSmartRoutingAddress()

  const prewarm = () => {
    // Failures surface via `addressState`; swallow the rejection here.
    if (recipient) getOrCreateAddress(recipient).catch(() => {})
  }

  const status =
    addressState.status === 'success'
      ? 'Deposit address ready ✓'
      : addressState.status === 'loading'
        ? 'Creating deposit address…'
        : addressState.status === 'error'
          ? 'Address creation failed — opening will retry'
          : recipient
            ? 'Hover to pre-create the deposit address'
            : null

  return (
    <div className="flex h-[810px] w-[400px] max-w-full flex-col items-center justify-center gap-3">
      <button
        type="button"
        onMouseEnter={prewarm}
        onFocus={prewarm}
        onClick={onOpen}
        className="cursor-pointer rounded-3xl bg-ink px-8 py-4 text-body1 font-semibold text-white hover:bg-[#2a1c13]"
      >
        + Fund
      </button>
      {status && (
        <span
          aria-live="polite"
          className={`text-xs ${addressState.status === 'success' ? 'text-ink' : 'text-muted'}`}
        >
          {status}
        </span>
      )}
    </div>
  )
}

/**
 * Simulated-mode safety net: whenever the user copies the deposit address,
 * pop a browser alert reminding them not to send real funds. Covers both
 * copy paths — text-selection (Cmd+C) via a document `copy` listener, and
 * the QR sheet's button (which calls `navigator.clipboard.writeText`
 * directly) via a wrapper that restores on unmount.
 */
function SimulatedCopyGuard() {
  const { addressState } = useSmartRoutingAddress()
  const address =
    addressState.status === 'success' ? addressState.address : undefined

  useEffect(() => {
    if (!address) return
    const addrLower = address.toLowerCase()
    const WARNING =
      'This is a simulated-mode deposit address. Do not send real funds to it — status updates are mocked. Use the simulated wallet in the demo to preview the flow.'

    const looksLikeThisAddress = (text: string) =>
      text.toLowerCase().includes(addrLower)

    const onCopy = (e: ClipboardEvent) => {
      const text =
        e.clipboardData?.getData('text') ??
        window.getSelection()?.toString() ??
        ''
      if (text && looksLikeThisAddress(text)) window.alert(WARNING)
    }
    document.addEventListener('copy', onCopy)

    const original = navigator.clipboard?.writeText?.bind(navigator.clipboard)
    if (original) {
      navigator.clipboard.writeText = async (text: string) => {
        if (typeof text === 'string' && looksLikeThisAddress(text)) {
          window.alert(WARNING)
        }
        return original(text)
      }
    }

    return () => {
      document.removeEventListener('copy', onCopy)
      if (original) navigator.clipboard.writeText = original
    }
  }, [address])

  return null
}
