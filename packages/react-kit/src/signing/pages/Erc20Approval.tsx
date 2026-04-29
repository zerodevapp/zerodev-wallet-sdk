import { type Address, erc20Abi, formatUnits, maxUint256 } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'
import { type Dapp, TxInformation } from '../components/TxInformation'

interface Erc20ApprovalProps {
  contract: Address
  spender: Address
  amount: bigint
  confirm: () => void
  reject: () => void
  dapp: Dapp
  selectedGasTier: GasTier
  gasFees: GasFee[]
  slippage?: number
  tokenSubtitle: string
  tokenImageSource: string
  spenderImageSource: string
}

export function Erc20Approval({
  contract,
  spender,
  amount,
  confirm,
  reject,
  dapp,
  selectedGasTier,
  gasFees,
  slippage,
  tokenSubtitle,
  tokenImageSource,
  spenderImageSource,
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
        <TxInformation dapp={dapp} />
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re approving:</Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={`${formattedAmount} ${symbol}`}
                subtitle={tokenSubtitle}
                imageSource={tokenImageSource}
              />
            }
            bottomCard={
              <InfoCard
                title="Spender"
                subtitle={shortenHex(spender)}
                imageSource={spenderImageSource}
              />
            }
          />
          <TxGasFees
            selectedGasTier={selectedGasTier}
            gasFees={gasFees}
            {...(slippage !== undefined && { slippage })}
          />
        </div>
      </div>
    </SigningLayout>
  )
}
