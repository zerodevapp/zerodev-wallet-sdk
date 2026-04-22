import {
  AuthFlow,
  Button,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/wallet-react-kit'
import { encodeFunctionData, erc20Abi, parseEther } from 'viem'
import {
  useAccount,
  useDisconnect,
  useSendTransaction,
  useSignMessage,
} from 'wagmi'

function WalletPanel() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction, isSuccess, isError, error, data } =
    useSendTransaction()
  const {
    signMessage,
    data: signature,
    isSuccess: signSuccess,
    isError: signError,
    error: signMessageError,
  } = useSignMessage()
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
        <Button
          text={
            pendingRequests.length > 0
              ? 'Queue ERC-20 approval'
              : 'Approve ERC-20'
          }
          onClick={() =>
            sendTransaction({
              to: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // USDC on Sepolia
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [address!, 1000000n],
              }),
            })
          }
        />
        <Button
          text="Collection Approval"
          onClick={() =>
            sendTransaction({
              // Not an NFT — reusing USDC on Sepolia because it has a name() function,
              // so the decoded UI loads fast. The setApprovalForAll calldata is the same regardless.
              to: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
              data: encodeFunctionData({
                abi: [
                  {
                    type: 'function',
                    name: 'setApprovalForAll',
                    inputs: [
                      { name: 'operator', type: 'address' },
                      { name: 'approved', type: 'bool' },
                    ],
                    outputs: [],
                    stateMutability: 'nonpayable',
                  },
                ],
                functionName: 'setApprovalForAll',
                args: [address!, true],
              }),
            })
          }
        />
        <Button
          text="Sign Message"
          onClick={() => signMessage({ message: 'Hello from ZeroDev!' })}
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

      {signSuccess && (
        <p className="text-green-600 text-sm mt-2 break-all">
          sig: {signature}
        </p>
      )}
      {signError && (
        <p className="text-red-500 text-sm mt-2">
          {signMessageError?.message?.includes('User rejected')
            ? 'Rejected by user'
            : signMessageError?.message}
        </p>
      )}

      <SignatureRequest />
    </div>
  )
}

export function App() {
  const { isConnected } = useAccount()
  return (
    <div className="mx-auto h-full w-[500px]">
      {isConnected ? <WalletPanel /> : <AuthFlow />}
    </div>
  )
}
