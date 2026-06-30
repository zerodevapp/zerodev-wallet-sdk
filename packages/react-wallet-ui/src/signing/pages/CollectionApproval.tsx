import { Text } from '@zerodev/react-ui'
import type { Address, Hex } from 'viem'
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

const COLLECTION_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/shapes/svg?seed=collection'
const SPENDER_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=spender'

const nameAbi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

interface CollectionApprovalProps {
  contract: Address
  data: Hex
  operator: Address
  approved: boolean
  confirm: () => void
  reject: () => void
}

export function CollectionApproval({
  contract,
  data,
  operator,
  approved,
  confirm,
  reject,
}: CollectionApprovalProps) {
  const { data: name, isLoading } = useReadContract({
    address: contract,
    abi: nameAbi,
    functionName: 'name',
  })

  const {
    data: gasEstimate,
    isFetching: gasFetching,
    error: gasError,
  } = useGasEstimate({
    calls: [{ to: contract, data }],
  })

  if (isLoading) {
    return (
      <SigningLayout onConfirm={confirm} onReject={reject} disabled>
        <SigningPageSkeleton />
      </SigningLayout>
    )
  }

  const collectionName = name || 'Unknown collection'
  const cardSubtitle = approved
    ? 'Grant Collection Approval'
    : 'Revoke Collection Approval'
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
          <Text className="text-h2">
            {approved
              ? 'Grant Collection Approval'
              : 'Revoke Collection Approval'}
          </Text>
          <Text className="text-center">
            {approved
              ? `Allow this contract to manage all your ${collectionName} tokens.`
              : `Revoke this contract's permission to manage your ${collectionName} tokens.`}
          </Text>
        </div>
        <div className="flex flex-col gap-2">
          <Text className="text-body1 pt-2 px-2">
            You&#39;re approving permission to
          </Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={collectionName}
                subtitle={cardSubtitle}
                imageSource={COLLECTION_IMAGE_SOURCE}
              />
            }
            bottomCard={
              <InfoCard
                title="Spender"
                subtitle={shortenHex(operator)}
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
