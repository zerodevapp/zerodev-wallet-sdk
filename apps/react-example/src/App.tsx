import { useSendOTP, useVerifyOTP } from '@zerodev/wallet-react'
import {
  Button,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/wallet-react-kit'
import { useState } from 'react'
import { parseEther } from 'viem'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
} from 'wagmi'

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

  // TODO: Actual UI
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Login with OTP
      </h2>
      {!otpId ? (
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSendOTP}
            disabled={sendOTP.isPending || !email}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {sendOTP.isPending ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter OTP code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleVerifyOTP}
            disabled={verifyOTP.isPending || !otpCode}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {verifyOTP.isPending ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      )}
      {sendOTP.isError && (
        <p className="text-red-500 text-sm mt-2">{sendOTP.error.message}</p>
      )}
      {verifyOTP.isError && (
        <p className="text-red-500 text-sm mt-2">{verifyOTP.error.message}</p>
      )}
    </div>
  )
}

function WalletPanel() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction, isSuccess, isError, error, data } =
    useSendTransaction()
  const { pendingRequests } = usePendingRequest()

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Wallet</h2>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
        >
          Disconnect
        </button>
      </div>

      <p className="text-xs text-gray-400 break-all mb-4">{address}</p>

      <Button
        text={
          pendingRequests.length > 0
            ? 'Queue another transaction'
            : 'Send Transaction'
        }
        onClick={() =>
          sendTransaction({ to: address!, value: parseEther('0'), data: '0x' })
        }
      />

      {isSuccess && <p className="text-green-600 text-sm mt-2">tx: {data}</p>}
      {isError && (
        <p className="text-red-500 text-sm mt-2">
          {error?.message?.includes('User rejected')
            ? 'Rejected by user'
            : error?.message}
        </p>
      )}

      <SignatureRequest />
    </div>
  )
}

export function App() {
  const { isConnected } = useAccount()

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            ZeroDev React Kit — React Example
          </h1>
          <p className="mt-2 text-gray-500">
            Interactive demo of{' '}
            <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
              @zerodev/wallet-react-kit
            </code>{' '}
            components
          </p>
        </div>

        {isConnected ? <WalletPanel /> : <AuthForm />}
      </div>
    </div>
  )
}
