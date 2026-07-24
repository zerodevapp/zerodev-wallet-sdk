import {
  ArrowCardPair,
  DataRow,
  DataRowSkeleton,
  Icon,
  InfoCard,
  Text,
} from '@zerodev/react-ui'
import { type Address, formatEther, type Hex } from 'viem'
import { shortenHex } from '../../shared/utils/common'
import { Section } from '../components/Section'
import { SigningLayout } from '../components/SigningLayout'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

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
    error: gasError,
  } = useGasEstimate({ calls: [{ to, value }] })

  const confirmDisabled = isFetching || gasEstimate == null

  return (
    <SigningLayout
      onConfirm={confirm}
      onReject={reject}
      disabled={confirmDisabled}
      error={gasError}
    >
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Send Token</Text>
          <Text className="zd:text-center">
            You are about to send {formattedAmount} ETH to {shortenHex(to)}.
          </Text>
        </div>
        <div className="zd:flex zd:flex-col zd:gap-2">
          <Text className="zd:text-body1">You&#39;re sending</Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={`${formattedAmount} ETH`}
                imageSource={TOKEN_IMAGE_SOURCE}
              />
            }
            bottomCard={
              <InfoCard
                title={shortenHex(to)}
                subtitle="Recipient"
                imageSource={RECIPIENT_IMAGE_SOURCE}
              />
            }
          />
          {!gasError && (
            <Section title="Estimated Gas Fee" iconName="lightingFill">
              {gasEstimate != null ? (
                <DataRow
                  label="Fee"
                  value={formatGasFee(gasEstimate)}
                  trailing={
                    <Icon
                      name="gasStation"
                      className="zd:w-4 zd:h-4 zd:text-solarOrange"
                    />
                  }
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
