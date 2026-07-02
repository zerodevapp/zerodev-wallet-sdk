import {
  cn,
  Icon,
  type IconName,
  ListItem,
  ListItemSkeleton,
  Text,
  WrappedPressable,
  Wrapper,
} from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'
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
    <div
      className={cn(
        'zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse',
        className,
      )}
    />
  )
}

export function TxGasFeesSkeleton() {
  return (
    <Wrapper className="zd:rounded-xl zd:p-4 zd:w-full zd:flex zd:flex-col zd:gap-3">
      <div className="zd:flex zd:flex-row zd:items-center zd:justify-between">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <Icon
            name="lightingFill"
            className="zd:h-4 zd:w-4 zd:text-solarOrange"
          />
          <Text className="zd:text-xl">Estimated Gas Fees</Text>
        </div>
        <WrappedPressable className="zd:h-7 zd:pl-3 zd:pr-2">
          <Text>Market</Text>
          <Icon name="chevronDown" className="zd:h-4 zd:w-4" />
        </WrappedPressable>
      </div>
      <div className="zd:flex zd:flex-col zd:gap-4 zd:my-[1.5px]">
        <DataRow
          label="Fee"
          value={
            <div className="zd:flex zd:flex-row zd:gap-1">
              <SkeletonBar className="zd:w-[105px] zd:h-3" />
              <SkeletonBar className="zd:w-14 zd:h-3" />
            </div>
          }
        />
      </div>
      <div className="zd:flex zd:flex-col zd:gap-1">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </Wrapper>
  )
}

export function TxGasFees({
  selectedGasTier,
  gasFees,
  slippage,
}: TxGasFeesProps) {
  const selectedGasFee = gasFees.find((g) => g.tier === selectedGasTier)

  return (
    <Wrapper className="zd:rounded-xl zd:p-4 zd:w-full zd:flex zd:flex-col zd:gap-3">
      <div className="zd:flex zd:flex-row zd:items-center zd:justify-between">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <Icon
            name="lightingFill"
            className="zd:h-4 zd:w-4 zd:text-solarOrange"
          />
          <Text className="zd:text-xl">Estimated Gas Fees</Text>
        </div>
        <WrappedPressable className="zd:h-7 zd:pl-3 zd:pr-2">
          <Text>{capitalizeFirst(selectedGasTier)}</Text>
          <Icon name="chevronDown" className="zd:h-4 zd:w-4" />
        </WrappedPressable>
      </div>
      <div className="zd:flex zd:flex-col zd:gap-4">
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
      <div className="zd:flex zd:flex-col zd:gap-1">
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
