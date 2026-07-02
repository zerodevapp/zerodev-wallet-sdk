import { Text } from '@zerodev/react-ui'
import type { Address, Hex } from 'viem'
import { useReadContract } from 'wagmi'
import { DataRow, DataRowSkeleton } from '../components/DataRow'
import { InfoCard } from '../components/InfoCard'
import { Section } from '../components/Section'
import { SigningLayout } from '../components/SigningLayout'
import { SigningPageSkeleton } from '../components/SigningPageSkeleton'
import { useGasEstimate } from '../hooks/useGasEstimate'
import { formatGasFee } from '../utils/formatGasFee'

const COLLECTION_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/shapes/svg?seed=collection'

const nameAbi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

interface MintNftProps {
  contract: Address
  data: Hex
  confirm: () => void
  reject: () => void
}

export function MintNft({ contract, data, confirm, reject }: MintNftProps) {
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
          <Text className="zd:text-h2">Mint NFT</Text>
          <Text className="zd:text-center">
            You are about to mint an NFT from {collectionName}.
          </Text>
        </div>
        <div className="zd:flex zd:flex-col zd:gap-2">
          <Text className="zd:text-body1 zd:pt-2 zd:px-2">
            You&#39;re minting from
          </Text>
          <InfoCard
            title={collectionName}
            imageSource={COLLECTION_IMAGE_SOURCE}
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
