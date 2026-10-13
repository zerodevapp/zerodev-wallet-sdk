'use client'

import { useSmartRoutingAddress } from '@zerodev/smart-routing-address-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAddress, parseUnits } from 'viem'
import { base } from 'viem/chains'
import {
  createSimulation,
  loadPastDeposits,
  type MockErrorMode,
  type MockStage,
  savePastDeposits,
  setMockDeposits,
} from '../mock'
import { MockControls } from './MockControls'

// Fallback route used before the widget has seeded a picker selection:
// 250 USDC on Base. Once `activeRoute` populates from the widget's picker,
// the simulation switches to whatever token/chain the user chose.
const FALLBACK = {
  sourceChainId: base.id,
  sourceChainName: 'Base',
  symbol: 'USDC',
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const, // USDC on Base
  decimals: 6,
  feeAmount: '250000', // 0.25 USDC
}
const AMOUNT_WHOLE = '250'

const STEP_LABELS: Record<MockStage, string> = {
  pending: 'Deposit detected — confirming…',
  bridging: 'Routing across chains…',
  completed: 'Sent — track it in the widget.',
}

const DOT_COLOR: Record<'idle' | MockStage, string> = {
  idle: 'bg-muted',
  pending: 'bg-primary animate-mock-pulse',
  bridging: 'bg-primary animate-mock-pulse',
  completed: 'bg-[#6bb04f]',
}

export function MockPanel({
  destChainId,
  regenerate,
  mockErrorMode,
  setMockErrorMode,
  mockSponsored,
  setMockSponsored,
  controlsOpen,
  setControlsOpen,
}: {
  destChainId: number
  regenerate: () => void
  mockErrorMode: MockErrorMode
  setMockErrorMode: (mode: MockErrorMode) => void
  mockSponsored: boolean
  setMockSponsored: (value: boolean) => void
  controlsOpen: boolean
  setControlsOpen: (open: boolean) => void
}) {
  const { addressState, activeRoute } = useSmartRoutingAddress()
  const route = activeRoute ?? FALLBACK
  const [sim, setSim] = useState<'idle' | MockStage>('idle')
  const [pasted, setPasted] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id)
    timers.current = []
  }, [])

  useEffect(() => {
    // Mock fetch lifecycle is owned by the page (installed on simulated
    // mode, uninstalled on mainnet). Here we just seed the widget with any
    // past deposits already persisted from a prior simulation run.
    setMockDeposits(loadPastDeposits())
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const address =
    addressState.status === 'success' ? addressState.address : undefined
  const pastedOk =
    // Compare case-insensitively so pastes from mixed-case sources still
    // match. `strict: false` accepts either form.
    isAddress(pasted.trim(), { strict: false }) &&
    !!address &&
    pasted.trim().toLowerCase() === address.toLowerCase()
  const running = sim === 'pending' || sim === 'bridging'
  const amountLabel = `${AMOUNT_WHOLE} ${route.symbol}`

  const simulate = useCallback(() => {
    clearTimers()
    const past = loadPastDeposits()
    const params = {
      sourceChainId: route.sourceChainId,
      token: route.token,
      amount: parseUnits(AMOUNT_WHOLE, route.decimals).toString(),
      feeAmount: route.feeAmount,
      destChainId,
      // Simulation reuses the source token address on the destination side;
      // the widget only cares that fields resolve, not that this is realistic
      // for every chain.
      outputToken: route.token,
    }
    const { snapshot } = createSimulation(params)

    setMockDeposits([snapshot('pending'), ...past])
    setSim('pending')
    timers.current.push(
      setTimeout(() => {
        setMockDeposits([snapshot('bridging'), ...past])
        setSim('bridging')
      }, 3000),
    )
    timers.current.push(
      setTimeout(() => {
        const settled = [snapshot('completed'), ...past]
        savePastDeposits(settled)
        setMockDeposits(settled)
        setSim('completed')
      }, 6500),
    )
  }, [destChainId, clearTimers, route])

  const hint = !address
    ? 'Generating your deposit address…'
    : running || sim === 'completed'
      ? STEP_LABELS[sim as MockStage]
      : pasted.trim() === ''
        ? 'Paste the widget address to simulate a deposit.'
        : pastedOk
          ? null
          : "That doesn't match your deposit address."

  return (
    <ol className="m-0 flex list-none flex-col gap-5 p-0">
      <li className="flex items-start gap-4">
        <StepNum>1</StepNum>
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[15px] font-semibold">
            Choose token &amp; network
          </span>
          <span className="text-sm leading-[1.5] text-muted">
            Fees and arrival time update live as the route changes.
          </span>
        </div>
      </li>

      <li className="flex items-start gap-4">
        <StepNum>2</StepNum>
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <span className="text-[15px] font-semibold">Send to the address</span>
          <span className="text-sm leading-[1.5] text-muted">
            Copy it into any wallet. Deposits are detected automatically.
          </span>

          {/* Demo-only warning — matches the reference's `pg__warn` banner.
              Red-tinted callout: the simulated demo returns a real SRA
              address (server passthrough), so real funds sent to it would
              route. Only status updates below are mocked. */}
          <p className="mt-2 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2.5 text-xs leading-[1.5] text-ink">
            <b className="text-danger">Demo only.</b> This is a real deposit
            address — the demo only mocks the status updates below. Never send
            real assets to it; use the simulated wallet to preview the flow.
          </p>

          {/* Warm gradient + peach border + orange-tinted shadow — matches
              the reference's `pg__wallet` styling. The multi-layer gradient
              is expressed via inline style (Tailwind arbitrary values get
              unreadable with commas across two gradient layers). */}
          <div
            className="mt-2 flex flex-col gap-3.5 rounded-[18px] border border-[#f0d9c6] p-[18px] shadow-[0_10px_30px_-16px_rgba(231,96,0,0.25)]"
            style={{
              background:
                'radial-gradient(120% 80% at 0% 0%, #fff5ec 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold">
                Simulated wallet
              </span>
              {/* Amber "Simulated" tag — separate palette from the primary
                  orange used elsewhere so it doesn't compete with the CTA. */}
              <span className="rounded-full bg-[#fbf3e2] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-[#b97c10]">
                Simulated
              </span>
            </div>

            <div className="flex items-center gap-2 py-0.5">
              <span className="text-[34px] font-semibold leading-none tabular-nums">
                {AMOUNT_WHOLE}
              </span>
              <span className="text-[17px] font-semibold text-muted">
                {route.symbol}
              </span>
              <span className="ml-auto text-[13px] text-muted">
                on {route.sourceChainName}
              </span>
            </div>

            {/* Inline row: label + input on the same line inside a bordered
                wrapper, matches `pg__wallet-field`. `data-ok=true` on the
                wrapper flips the border to green. */}
            <label
              data-ok={pastedOk}
              className="flex items-center gap-2.5 rounded-xl border border-border-warm bg-white px-3.5 py-2.5 transition-colors data-[ok=true]:border-[#2e8b57]"
            >
              <span className="text-[13px] font-semibold text-muted">To</span>
              <input
                className="min-w-0 flex-1 border-none bg-transparent font-mono text-[13px] text-ink outline-none"
                value={pasted}
                onChange={(e) => setPasted(e.target.value.trim())}
                placeholder="Paste your deposit address"
                spellCheck={false}
              />
              {pastedOk && (
                <span className="font-bold text-[#2e8b57]" aria-hidden="true">
                  ✓
                </span>
              )}
            </label>

            <button
              type="button"
              className="cursor-pointer rounded-xl bg-ink px-[18px] py-[13px] text-[15px] font-semibold text-white transition-[opacity,background-color] duration-150 hover:not-disabled:bg-[#2a1d12] disabled:cursor-not-allowed disabled:opacity-45"
              onClick={simulate}
              disabled={!pastedOk}
            >
              {running ? `Send another ${amountLabel}` : `Send ${amountLabel}`}
            </button>

            {hint && (
              <p className="m-0 flex items-center gap-2 text-[13px] text-muted">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[sim]}`}
                />
                {hint}
              </p>
            )}
          </div>
        </div>
      </li>

      <li className="flex items-start gap-4">
        <StepNum>3</StepNum>
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <span className="text-[15px] font-semibold">
            Try modifying the experience
          </span>
          <span className="text-sm leading-[1.5] text-muted">
            Adjust the max slippage or destination chain in <b>Settings</b>{' '}
            below, then open <b>Mock controls</b> to preview how the widget
            handles errors, sponsored fees and past deposits.
          </span>
          <MockControls
            destChainId={destChainId}
            regenerate={regenerate}
            errorMode={mockErrorMode}
            setErrorMode={setMockErrorMode}
            sponsored={mockSponsored}
            setSponsored={setMockSponsored}
            open={controlsOpen}
            setOpen={setControlsOpen}
          />
        </div>
      </li>
    </ol>
  )
}

/** Numbered circle used at the start of each guided-flow step. */
function StepNum({ children }: { children: string }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white tabular-nums">
      {children}
    </span>
  )
}
