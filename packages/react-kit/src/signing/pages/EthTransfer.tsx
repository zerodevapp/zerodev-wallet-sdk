import { type Address, formatEther, type Hex } from 'viem'

import { Text } from '../../shared/components/Text'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'
import { type Dapp, TxInformation } from '../components/TxInformation'

interface EthTransferProps {
  to: Address
  value: Hex
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

export function EthTransfer({
  to,
  value,
  confirm,
  reject,
  dapp,
  selectedGasTier,
  gasFees,
  slippage,
  tokenSubtitle,
  tokenImageSource,
  recipientImageSource,
}: EthTransferProps) {
  const formattedAmount = formatEther(BigInt(value))

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Send Token</Text>
          <Text className="text-center">
            You are about to send {formattedAmount} ETH to {to}.
          </Text>
        </div>
        <TxInformation dapp={dapp} />
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re sending</Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={`${formattedAmount} ETH`}
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
