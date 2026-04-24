import type { Address } from 'viem'
import { useReadContract } from 'wagmi'
import { SigningActions } from '../components/SigningActions'

const nameAbi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

interface CollectionApprovalProps {
  contract: Address
  operator: Address
  approved: boolean
  confirm: () => void
  reject: () => void
}

export function CollectionApproval({
  contract,
  operator,
  approved,
  confirm,
  reject,
}: CollectionApprovalProps) {
  const { data: name, isLoading } = useReadContract({
    address: contract,
    abi: nameAbi,
    functionName: 'name',
  })

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500">Loading collection details...</p>
    )
  }

  const displayName = name || contract

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">
        {approved ? 'Approve Collection' : 'Revoke Collection Approval'}
      </h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        <p className="text-2xl font-bold text-gray-900">
          {approved ? 'Grant Access' : 'Revoke Access'}
        </p>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Collection: </span>
          <span className="font-mono break-all">{displayName}</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Operator: </span>
          <span className="font-mono break-all">{operator}</span>
        </div>
        {name && (
          <div className="mt-1 text-sm text-gray-500">
            <span className="font-medium">Contract: </span>
            <span className="font-mono break-all">{contract}</span>
          </div>
        )}
      </div>

      <SigningActions confirm={confirm} reject={reject} />
    </div>
  )
}
