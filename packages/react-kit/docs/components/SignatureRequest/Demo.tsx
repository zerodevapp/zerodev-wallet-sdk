import { SignatureRequest } from '@zerodev/wallet-react-kit'
import { parseEther } from 'viem'
import { useAccount, useSendTransaction } from 'wagmi'
import { ConnectButton } from '../ConnectButton'

export default function SignatureRequestDemo() {
  const { isConnected, address } = useAccount()
  const { sendTransaction, isPending, isSuccess, isError, error, data } =
    useSendTransaction()

  if (!isConnected) {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Connect a wallet to try the SignatureRequest component.
        </p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          sendTransaction({ to: address!, value: parseEther('0'), data: '0x' })
        }
        disabled={isPending}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: '#111',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Awaiting confirmation...' : 'Send Transaction (0 ETH)'}
      </button>

      {isSuccess && (
        <p style={{ color: '#16a34a', fontSize: 13, marginTop: 8 }}>
          tx: {data}
        </p>
      )}
      {isError && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
          {error?.message?.includes('User rejected')
            ? 'Rejected by user'
            : error?.message}
        </p>
      )}

      <SignatureRequest />
    </div>
  )
}
