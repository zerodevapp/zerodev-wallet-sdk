import { type Address, erc20Abi, formatUnits } from 'viem'
import { useReadContract } from 'wagmi'
import { SigningActions } from '../components/SigningActions'

interface Erc20TransferProps {
  contract: Address
  to: Address
  amount: bigint
  confirm: () => void
  reject: () => void
}

export function Erc20Transfer({
  contract,
  to,
  amount,
  confirm,
  reject,
}: Erc20TransferProps) {
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

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">Send {symbol}</h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        <p className="text-2xl font-bold text-gray-900">
          {formatUnits(amount, decimals)} {symbol}
        </p>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">To: </span>
          <span className="font-mono break-all">{to}</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">Contract: </span>
          <span className="font-mono break-all">{contract}</span>
        </div>
      </div>

      <SigningActions confirm={confirm} reject={reject} />
    </div>
  )
}
