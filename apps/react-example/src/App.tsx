import {
  AuthFlow,
  Button,
  type Dapp,
  type GasFee,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/wallet-react-kit'

const MOCK_DAPP: Dapp = {
  name: 'Example DApp',
  domain: 'example.com',
  network: 'ethereum',
  imageSource:
    'https://dashboard-assets.dappradar.com/document/21036/pixels-dapp-games-matic-logo_414127e7ef6b3ed6c2b671286864baa0.png',
}

const MOCK_GAS_FEES: GasFee[] = [
  { tier: 'low', duration: 60, fee: '0.0002 ETH', feeUsd: '$0.50' },
  { tier: 'market', duration: 30, fee: '0.0004 ETH', feeUsd: '$1.00' },
  { tier: 'fast', duration: 15, fee: '0.0008 ETH', feeUsd: '$2.00' },
]

const MOCK_TOKEN_SUBTITLE = '$175.00 USD'
const MOCK_TOKEN_IMAGE_SOURCE = 'https://img.icons8.com/color/1200/ethereum.jpg'
const MOCK_RECIPIENT_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=recipient'
const MOCK_SPENDER_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=spender'

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

        <div className="flex flex-col gap-2">
          <Button
            text={
              pendingRequests.length > 0 ? 'Queue ETH transfer' : 'Send ETH'
            }
            onClick={() =>
              sendTransaction({
                to: address!,
                value: parseEther('0.01'),
              })
            }
          />
          <Button
            text={
              pendingRequests.length > 0
                ? 'Queue ERC-20 transfer'
                : 'Send ERC-20'
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
          <Button
            text="Sign Typed Data"
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
          />
          <Button
            text="Batch Calls"
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
      </div>
      <SignatureRequest
        dapp={MOCK_DAPP}
        selectedGasTier="market"
        gasFees={MOCK_GAS_FEES}
        slippage={0.5}
        tokenSubtitle={MOCK_TOKEN_SUBTITLE}
        tokenImageSource={MOCK_TOKEN_IMAGE_SOURCE}
        recipientImageSource={MOCK_RECIPIENT_IMAGE_SOURCE}
        spenderImageSource={MOCK_SPENDER_IMAGE_SOURCE}
      />
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
