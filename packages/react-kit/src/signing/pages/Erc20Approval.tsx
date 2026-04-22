import { type Address, erc20Abi, formatUnits, maxUint256 } from 'viem'
import { useReadContract } from 'wagmi'
import { SigningActions } from '../components/SigningActions.js'

interface Erc20ApprovalProps {
  contract: Address
  spender: Address
  amount: bigint
  confirm: () => void
  reject: () => void
}

export function Erc20Approval({
  contract,
  spender,
  amount,
  confirm,
  reject,
}: Erc20ApprovalProps) {
  const { data: symbol, isLoading: symbolLoading } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'symbol',
  })

  const { data: decimals, isLoading: decimalsLoading } = useReadContract({
    address: contract,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  const isLoading = symbolLoading || decimalsLoading

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading token details...</p>
  }

  if (!decimals || !symbol) {
    return <p className="text-sm text-red-500">Failed to load token details.</p>
  }

  const isUnlimited = amount === maxUint256
  const formattedAmount = isUnlimited
    ? 'Unlimited'
    : `${formatUnits(amount, decimals)} ${symbol}`

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">Approve {symbol}</h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        <p className="text-2xl font-bold text-gray-900">{formattedAmount}</p>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Spender: </span>
          <span className="font-mono break-all">{spender}</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Token: </span>
          <span className="font-mono break-all">{contract}</span>
        </div>
      </div>

      <SigningActions confirm={confirm} reject={reject} />
    </div>
  )
}
