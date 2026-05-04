import { type Address, erc20Abi, formatUnits, type Hex, maxUint256 } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { DataRow } from '../components/DataRow'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

const TOKEN_SUBTITLE = '$175.00 USD'
const TOKEN_IMAGE_SOURCE = 'https://img.icons8.com/color/1200/ethereum.jpg'
const SPENDER_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=spender'

interface Erc20ApprovalProps {
  contract: Address
  data: Hex
  spender: Address
  amount: bigint
  confirm: () => void
  reject: () => void
}

export function Erc20Approval({
  contract,
  data,
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

  const {
    data: gasEstimate,
    isFetching: gasFetching,
    isError: gasError,
  } = useGasEstimate({
    to: contract,
    data,
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
  const confirmDisabled = gasFetching || gasEstimate == null

  return (
    <SigningLayout
      onConfirm={confirm}
      onReject={reject}
      disabled={confirmDisabled}
    >
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
          <DataRow
            label="Network fee"
            value={
              gasError
                ? 'Error'
                : gasEstimate != null && !gasFetching
                  ? formatGasFee(gasEstimate)
                  : 'Estimating...'
            }
            iconName="gasStation"
          />
        </div>
      </div>
    </SigningLayout>
  )
}
