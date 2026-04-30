import { type Address, formatEther, type Hex } from 'viem'

import { Text } from '../../shared/components/Text'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { DataRow } from '../components/DataRow'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

const TOKEN_SUBTITLE = '$175.00 USD'
const TOKEN_IMAGE_SOURCE = 'https://img.icons8.com/color/1200/ethereum.jpg'
const RECIPIENT_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=recipient'

interface EthTransferProps {
  to: Address
  value: Hex
  confirm: () => void
  reject: () => void
}

export function EthTransfer({ to, value, confirm, reject }: EthTransferProps) {
  const formattedAmount = formatEther(BigInt(value))

  const {
    data: gasEstimate,
    isFetching,
    isError,
  } = useGasEstimate({ to, value })

  const confirmDisabled = isFetching || gasEstimate == null

  return (
    <SigningLayout
      onConfirm={confirm}
      onReject={reject}
      disabled={confirmDisabled}
    >
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
          <DataRow
            label="Network fee"
            value={
              isError
                ? 'Error'
                : gasEstimate != null && !isFetching
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
