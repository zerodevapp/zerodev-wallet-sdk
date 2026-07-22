'use client'

import { useSmartRoutingAddress } from '@zerodev/smart-routing-address-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAddress, parseUnits } from 'viem'
import { arbitrum, base } from 'viem/chains'
import {
  createSimulation,
  installMockFetch,
  loadPastDeposits,
  type MockStage,
  savePastDeposits,
  setMockDeposits,
  uninstallMockFetch,
} from '../mock'

// Hardcoded simulation: 250 USDC on Base → destination chain from the widget's
// config. Real SRA has to expose the currently-selected picker route for the
// mock to mirror the user's choice; until it does, this is honest enough for
// a "here's what a deposit looks like" preview.
const SOURCE_CHAIN_ID = base.id
const SOURCE_CHAIN_NAME = 'Base'
const TOKEN_SYMBOL = 'USDC'
// USDC on Base
const SOURCE_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TOKEN_DECIMALS = 6
const AMOUNT_WHOLE = '250'
const FEE_AMOUNT = '250000' // 0.25 USDC

const STEP_LABELS: Record<MockStage, string> = {
  pending: 'Deposit detected — confirming…',
  bridging: 'Routing across chains…',
  completed: 'Sent — track it in the widget.',
}

export function MockPanel({ destChainId }: { destChainId: number }) {
  const { addressState } = useSmartRoutingAddress()
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
  const amountLabel = `${AMOUNT_WHOLE} ${TOKEN_SYMBOL}`

  const simulate = useCallback(() => {
    clearTimers()
    const past = loadPastDeposits()
    const params = {
      sourceChainId: SOURCE_CHAIN_ID,
      token: SOURCE_TOKEN_ADDRESS,
      amount: parseUnits(AMOUNT_WHOLE, TOKEN_DECIMALS).toString(),
      feeAmount: FEE_AMOUNT,
      destChainId,
      // Simulation reuses the source token address on the destination side;
      // the widget only cares that fields resolve, not that this is realistic
      // for every chain.
      outputToken: SOURCE_TOKEN_ADDRESS,
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
  }, [destChainId, clearTimers])

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
        <span className="pg__wallet-symbol">{TOKEN_SYMBOL}</span>
        <span className="pg__wallet-net">on {SOURCE_CHAIN_NAME}</span>
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
