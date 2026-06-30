import {
  AuthFlow,
  SignatureRequest,
  usePendingRequest,
} from '@zerodev/react-wallet-ui'
import { encodeFunctionData, erc20Abi, parseEther } from 'viem'
import {
  useAccount,
  useDisconnect,
  useSendCalls,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
} from 'wagmi'
import { ConnectButton } from '../ConnectButton'

const USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'

const buttonStyle = {
  width: '100%',
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
} as const

export default function SignatureRequestDemo() {
  const { isConnected, address } = useAccount()
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

  if (!isConnected) {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Connect a wallet to try the SignatureRequest component.
        </p>
        <ConnectButton />
        <AuthFlow />
      </div>
    )
  }

  const queued = pendingRequests.length > 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
          {address}
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
            flexShrink: 0,
          }}
        >
          Disconnect
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            sendTransaction({ to: address!, value: parseEther('0.01') })
          }
        >
          {queued ? 'Queue ETH transfer' : 'Send ETH'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            sendTransaction({
              to: USDC_SEPOLIA,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'transfer',
                args: [address!, 1000000n],
              }),
            })
          }
        >
          {queued ? 'Queue ERC-20 transfer' : 'Send ERC-20'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            sendTransaction({
              to: USDC_SEPOLIA,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [address!, 1000000n],
              }),
            })
          }
        >
          {queued ? 'Queue ERC-20 approval' : 'Approve ERC-20'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            sendTransaction({
              // Not an NFT — reusing USDC because it has a name() function,
              // so the decoded UI loads fast. The setApprovalForAll calldata is the same regardless.
              to: USDC_SEPOLIA,
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
        >
          {queued ? 'Queue collection approval' : 'Collection Approval'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => signMessage({ message: 'Hello from ZeroDev!' })}
        >
          {queued ? 'Queue message signature' : 'Sign Message'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            signTypedData({
              domain: {
                name: 'Example DApp',
                version: '1',
                chainId: 11155111,
                verifyingContract: USDC_SEPOLIA,
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
        >
          {queued ? 'Queue typed data signature' : 'Sign Typed Data'}
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            sendCalls({
              calls: [
                { to: address!, value: parseEther('0.01') },
                {
                  to: USDC_SEPOLIA,
                  data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [address!, 1000000n],
                  }),
                },
              ],
            })
          }
        >
          {queued ? 'Queue batch calls' : 'Batch Calls'}
        </button>
      </div>

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

      {signSuccess && (
        <p
          style={{
            color: '#16a34a',
            fontSize: 13,
            marginTop: 8,
            wordBreak: 'break-all',
          }}
        >
          sig: {signature}
        </p>
      )}
      {signError && (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
          {signMessageError?.message?.includes('User rejected')
            ? 'Rejected by user'
            : signMessageError?.message}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <SignatureRequest />
      </div>
    </div>
  )
}
