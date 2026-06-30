import { Callout, Icon, Text, Wrapper } from '@zerodev/react-ui'
import { useState } from 'react'
import { DataRow } from '../DataRow'
import { type GasRoute, RouteItem } from '../RouteItem'

interface ProviderFee {
  provider: string
  percentage: number
  fee: string
}

export interface SmartFundingGasDetailsProps {
  executionTime: number
  slippage: number
  gasRoutes: { bridge?: GasRoute[]; swapped?: GasRoute[] }
  providerFees: ProviderFee[]
  bridgeAmount: string
  swapAmount: string
}

export function SmartFundingGasDetails({
  slippage,
  executionTime,
  gasRoutes,
  providerFees,
  bridgeAmount,
  swapAmount,
}: SmartFundingGasDetailsProps) {
  const [expanded, setExpanded] = useState(true)
  const formattedExecutionTime = `≈ ${executionTime} sec`
  const { bridge, swapped } = gasRoutes

  return (
    <Wrapper className="p-4 flex flex-col gap-6 rounded-xl w-full">
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center gap-2">
          <Icon name="stars" className="h-4 w-4 text-solarOrange" />
          <Text className="text-h3">Smart Funding Gas Details</Text>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="cursor-pointer"
        >
          <Icon
            name={expanded ? 'chevronUp' : 'chevronDown'}
            className="w-4 h-4 text-greyScale"
          />
        </button>
      </div>
      {expanded && (
        <>
          <div className="flex flex-col gap-3">
            <DataRow
              label="Total execution time"
              value={formattedExecutionTime}
              iconName="clock"
            />
            <DataRow
              label="Slippage:"
              value={`${slippage}%`}
              iconName="settings"
            />
          </div>

          {bridge && bridge.length > 0 && (
            <div className="flex flex-col gap-3">
              <Text>{bridge.length} Bridge</Text>
              {bridge.map((gasRoute, key) => (
                <RouteItem
                  key={`bridge${key.toString()}`}
                  source={gasRoute.source}
                  destination={gasRoute.destination}
                  gasFee={gasRoute.gasFee}
                />
              ))}
            </div>
          )}

          {swapped && swapped.length > 0 && (
            <div className="flex flex-col gap-3">
              <Text>{swapped.length} Swapped</Text>
              {swapped.map((gasRoute, key) => (
                <RouteItem
                  key={`swap${key.toString()}`}
                  source={gasRoute.source}
                  destination={gasRoute.destination}
                  gasFee={gasRoute.gasFee}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Text>Fees:</Text>
            {providerFees.map((item, key) => (
              <DataRow
                key={`fee${key.toString()}`}
                label={`${item.provider} Fee (${item.percentage}%)`}
                value={item.fee}
                iconName="gasStation"
              />
            ))}
          </div>

          <Callout
            title="Summary"
            description={`You are bridging ${bridgeAmount} and you are swapping for an equivalent of ${swapAmount}`}
          />
        </>
      )}
    </Wrapper>
  )
}
