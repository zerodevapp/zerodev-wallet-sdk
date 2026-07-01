'use client'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function ConnectButton() {
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, color: '#666' }}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #ddd',
            background: 'white',
            color: '#111',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: connectors[0] })}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: 'none',
        background: '#111',
        color: 'white',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      Connect Wallet
    </button>
  )
}
