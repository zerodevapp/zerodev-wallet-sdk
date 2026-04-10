import {
  Button,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/wallet-react-kit'
import { encodeFunctionData, erc20Abi, parseEther } from 'viem'
import { useAccount, useDisconnect, useSendTransaction } from 'wagmi'
import { AuthExample } from './AuthExample'

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

      <div className="flex gap-2">
        <Button
          text={pendingRequests.length > 0 ? 'Queue ETH transfer' : 'Send ETH'}
          onClick={() =>
            sendTransaction({
              to: address!,
              value: parseEther('0.01'),
            })
          }
        />
        <Button
          text={
            pendingRequests.length > 0 ? 'Queue ERC-20 transfer' : 'Send ERC-20'
          }
          onClick={() =>
            sendTransaction({
              to: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // USDC on Sepolia
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [address!, 1000000n],
              }),
            })
          }
        />
      </div>

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

        {isConnected ? <WalletPanel /> : <AuthExample />}
      </div>
    </div>
  )
}
