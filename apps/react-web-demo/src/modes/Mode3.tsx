/**
 * Mode 3: Custom Flow + Our Components
 *
 * No automatic interception — the dev controls the flow.
 * Uses <SignatureRequest /> in CONTROLLED mode (with props).
 * The component is purely presentational — it renders tx details
 * and calls onConfirm/onReject. No store interaction.
 *
 * Note: No <SignatureRequest /> calls register(), so
 * userConfirmationListenerActive stays false and onBeforeRequest
 * passes through — sendTransaction fires immediately.
 */
import { useState } from 'react'
import { parseEther } from 'viem'
import { useAccount, useSendTransaction } from 'wagmi'
import { SignatureRequest } from '../SignatureRequest'

export function Mode3() {
  const { address } = useAccount()
  const { sendTransaction, isPending, isSuccess, isError, error, data } =
    useSendTransaction()
  const [pendingTx, setPendingTx] = useState<{
    method: string
    params: { to: string; value: bigint; data: string }
  } | null>(null)

  const handleSend = () => {
    setPendingTx({
      method: 'eth_sendTransaction',
      params: { to: address!, value: parseEther('0'), data: '0x' },
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        style={btnStyle}
      >
        {isPending ? 'Sending...' : 'Send Transaction'}
      </button>

      {isSuccess && (
        <p style={{ color: '#4ade80', fontSize: 13, marginTop: 8 }}>
          tx: {data}
        </p>
      )}
      {isError && (
        <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>
          {error?.message}
        </p>
      )}

      {/* Controlled mode — dev decides when to show, component just renders */}
      {pendingTx && (
        <SignatureRequest
          method={pendingTx.method}
          params={pendingTx.params}
          onConfirm={() => {
            sendTransaction({
              to: pendingTx.params.to as `0x${string}`,
              value: pendingTx.params.value,
              data: pendingTx.params.data as `0x${string}`,
            })
            setPendingTx(null)
          }}
          onReject={() => setPendingTx(null)}
        />
      )}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#4f46e5',
  color: 'white',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}
