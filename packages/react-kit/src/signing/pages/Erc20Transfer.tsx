import { type Address, erc20Abi, formatUnits } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'
import { type Dapp, TxInformation } from '../components/TxInformation'

interface Erc20TransferProps {
  contract: Address
  to: Address
  amount: bigint
  confirm: () => void
  reject: () => void
  dapp: Dapp
  selectedGasTier: GasTier
  gasFees: GasFee[]
  slippage?: number
  tokenSubtitle: string
  tokenImageSource: string
  recipientImageSource: string
}

export function Erc20Transfer({
  contract,
  to,
  amount,
  confirm,
  reject,
  dapp,
  selectedGasTier,
  gasFees,
  slippage,
  tokenSubtitle,
  tokenImageSource,
  recipientImageSource,
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
    return <Text>Loading token details...</Text>
  }

  if (!decimals || !symbol) {
    return <Text>Failed to load token details.</Text>
  }

  const formattedAmount = formatUnits(amount, decimals)

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Send Token</Text>
          <Text className="text-center">
            You are about to send {formattedAmount} {symbol} to {to}.
          </Text>
        </div>
        <TxInformation dapp={dapp} />
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re sending</Text>
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
                title={to}
                subtitle="Recipient"
                imageSource={recipientImageSource}
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
