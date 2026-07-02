import { Text } from '@zerodev/react-ui'
import { type Address, erc20Abi, formatUnits, type Hex, maxUint256 } from 'viem'
import { useReadContract } from 'wagmi'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { InfoCard } from '../components/InfoCard'
import { Section } from '../components/Section'
import { SigningLayout } from '../components/SigningLayout'
import { SigningPageSkeleton } from '../components/SigningPageSkeleton'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

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
      error={gasError}
    >
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Approve Token Spending</Text>
          <Text className="zd:text-center">
            This contract is requesting permission to spend your {symbol}. This
            is required for future transactions.
          </Text>
        </div>
        <div className="zd:flex zd:flex-col zd:gap-2">
          <Text className="zd:text-body1">You&#39;re approving:</Text>
          <ArrowCardPair
            topCard={<InfoCard title={`${formattedAmount} ${symbol}`} />}
            bottomCard={
              <InfoCard
                title="Spender"
                subtitle={shortenHex(spender)}
                imageSource={SPENDER_IMAGE_SOURCE}
              />
            }
          />
          {!gasError && (
            <Section title="Estimated Gas Fee" iconName="lightingFill">
              {gasEstimate != null ? (
                <DataRow
                  label="Fee"
                  value={formatGasFee(gasEstimate)}
                  iconName="gasStation"
                />
              ) : (
                <DataRowSkeleton label="Fee" />
              )}
            </Section>
          )}
        </div>
      </div>
    </SigningLayout>
  )
}
