'use client'

import {
  SmartRoutingAddress,
  type SmartRoutingAddressConfig,
  SmartRoutingAddressProvider,
} from '@zerodev/smart-routing-address-react-ui'
import { useMemo, useState } from 'react'
import type { Chain } from 'viem'
import { type Address, isAddress } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import { MockPanel } from './components/MockPanel'

// Vitalik's address — a valid, well-known target so the widget renders
// immediately without the user typing anything.
const DEFAULT_RECIPIENT: Address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

// Destination chains offered in the "Advanced settings" configurator.
const CHAINS: Chain[] = [arbitrum, base, optimism, polygon, mainnet]

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export default function Home() {
  // Applied config drives the widget. Draft state below is edited freely and
  // only applied (regenerating the routing address) when "Save & regenerate"
  // is clicked.
  const [recipient, setRecipient] = useState<Address>(DEFAULT_RECIPIENT)
  const [targetChainId, setTargetChainId] = useState<number>(arbitrum.id)
  const [slippage, setSlippage] = useState<number>(50)

  const [draftRecipient, setDraftRecipient] =
    useState<string>(DEFAULT_RECIPIENT)
  const [draftChain, setDraftChain] = useState<number>(targetChainId)
  const [draftSlippage, setDraftSlippage] = useState<number>(slippage)

  const draftValid = isAddress(draftRecipient)
  const showError = draftRecipient !== '' && !draftValid
  const dirty =
    draftRecipient !== recipient ||
    draftChain !== targetChainId ||
    draftSlippage !== slippage
  const destChain = CHAINS.find((c) => c.id === draftChain)

  const save = () => {
    if (!draftValid) return
    setRecipient(draftRecipient as Address)
    setTargetChainId(draftChain)
    setSlippage(draftSlippage)
  }

  const config = useMemo<SmartRoutingAddressConfig>(
    () => ({ targetChainId, slippage }),
    [targetChainId, slippage],
  )

  return (
    <main className="pg">
      {/* Key on recipient+chain+slippage so the whole SRA subtree resets
          (including provider state) when the user regenerates — otherwise
          stale addresses can persist across config changes. */}
      <SmartRoutingAddressProvider
        key={`${recipient}-${targetChainId}-${slippage}`}
        config={config}
      >
        <div className="pg__inner">
          <section className="pg__config">
            <header className="pg__intro">
              <span className="pg__eyebrow">Interactive demo</span>
              <h1 className="pg__title">Smart Routing Address UI</h1>
              <p className="pg__lede">
                A pre-built, customizable React UI for ZeroDev Smart Routing
                Address — the whole deposit flow, ready to drop into your app.
              </p>
              <p className="pg__lede">
                Install it, make it your own, and cut the funding friction that
                hurts onboarding conversion.
              </p>
            </header>

            <ol className="pg__steps">
              <li className="pg__step">
                <span className="pg__step-num">1</span>
                <div className="pg__step-body">
                  <span className="pg__step-title">
                    Choose token &amp; network
                  </span>
                  <span className="pg__step-text">
                    Fees and arrival time update live as the route changes.
                  </span>
                </div>
              </li>
              <li className="pg__step">
                <span className="pg__step-num">2</span>
                <div className="pg__step-body">
                  <span className="pg__step-title">Send to the address</span>
                  <span className="pg__step-text">
                    Copy it into any wallet. Deposits are detected
                    automatically.
                  </span>
                  {/* Simulated wallet — copy the widget's deposit address into
                      the input below and click Send to see a fake deposit flow
                      through the widget's status view. */}
                  <MockPanel destChainId={targetChainId} />
                </div>
              </li>
              <li className="pg__step">
                <span className="pg__step-num">3</span>
                <div className="pg__step-body">
                  <span className="pg__step-title">
                    Funds arrive on your chain
                  </span>
                  <span className="pg__step-text">
                    We swap and bridge in the background, delivering to the
                    target chain in seconds.
                  </span>
                </div>
              </li>
            </ol>

            <details className="pg__advanced">
              <summary className="pg__advanced-summary">
                Advanced settings
              </summary>
              <div className="pg__panel">
                <label className="pg__field">
                  <span className="pg__label">Delivery address</span>
                  <input
                    value={draftRecipient}
                    onChange={(e) => setDraftRecipient(e.target.value.trim())}
                    placeholder="0x…"
                    spellCheck={false}
                    className="pg__input pg__input--mono"
                    data-invalid={showError}
                  />
                  <span className="pg__hint">
                    {showError
                      ? 'Not a valid address'
                      : 'Generated deposit addresses route funds to this account.'}
                  </span>
                </label>

                <label className="pg__field">
                  <span className="pg__label">Destination chain</span>
                  <select
                    value={draftChain}
                    onChange={(e) => setDraftChain(Number(e.target.value))}
                    className="pg__input"
                  >
                    {CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name}
                      </option>
                    ))}
                  </select>
                  <span className="pg__hint">
                    Where deposits settle, regardless of which chain the funds
                    are sent from.
                  </span>
                </label>

                <label className="pg__field">
                  <span className="pg__label">
                    Max slippage
                    <span className="pg__label-aside">
                      {(draftSlippage / 100).toFixed(2)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={10}
                    value={draftSlippage}
                    onChange={(e) => setDraftSlippage(Number(e.target.value))}
                    className="pg__range"
                  />
                  <span className="pg__hint">
                    Max price movement tolerated while swapping. Lower protects
                    the price but raises the minimum deposit; higher lowers it.
                  </span>
                </label>

                <div className="pg__summary" data-ok={draftValid}>
                  <span className="pg__summary-label">Routing to</span>
                  {draftValid ? (
                    <p className="pg__summary-text">
                      <code>{shortAddress(draftRecipient)}</code> on{' '}
                      <b>{destChain?.name ?? `chain ${draftChain}`}</b>
                    </p>
                  ) : (
                    <p className="pg__summary-text pg__summary-text--muted">
                      Enter a valid address to set a destination.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="pg__save-btn"
                  onClick={save}
                  disabled={!dirty || !draftValid}
                >
                  {dirty ? 'Save & regenerate address' : 'Saved'}
                </button>
              </div>
            </details>
          </section>

          <aside className="pg__widget">
            <SmartRoutingAddress
              recipient={recipient}
              onClose={() => {
                /* no-op — this demo has nowhere to navigate to */
              }}
              onHelp={() => {
                /* no-op — surfaces the ? icon in TopNav's left slot */
              }}
            />
          </aside>
        </div>
      </SmartRoutingAddressProvider>
    </main>
  )
}
