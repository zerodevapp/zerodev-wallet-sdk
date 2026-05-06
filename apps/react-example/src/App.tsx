import {
  AuthFlow,
  type PendingRequest,
  type Request,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/wallet-react-kit'
import { useId, useState } from 'react'
import { encodeFunctionData, erc20Abi, parseEther } from 'viem'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendCalls,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
} from 'wagmi'

type SignatureRequestMode = 'default' | 'children' | 'controlled'

function CustomConfirmUI({
  pendingRequest,
  confirm,
  reject,
}: {
  pendingRequest: PendingRequest | null
  confirm: () => void
  reject: () => void
}) {
  if (!pendingRequest) return null
  return (
    <div className="mt-4 rounded-xl border border-purple-300 bg-purple-50 p-4">
      <h3 className="text-sm font-semibold text-purple-900 mb-2">
        Custom UI: {pendingRequest.method}
      </h3>
      <pre className="text-xs text-purple-800 mb-3 max-h-32 overflow-auto">
        {JSON.stringify(pendingRequest.params, null, 2)}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 cursor-pointer"
        >
          Custom Confirm
        </button>
        <button
          type="button"
          onClick={reject}
          className="flex-1 rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-300 cursor-pointer"
        >
          Custom Reject
        </button>
      </div>
    </div>
  )
}

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
  const { signTypedData } = useSignTypedData()
  const { sendCalls } = useSendCalls()
  const { pendingRequests } = usePendingRequest()

  const [mode, setMode] = useState<SignatureRequestMode>('default')
  const [controlledRequest, setControlledRequest] = useState<Request | null>(
    null,
  )
  const modeSelectId = useId()

  function handleControlledSendEth() {
    setControlledRequest({
      method: 'eth_sendTransaction',
      params: [
        {
          from: address!,
          to: address!,
          value: `0x${parseEther('0.01').toString(16)}`,
        },
      ],
    })
  }

  function handleControlledConfirm() {
    if (!controlledRequest) return
    sendTransaction({ to: address!, value: parseEther('0.01') })
    setControlledRequest(null)
  }

  return (
    <>
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

        <div className="mb-4 rounded-lg bg-gray-50 p-3">
          <label
            htmlFor={modeSelectId}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            SignatureRequest mode
          </label>
          <select
            id={modeSelectId}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as SignatureRequestMode)
              setControlledRequest(null)
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
          >
            <option value="default">Mode 1: default UI</option>
            <option value="children">
              Mode 2: custom UI via children function
            </option>
            <option value="controlled">
              Mode 3: default UI via controlled props
            </option>
          </select>
        </div>

        {mode !== 'controlled' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                sendTransaction({
                  to: address!,
                  value: parseEther('0.01'),
                })
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              {pendingRequests.length > 0 ? 'Queue ETH transfer' : 'Send ETH'}
            </button>
            <button
              type="button"
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              {pendingRequests.length > 0
                ? 'Queue ERC-20 transfer'
                : 'Send ERC-20'}
            </button>
            <button
              type="button"
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              {pendingRequests.length > 0
                ? 'Queue ERC-20 approval'
                : 'Approve ERC-20'}
            </button>
            <button
              type="button"
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Collection Approval
            </button>
            <button
              type="button"
              onClick={() => signMessage({ message: 'Hello from ZeroDev!' })}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Sign Message
            </button>
            <button
              type="button"
              onClick={() =>
                signTypedData({
                  domain: {
                    name: 'Example DApp',
                    version: '1',
                    chainId: 11155111,
                    verifyingContract:
                      '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
                  },
                  types: {
                    Person: [
                      { name: 'name', type: 'string' },
                      { name: 'wallets', type: 'address[]' },
                    ],
                    Mail: [
                      { name: 'from', type: 'Person' },
                      { name: 'to', type: 'Person[]' },
                      { name: 'contents', type: 'string' },
                    ],
                  },
                  primaryType: 'Mail',
                  message: {
                    from: {
                      name: 'Alice',
                      wallets: [
                        '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
                        '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
                      ],
                    },
                    to: [
                      {
                        name: 'Bob',
                        wallets: [
                          '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
                          '0xB0B0000000000000000000000000000000000000',
                        ],
                      },
                      {
                        name: 'Charlie',
                        wallets: ['0xC0FFEE0000000000000000000000000000000000'],
                      },
                    ],
                    contents: 'Hello from ZeroDev!',
                  },
                })
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Sign Typed Data
            </button>
            <button
              type="button"
              onClick={() =>
                sendCalls({
                  calls: [
                    {
                      to: address!,
                      value: parseEther('0.01'),
                    },
                    {
                      to: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
                      data: encodeFunctionData({
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [address!, 1000000n],
                      }),
                    },
                  ],
                })
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Batch Calls
            </button>
            <button
              type="button"
              onClick={() =>
                sendTransaction({
                  // Arbitrary calldata that doesn't match any known decoder,
                  // so the SignatureRequest falls through to GenericRequest.
                  to: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
                  data: '0xdeadbeef',
                  value: parseEther('0.001'),
                })
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Generic Request
            </button>
          </div>
        )}

        {mode === 'controlled' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">
              In controlled mode the app captures the request locally, renders
              the default UI, and dispatches the tx itself on confirm.
            </p>
            <button
              type="button"
              onClick={handleControlledSendEth}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              Send ETH (controlled)
            </button>
          </div>
        )}

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
      </div>

      {mode === 'default' && <SignatureRequest />}

      {mode === 'children' && (
        <SignatureRequest>
          {({ pendingRequest, confirm, reject }) => (
            <CustomConfirmUI
              pendingRequest={pendingRequest}
              confirm={confirm}
              reject={reject}
            />
          )}
        </SignatureRequest>
      )}

      {mode === 'controlled' && controlledRequest && (
        <SignatureRequest
          request={controlledRequest}
          onConfirm={handleControlledConfirm}
          onReject={() => setControlledRequest(null)}
        />
      )}
    </>
  )
}

export function App() {
  const { connect, connectors } = useConnect()
  const { isConnected } = useAccount()

  return (
    <div className="mx-auto h-[800px] w-[500px]">
      {!isConnected ? (
        <>
          <button
            type="button"
            onClick={() => connect({ connector: connectors[0] })}
            className="mb-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 cursor-pointer"
          >
            Connect
          </button>
          <AuthFlow />
        </>
      ) : (
        <WalletPanel />
      )}
    </div>
  )
}
