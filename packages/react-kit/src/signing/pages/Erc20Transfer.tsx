import { type Address, erc20Abi, formatUnits, type Hex } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { SigningPageSkeleton } from '../components/SigningPageSkeleton'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

const RECIPIENT_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=recipient'

interface Erc20TransferProps {
  contract: Address
  data: Hex
  to: Address
  amount: bigint
  confirm: () => void
  reject: () => void
}

export function Erc20Transfer({
  contract,
  data,
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

  const {
    data: gasEstimate,
    isFetching: gasFetching,
    error: gasError,
  } = useGasEstimate({
    calls: [{ to: contract, data }],
  })

  const isLoading = symbolLoading || decimalsLoading

  if (isLoading) {
    return (
      <SigningLayout onConfirm={confirm} onReject={reject} disabled>
        <SigningPageSkeleton />
      </SigningLayout>
    )
  }

  if (!decimals || !symbol) {
    return (
      <SigningLayout
        onConfirm={confirm}
        onReject={reject}
        error={new Error('Failed to load token details')}
      >
        <div />
      </SigningLayout>
    )
  }

  const formattedAmount = formatUnits(amount, decimals)
  const confirmDisabled = gasFetching || gasEstimate == null

  return (
    <SigningLayout
      onConfirm={confirm}
      onReject={reject}
      disabled={confirmDisabled}
      error={gasError}
    >
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Send Token</Text>
          <Text className="text-center">
            You are about to send {formattedAmount} {symbol} to {shortenHex(to)}
            .
          </Text>
        </div>
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re sending</Text>
          <ArrowCardPair
            topCard={<InfoCard title={`${formattedAmount} ${symbol}`} />}
            bottomCard={
              <InfoCard
                title={shortenHex(to)}
                subtitle="Recipient"
                imageSource={RECIPIENT_IMAGE_SOURCE}
              />
            }
          />
          {!gasError &&
            (gasEstimate != null ? (
              <DataRow
                label="Network fee"
                value={formatGasFee(gasEstimate)}
                iconName="gasStation"
              />
            ) : (
              <DataRowSkeleton label="Network fee" />
            ))}
        </div>
      </div>
    </SigningLayout>
  )
}
