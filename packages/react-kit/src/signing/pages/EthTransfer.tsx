import { type Address, formatEther, type Hex } from 'viem'
import { SigningActions } from '../components/SigningActions'

interface EthTransferProps {
  to: Address
  value: Hex
  confirm: () => void
  reject: () => void
}

export function EthTransfer({ to, value, confirm, reject }: EthTransferProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-gray-900">Send ETH</h3>

      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
        <p className="text-2xl font-bold text-gray-900">
          {formatEther(BigInt(value))} ETH
        </p>
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">To: </span>
          <span className="font-mono break-all">{to}</span>
        </div>
      </div>

      <SigningActions confirm={confirm} reject={reject} />
    </div>
  )
}
