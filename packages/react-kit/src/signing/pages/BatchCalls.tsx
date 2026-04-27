import {
  type Address,
  erc20Abi,
  formatEther,
  formatUnits,
  type Hex,
  maxUint256,
} from 'viem'
import { useReadContract } from 'wagmi'
import type { BatchCall } from '../../types.js'
import { SigningActions } from '../components/SigningActions'
import {
  decodeCollectionApproval,
  isCollectionApproval,
} from '../utils/collectionApproval.js'
import { decodeErc20Approval, isErc20Approval } from '../utils/erc20Approval.js'
import { decodeErc20Transfer, isErc20Transfer } from '../utils/erc20Transfer.js'
import { isEthTransfer } from '../utils/ethTransfer.js'

interface BatchCallsProps {
  calls: BatchCall[]
  confirm: () => void
  reject: () => void
}

function EthTransferItem({ to, value }: { to: Address; value: Hex }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">Send ETH</p>
      <p className="text-lg font-bold text-gray-900">
        {formatEther(BigInt(value))} ETH
      </p>
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium">To: </span>
        <span className="font-mono break-all">{to}</span>
      </div>
    </div>
  )
}

function Erc20TransferItem({
  contract,
  to,
  amount,
}: {
  contract: Address
  to: Address
  amount: bigint
}) {
  const { data: symbol } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'symbol',
  })
  const { data: decimals } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  const formatted =
    decimals != null ? formatUnits(amount, decimals) : String(amount)
  const label = symbol ?? contract

  return (
    <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">Send {label}</p>
      <p className="text-lg font-bold text-gray-900">
        {formatted} {symbol ?? ''}
      </p>
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium">To: </span>
        <span className="font-mono break-all">{to}</span>
      </div>
    </div>
  )
}

function Erc20ApprovalItem({
  contract,
  spender,
  amount,
}: {
  contract: Address
  spender: Address
  amount: bigint
}) {
  const { data: symbol } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'symbol',
  })
  const { data: decimals } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  const isUnlimited = amount === maxUint256
  const formatted = isUnlimited
    ? 'Unlimited'
    : decimals != null
      ? `${formatUnits(amount, decimals)} ${symbol ?? ''}`
      : String(amount)

  return (
    <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">
        Approve {symbol ?? contract}
      </p>
      <p className="text-lg font-bold text-gray-900">{formatted}</p>
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium">Spender: </span>
        <span className="font-mono break-all">{spender}</span>
      </div>
    </div>
  )
}

function CollectionApprovalItem({
  contract,
  operator,
  approved,
}: {
  contract: Address
  operator: Address
  approved: boolean
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">
        {approved ? 'Approve Collection' : 'Revoke Collection Approval'}
      </p>
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium">Contract: </span>
        <span className="font-mono break-all">{contract}</span>
      </div>
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium">Operator: </span>
        <span className="font-mono break-all">{operator}</span>
      </div>
    </div>
  )
}

function UnknownCallItem({ call }: { call: BatchCall }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
      <p className="text-sm font-medium text-gray-700">Contract Call</p>
      {call.to && (
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">To: </span>
          <span className="font-mono break-all">{call.to}</span>
        </div>
      )}
      {call.value && BigInt(call.value) > 0n && (
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Value: </span>
          <span>{formatEther(BigInt(call.value))} ETH</span>
        </div>
      )}
      {call.data && (
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Data: </span>
          <span className="font-mono break-all">{call.data}</span>
        </div>
      )}
    </div>
  )
}

function CallItem({ call }: { call: BatchCall }) {
  const tx = call as Parameters<typeof isEthTransfer>[0]

  if (isEthTransfer(tx)) {
    return <EthTransferItem to={call.to as Address} value={call.value as Hex} />
  }

  if (isErc20Transfer(tx)) {
    const decoded = decodeErc20Transfer(tx)
    if (decoded) {
      return (
        <Erc20TransferItem
          contract={call.to as Address}
          to={decoded.to}
          amount={decoded.amount}
        />
      )
    }
  }

  if (isErc20Approval(tx)) {
    const decoded = decodeErc20Approval(tx)
    if (decoded) {
      return (
        <Erc20ApprovalItem
          contract={call.to as Address}
          spender={decoded.spender}
          amount={decoded.amount}
        />
      )
    }
  }

  if (isCollectionApproval(tx)) {
    const decoded = decodeCollectionApproval(tx)
    if (decoded) {
      return (
        <CollectionApprovalItem
          contract={call.to as Address}
          operator={decoded.operator}
          approved={decoded.approved}
        />
      )
    }
  }

  return <UnknownCallItem call={call} />
}

export function BatchCalls({ calls, confirm, reject }: BatchCallsProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">
        Batch Transaction ({calls.length}{' '}
        {calls.length === 1 ? 'call' : 'calls'})
      </h3>

      {calls.map((call, i) => (
        <CallItem key={`${call.to ?? 'unknown'}-${i}`} call={call} />
      ))}

      <SigningActions onConfirm={confirm} onReject={reject} />
    </div>
  )
}
