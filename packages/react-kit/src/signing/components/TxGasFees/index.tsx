import { Icon, type IconName } from '../../../shared/components/Icon'
import { ListItem, ListItemSkeleton } from '../../../shared/components/ListItem'
import { Text } from '../../../shared/components/Text'
import { WrappedPressable } from '../../../shared/components/WrappedPressable'
import { Wrapper } from '../../../shared/components/Wrapper'
import { capitalizeFirst, cn } from '../../../shared/utils/common'
import { DataRow } from '../DataRow'

export type GasTier = 'low' | 'market' | 'fast'

export interface GasFee {
  tier: GasTier
  duration: number
  fee: string
  feeUsd?: string
}

export interface TxGasFeesProps {
  selectedGasTier: GasTier
  gasFees: GasFee[]
  slippage?: number
}

function getTierIcon(tier: GasTier): IconName {
  switch (tier.toLowerCase()) {
    case 'low':
      return 'hourglass'
    case 'market':
      return 'rocket'
    case 'fast':
      return 'lightingFill'
    default:
      return 'clock'
  }
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg bg-offWhite/50 animate-pulse', className)} />
  )
}

export function TxGasFeesSkeleton() {
  return (
    <Wrapper className="rounded-xl p-4 w-full flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Icon name="lightingFill" className="h-4 w-4 text-solarOrange" />
          <Text className="text-xl">Estimated Gas Fees</Text>
        </div>
        <WrappedPressable className="h-7 pl-3 pr-2">
          <Text>Market</Text>
          <Icon name="chevronDown" className="h-4 w-4" />
        </WrappedPressable>
      </div>
      <div className="flex flex-col gap-4 my-[1.5px]">
        <DataRow
          label="Fee"
          value={
            <div className="flex flex-row gap-1">
              <SkeletonBar className="w-[105px] h-3" />
              <SkeletonBar className="w-14 h-3" />
            </div>
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </Wrapper>
  )
}

export function TxGasFeesUI({
  selectedGasTier,
  gasFees,
  slippage,
}: TxGasFeesProps) {
  const selectedGasFee = gasFees.find((g) => g.tier === selectedGasTier)

  return (
    <Wrapper className="rounded-xl p-4 w-full flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Icon name="lightingFill" className="h-4 w-4 text-solarOrange" />
          <Text className="text-xl">Estimated Gas Fees</Text>
        </div>
        <WrappedPressable className="h-7 pl-3 pr-2">
          <Text>{capitalizeFirst(selectedGasTier)}</Text>
          <Icon name="chevronDown" className="h-4 w-4" />
        </WrappedPressable>
      </div>
      <div className="flex flex-col gap-4">
        <DataRow
          label="Fee"
          value={`${selectedGasFee?.fee} (${selectedGasFee?.feeUsd})`}
          iconName="gasStation"
          leadingIconName="warning"
        />
        {typeof slippage === 'number' && (
          <DataRow
            label="Slippage"
            value={`${slippage}%`}
            iconName="settings"
          />
        )}
      </div>
      <div className="flex flex-col gap-1">
        {gasFees.map((item) => (
          <ListItem
            key={item.tier}
            title={capitalizeFirst(item.tier)}
            iconName={getTierIcon(item.tier)}
            details={{
              text: item.fee,
              ...(item.feeUsd && { subtext: item.feeUsd }),
            }}
          />
        ))}
      </div>
    </Wrapper>
  )
}
