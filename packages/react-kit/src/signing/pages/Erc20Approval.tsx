import { type Address, erc20Abi, formatUnits, maxUint256 } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'

const TOKEN_SUBTITLE = '$175.00 USD'
const TOKEN_IMAGE_SOURCE = 'https://img.icons8.com/color/1200/ethereum.jpg'
const SPENDER_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=spender'
const SELECTED_GAS_TIER: GasTier = 'market'
const GAS_FEES: GasFee[] = [
  { tier: 'low', duration: 60, fee: '0.0002 ETH', feeUsd: '$0.50' },
  { tier: 'market', duration: 30, fee: '0.0004 ETH', feeUsd: '$1.00' },
  { tier: 'fast', duration: 15, fee: '0.0008 ETH', feeUsd: '$2.00' },
]
const SLIPPAGE = 0.5

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
    return <Text>Loading token details...</Text>
  }

  if (!decimals || !symbol) {
    return <Text>Failed to load token details.</Text>
  }

  const isUnlimited = amount === maxUint256
  const formattedAmount = isUnlimited
    ? 'Unlimited'
    : formatUnits(amount, decimals)

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Approve Token Spending</Text>
          <Text className="text-center">
            This contract is requesting permission to spend your {symbol}. This
            is required for future transactions.
          </Text>
        </div>
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re approving:</Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={`${formattedAmount} ${symbol}`}
                subtitle={TOKEN_SUBTITLE}
                imageSource={TOKEN_IMAGE_SOURCE}
              />
            }
            bottomCard={
              <InfoCard
                title="Spender"
                subtitle={shortenHex(spender)}
                imageSource={SPENDER_IMAGE_SOURCE}
              />
            }
          />
          <TxGasFees
            selectedGasTier={SELECTED_GAS_TIER}
            gasFees={GAS_FEES}
            slippage={SLIPPAGE}
          />
        </div>
      </div>
    </SigningLayout>
  )
}
