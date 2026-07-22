'use client'

import { useSmartRoutingAddress } from '@zerodev/smart-routing-address-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAddress, parseUnits } from 'viem'
import { base } from 'viem/chains'
import {
  createSimulation,
  installMockFetch,
  loadPastDeposits,
  type MockStage,
  savePastDeposits,
  setMockDeposits,
  uninstallMockFetch,
} from '../mock'

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

export function MockPanel({ destChainId }: { destChainId: number }) {
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
    installMockFetch()
    setMockDeposits(loadPastDeposits())
    return () => {
      clearTimers()
      uninstallMockFetch()
    }
  }, [clearTimers])

  const address =
    addressState.status === 'success' ? addressState.address : undefined
  const pastedOk =
    isAddress(pasted.trim()) &&
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
    <div className="pg__wallet">
      <div className="pg__wallet-head">
        <span className="pg__wallet-title">Simulated wallet</span>
        <span className="pg__wallet-tag">Simulated</span>
      </div>

      <div className="pg__wallet-amount">
        <span className="pg__wallet-value">{AMOUNT_WHOLE}</span>
        <span className="pg__wallet-symbol">{route.symbol}</span>
        <span className="pg__wallet-net">on {route.sourceChainName}</span>
      </div>

      <label className="pg__wallet-field" data-ok={pastedOk}>
        <span className="pg__wallet-field-label">To</span>
        <input
          className="pg__wallet-input"
          value={pasted}
          onChange={(e) => setPasted(e.target.value.trim())}
          placeholder="Paste your deposit address"
          spellCheck={false}
        />
        {pastedOk && (
          <span className="pg__wallet-ok" aria-hidden="true">
            ✓
          </span>
        )}
      </label>

      <button
        type="button"
        className="pg__wallet-send"
        onClick={simulate}
        disabled={!pastedOk}
      >
        {running ? `Send another ${amountLabel}` : `Send ${amountLabel}`}
      </button>

      {hint && (
        <p className="pg__mock-status" data-stage={sim}>
          <span className="pg__mock-dot" />
          {hint}
        </p>
      )}
    </div>
  )
}
