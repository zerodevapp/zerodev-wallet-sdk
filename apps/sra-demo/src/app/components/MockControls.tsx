'use client'

import { useSmartRoutingAddress } from '@zerodev/smart-routing-address-react-ui'
import {
  buildMockDeposits,
  clearMockDeposits,
  insertMockDeposits,
  type MockErrorMode,
  type MockSimulationParams,
  setMockErrorMode,
  setMockSponsored,
  simParamsFromRoute,
} from '../mock'

/**
 * Developer-only controls for exercising the widget against mock data and
 * error states without sending real funds: seed / clear "Past deposits",
 * pick one of the three widget error surfaces to preview, and toggle
 * sponsored fees.
 *
 * `regenerate` bumps the demo's SRA provider key so any freshly-inserted
 * deposits re-baseline as "past" — the widget only treats deposits seen
 * after mount as active/in-flight — and so error-mode / sponsored toggles
 * take effect immediately.
 */
export function MockControls({
  destChainId,
  regenerate,
  errorMode,
  setErrorMode,
  sponsored,
  setSponsored,
  onramp,
  setOnramp,
  open,
  setOpen,
}: {
  destChainId: number
  regenerate: () => void
  /** Toggle state lifted to the demo root so it survives widget re-mounts.
   * The `set*` handlers also update the mock's module-level state via
   * `setMockErrorMode` / `setMockSponsored`. */
  errorMode: MockErrorMode
  setErrorMode: (mode: MockErrorMode) => void
  sponsored: boolean
  setSponsored: (value: boolean) => void
  /** Shows the widget's "Buy with card" (Transak onramp) entry. Pure config
   * state — no mock module involvement, so no regenerate needed. */
  onramp: boolean
  setOnramp: (value: boolean) => void
  /** Open state lifted like the toggles above — an uncontrolled <details>
   * snaps shut whenever an action bumps `mockNonce` and remounts us. */
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { activeRoute } = useSmartRoutingAddress()

  const routeParams = (): MockSimulationParams | null =>
    activeRoute
      ? simParamsFromRoute(
          {
            sourceChainId: activeRoute.sourceChainId,
            token: activeRoute.token,
            decimals: activeRoute.decimals,
            feeAmount: activeRoute.feeAmount,
          },
          destChainId,
        )
      : null

  const insert = (count: number, failed = false) => {
    const params = routeParams()
    if (!params) return
    insertMockDeposits(buildMockDeposits(params, count, { failed }))
    regenerate()
  }

  const clearAll = () => {
    clearMockDeposits()
    regenerate()
  }

  // Radio-style — only one error surface can be active at a time (the mock
  // branches by mode). Clicking the same option again clears it.
  const pickErrorMode = (mode: Exclude<MockErrorMode, 'none'>) => {
    const next = errorMode === mode ? 'none' : mode
    setErrorMode(next)
    setMockErrorMode(next)
    regenerate()
  }

  const toggleSponsored = () => {
    const next = !sponsored
    setSponsored(next)
    setMockSponsored(next)
    regenerate()
  }

  // Orange-tinted border + warm cream background — matches the reference's
  // `pg__dev` panel; visually distinguishes the developer controls from the
  // wallet card above without being obtrusive.
  return (
    <details
      open={open}
      // The browser flips the DOM attribute on summary clicks; onToggle
      // syncs that back into the lifted state so it survives remounts.
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group mt-2 overflow-hidden rounded-xl border border-[rgba(242,108,26,0.28)] bg-[rgba(255,250,245,0.6)]"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-[13px] text-sm font-semibold text-ink group-open:border-b group-open:border-border-warm">
        Mock controls
        <span className="rounded-full bg-[rgba(242,108,26,0.15)] px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.04em] text-primary">
          Active
        </span>
        <span className="ml-auto text-lg text-muted transition-transform duration-150 group-open:rotate-90">
          ›
        </span>
      </summary>

      <div className="flex flex-col gap-5 px-[18px] pt-4 pb-[18px]">
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">Past deposits</span>
            <span className="text-xs text-muted">
              Seed mock history to test the list &amp; pagination.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <MockBtn onClick={() => insert(1)}>Add deposit</MockBtn>
            <MockBtn onClick={() => insert(25)}>Add 25 (paginate)</MockBtn>
            <MockBtn onClick={() => insert(1, true)}>Add failed</MockBtn>
            <MockBtn onClick={clearAll} danger>
              Clear all
            </MockBtn>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">Simulate errors</span>
            <span className="text-xs text-muted">
              Pick one to preview the widget's retry card.
            </span>
          </div>
          <ErrorRadio
            checked={errorMode === 'address-create-failed'}
            onChange={() => pickErrorMode('address-create-failed')}
            label="Address creation fails"
            hint="RPC error on zd_createSmartRoutingAddress"
          />
          <ErrorRadio
            checked={errorMode === 'route-not-found'}
            onChange={() => pickErrorMode('route-not-found')}
            label="No routes found"
            hint="Address created but no bridge quotes"
          />
          <ErrorRadio
            checked={errorMode === 'polling-failed'}
            onChange={() => pickErrorMode('polling-failed')}
            label="Deposit polling fails"
            hint="RPC error on zd_getSmartRoutingAddressStatus"
          />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">Simulate perks</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={sponsored}
              onChange={toggleSponsored}
              className="accent-ink"
            />
            <span>
              <b>Sponsored fees</b> — all fees waived (shows the pill)
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={onramp}
              onChange={() => setOnramp(!onramp)}
              className="mt-0.5 accent-ink"
            />
            <span className="flex flex-col">
              <b>Fiat onramp — shows the "Buy with card" entry</b>
              <span className="text-xs text-muted">
                Opens Transak in-widget. Real purchases need a partner key via{' '}
                <code>NEXT_PUBLIC_TRANSAK_API_KEY</code>; without one the sheet
                shows Transak's invalid-key screen.
              </span>
            </span>
          </label>
          <p className="m-0 text-xs text-muted">
            To preview <b>Failed to deliver</b>, add a failed deposit above and
            open it — it links out to the dashboard.
          </p>
        </section>
      </div>
    </details>
  )
}

function ErrorRadio({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: () => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-ink"
      />
      <span className="flex flex-col">
        <b>{label}</b>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  )
}

function MockBtn({
  children,
  onClick,
  danger,
}: {
  children: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
        danger
          ? 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/15'
          : 'border-border-warm bg-white text-ink hover:bg-white/80'
      }`}
    >
      {children}
    </button>
  )
}
