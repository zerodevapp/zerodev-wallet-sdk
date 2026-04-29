import type { Address } from 'viem'
import { useReadContract } from 'wagmi'

import { Text } from '../../shared/components/Text'
import { shortenHex } from '../../shared/utils/common'
import { ArrowCardPair } from '../components/ArrowCardPair'
import { InfoCard } from '../components/InfoCard'
import { SigningLayout } from '../components/SigningLayout'
import { type GasFee, type GasTier, TxGasFees } from '../components/TxGasFees'
import { type Dapp, TxInformation } from '../components/TxInformation'

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
  dapp: Dapp
  selectedGasTier: GasTier
  gasFees: GasFee[]
  slippage?: number
  collectionImageSource: string
  spenderImageSource: string
}

export function CollectionApproval({
  contract,
  operator,
  approved,
  confirm,
  reject,
  dapp,
  selectedGasTier,
  gasFees,
  slippage,
  collectionImageSource,
  spenderImageSource,
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
        <TxInformation dapp={dapp} />
        <div className="flex flex-col gap-2">
          <Text className="text-body1 pt-2 px-2">
            You&#39;re approving permission to
          </Text>
          <ArrowCardPair
            topCard={
              <InfoCard
                title={collectionName}
                subtitle={cardSubtitle}
                imageSource={collectionImageSource}
              />
            }
            bottomCard={
              <InfoCard
                title="Spender"
                subtitle={shortenHex(operator)}
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
