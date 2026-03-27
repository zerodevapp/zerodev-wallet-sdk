/**
 * Mode 4: Custom Flow + Custom Components
 *
 * No automatic interception, no library UI.
 * Dev handles everything — confirmation UX, flow, rendering.
 * Just uses the wallet connector + standard wagmi hooks.
 */
import { useState } from 'react'
import { parseEther } from 'viem'
import { useAccount, useSendTransaction } from 'wagmi'

export function Mode4() {
  const { address } = useAccount()
  const { sendTransaction, isPending, isSuccess, isError, error, data } =
    useSendTransaction()
  const [showConfirm, setShowConfirm] = useState(false)

  const txArgs = {
    to: address! as `0x${string}`,
    value: parseEther('0'),
    data: '0x' as `0x${string}`,
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
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

      {/* Dev's own UI — no library components at all */}
      {showConfirm && (
        <div style={dialogStyle}>
          <h3 style={{ margin: '0 0 12px' }}>Your own confirmation dialog</h3>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 12px' }}>
            This is entirely custom. No library UI involved.
          </p>
          <p style={{ fontSize: 13, margin: '0 0 4px' }}>
            <strong>To:</strong> {txArgs.to}
          </p>
          <p style={{ fontSize: 13, margin: '0 0 12px' }}>
            <strong>Value:</strong> 0 ETH
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              style={cancelBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                sendTransaction(txArgs)
                setShowConfirm(false)
              }}
              style={sendBtn}
            >
              Send it
            </button>
          </div>
        </div>
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

const dialogStyle: React.CSSProperties = {
  background: '#1c1917',
  border: '1px dashed #666',
  borderRadius: 12,
  padding: 20,
  marginTop: 16,
  color: '#e0e0e0',
}

const cancelBtn: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #555',
  background: 'transparent',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 13,
}

const sendBtn: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#22c55e',
  color: '#000',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}
