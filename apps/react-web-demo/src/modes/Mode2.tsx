/**
 * Mode 2: Our Flow + Custom Components (Option A — Render Prop)
 *
 * signingUI: { mode: 'prompt' } is set in connector config.
 * Dev uses <SignatureRequest> with a render prop (children as function).
 * The component handles registration and store subscription.
 * The dev only provides the rendering.
 */

import { parseEther } from 'viem'
import { useAccount, useSendTransaction } from 'wagmi'
import { SignatureRequest } from '../SignatureRequest'

export function Mode2() {
  const { address } = useAccount()
  const { sendTransaction, isPending, isSuccess, isError, error, data } =
    useSendTransaction()

  return (
    <>
      <button
        type="button"
        onClick={() =>
          sendTransaction({ to: address!, value: parseEther('0'), data: '0x' })
        }
        disabled={isPending}
        style={btnStyle}
      >
        {isPending ? 'Awaiting confirmation...' : 'Send Transaction'}
      </button>

      {isSuccess && (
        <p style={{ color: '#4ade80', fontSize: 13, marginTop: 8 }}>
          tx: {data}
        </p>
      )}
      {isError && (
        <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>
          {error?.message?.includes('User rejected')
            ? 'Rejected by user'
            : error?.message}
        </p>
      )}

      {/* Render prop — same registration/store logic, custom rendering */}
      <SignatureRequest>
        {({ pendingRequest, confirm, reject }) => (
          <div style={customCardStyle}>
            <h3 style={{ margin: '0 0 12px', color: '#f59e0b' }}>
              Custom Render Prop UI
            </h3>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
              Registration + store subscription handled by{' '}
              {'<SignatureRequest>'}. Dev only provides the rendering via
              children.
            </p>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              <strong>Method:</strong> {pendingRequest.method}
            </div>
            <pre style={preStyle}>
              {JSON.stringify(pendingRequest.params, null, 2)}
            </pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={reject} style={rejectBtn}>
                Nope
              </button>
              <button type="button" onClick={confirm} style={approveBtn}>
                LGTM
              </button>
            </div>
          </div>
        )}
      </SignatureRequest>
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

const customCardStyle: React.CSSProperties = {
  background: '#1c1917',
  border: '1px solid #f59e0b',
  borderRadius: 12,
  padding: 20,
  marginTop: 16,
  color: '#e0e0e0',
}

const preStyle: React.CSSProperties = {
  background: '#0d0d1a',
  padding: 10,
  borderRadius: 8,
  overflow: 'auto',
  fontSize: 11,
  maxHeight: 150,
  margin: '8px 0',
}

const rejectBtn: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #555',
  background: 'transparent',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 13,
}

const approveBtn: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#f59e0b',
  color: '#000',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}
