import type { Address } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'

const COLLECTION_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/shapes/svg?seed=collection'
const SPENDER_IMAGE_SOURCE =
  'https://api.dicebear.com/7.x/identicon/svg?seed=spender'
const SELECTED_GAS_TIER: GasTier = 'market'
const GAS_FEES: GasFee[] = [
  { tier: 'low', duration: 60, fee: '0.0002 ETH', feeUsd: '$0.50' },
  { tier: 'market', duration: 30, fee: '0.0004 ETH', feeUsd: '$1.00' },
  { tier: 'fast', duration: 15, fee: '0.0008 ETH', feeUsd: '$2.00' },
]
const SLIPPAGE = 0.5

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
  operator: Address
  approved: boolean
  confirm: () => void
  reject: () => void
}

export function CollectionApproval({
  contract,
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

  if (isLoading) {
    return <Text>Loading collection details...</Text>
  }

  const collectionName = name || 'Unknown collection'
  const cardSubtitle = approved
    ? 'Grant Collection Approval'
    : 'Revoke Collection Approval'

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
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
