/**
 * Mode 1: Our Flow + Our Components
 *
 * signingUI: { mode: 'prompt' } is set in connector config.
 * <SignatureRequest /> is mounted (uncontrolled) — it self-registers
 * and automatically gates requests via the Promise gate.
 *
 * Dev just calls useSendTransaction and mounts the component. Done.
 */

import { parseEther } from 'viem'
import { useAccount, useSendTransaction } from 'wagmi'
import { SignatureRequest } from '../SignatureRequest'

export function Mode1() {
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

      <TxResult
        isSuccess={isSuccess}
        isError={isError}
        error={error}
        data={data}
      />

      {/* Mount = opt-in. This is the only thing the dev adds for confirmation UI */}
      <SignatureRequest />
    </>
  )
}

function TxResult({ isSuccess, isError, error, data }: any) {
  if (isSuccess)
    return (
      <p style={{ color: '#4ade80', fontSize: 13, marginTop: 8 }}>tx: {data}</p>
    )
  if (isError)
    return (
      <p style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>
        {error?.message?.includes('User rejected')
          ? 'Rejected by user'
          : error?.message}
      </p>
    )
  return null
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
