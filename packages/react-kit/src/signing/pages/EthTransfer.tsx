import { type Address, formatEther, type Hex } from 'viem'

import { Text } from '../../shared/components/Text'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'

const TOKEN_SUBTITLE = '$175.00 USD'
const TOKEN_IMAGE_SOURCE = 'https://img.icons8.com/color/1200/ethereum.jpg'
const RECIPIENT_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=recipient'
const SELECTED_GAS_TIER: GasTier = 'market'
const GAS_FEES: GasFee[] = [
  { tier: 'low', duration: 60, fee: '0.0002 ETH', feeUsd: '$0.50' },
  { tier: 'market', duration: 30, fee: '0.0004 ETH', feeUsd: '$1.00' },
  { tier: 'fast', duration: 15, fee: '0.0008 ETH', feeUsd: '$2.00' },
]
const SLIPPAGE = 0.5

interface EthTransferProps {
  to: Address
  value: Hex
  confirm: () => void
  reject: () => void
}

export function EthTransfer({ to, value, confirm, reject }: EthTransferProps) {
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
        <div className="flex flex-col gap-2">
          <Text className="text-body1">You&#39;re sending</Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={`${formattedAmount} ETH`}
                subtitle={TOKEN_SUBTITLE}
                imageSource={TOKEN_IMAGE_SOURCE}
              />
            }
            bottomCard={
              <InfoCard
                title={to}
                subtitle="Recipient"
                imageSource={RECIPIENT_IMAGE_SOURCE}
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
