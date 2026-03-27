import { useSendOTP, useVerifyOTP } from '@zerodev/wallet-react'
import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Mode1 } from './modes/Mode1'
import { Mode2 } from './modes/Mode2'
import { Mode3 } from './modes/Mode3'
import { Mode4 } from './modes/Mode4'

const MODES = [
  { id: 1, label: 'Mode 1', desc: 'Our flow + our UI' },
  { id: 2, label: 'Mode 2', desc: 'Our flow + custom UI' },
  { id: 3, label: 'Mode 3', desc: 'Custom flow + our UI' },
  { id: 4, label: 'Mode 4', desc: 'Custom flow + custom UI' },
] as const

function AuthForm() {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpId, setOtpId] = useState<string | null>(null)

  const { connect, connectors } = useConnect()
  const sendOTP = useSendOTP()
  const verifyOTP = useVerifyOTP()

  const connector = connectors.find((c) => c.id === 'zerodev-wallet')

  const handleSendOTP = async () => {
    if (!email) return
    const result = await sendOTP.mutateAsync({ email })
    setOtpId(result.otpId)
  }

  const handleVerifyOTP = async () => {
    if (!otpId || !otpCode || !connector) return
    await verifyOTP.mutateAsync({ otpId, code: otpCode })
    connect({ connector })
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 16px' }}>Login with OTP</h2>

      {!otpId ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleSendOTP}
            disabled={sendOTP.isPending || !email}
            style={buttonStyle}
          >
            {sendOTP.isPending ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Enter OTP code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleVerifyOTP}
            disabled={verifyOTP.isPending || !otpCode}
            style={buttonStyle}
          >
            {verifyOTP.isPending ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      )}

      {sendOTP.isError && (
        <p style={errorStyle}>Error: {sendOTP.error.message}</p>
      )}
      {verifyOTP.isError && (
        <p style={errorStyle}>Error: {verifyOTP.error.message}</p>
      )}
    </div>
  )
}

function ModeSwitcher({
  activeMode,
  onSwitch,
}: {
  activeMode: number
  onSwitch: (mode: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
      {MODES.map((m) => (
        <button
          type="button"
          key={m.id}
          onClick={() => onSwitch(m.id)}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: 8,
            border:
              activeMode === m.id ? '2px solid #4f46e5' : '1px solid #333',
            background: activeMode === m.id ? '#1a1a3e' : 'transparent',
            color: activeMode === m.id ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1.3,
          }}
        >
          <div style={{ fontWeight: 600 }}>{m.label}</div>
          <div style={{ fontSize: 10 }}>{m.desc}</div>
        </button>
      ))}
    </div>
  )
}

function WalletPanel() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const [activeMode, setActiveMode] = useState(1)

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Wallet</h2>
        <button
          type="button"
          onClick={() => disconnect()}
          style={{ ...buttonStyle, background: '#991b1b', fontSize: 12 }}
        >
          Disconnect
        </button>
      </div>

      <p
        style={{
          fontSize: 12,
          color: '#666',
          wordBreak: 'break-all',
          margin: '0 0 16px',
        }}
      >
        {address}
      </p>

      <ModeSwitcher activeMode={activeMode} onSwitch={setActiveMode} />

      {activeMode === 1 && <Mode1 />}
      {activeMode === 2 && <Mode2 />}
      {activeMode === 3 && <Mode3 />}
      {activeMode === 4 && <Mode4 />}
    </div>
  )
}

export function App() {
  const { isConnected } = useAccount()

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: 'center', color: '#e0e0e0', marginBottom: 4 }}>
        Signing Screen PoC
      </h1>
      <p
        style={{
          textAlign: 'center',
          color: '#888',
          marginTop: 0,
          marginBottom: 24,
          fontSize: 13,
        }}
      >
        Part 3: Usage Modes
      </p>

      {isConnected ? <WalletPanel /> : <AuthForm />}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 540,
  margin: '40px auto',
  padding: '0 16px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const cardStyle: React.CSSProperties = {
  background: '#1a1a2e',
  borderRadius: 12,
  padding: 24,
  color: '#e0e0e0',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #333',
  background: '#0d0d1a',
  color: '#e0e0e0',
  fontSize: 14,
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#4f46e5',
  color: 'white',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}

const errorStyle: React.CSSProperties = {
  color: '#f87171',
  fontSize: 13,
  marginTop: 8,
}
