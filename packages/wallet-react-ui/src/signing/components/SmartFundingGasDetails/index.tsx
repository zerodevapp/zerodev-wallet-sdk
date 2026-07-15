import { Callout, DataRow, Icon, Text, Wrapper } from '@zerodev/react-ui'
import { useState } from 'react'
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
    <Wrapper className="zd:p-4 zd:flex zd:flex-col zd:gap-6 zd:rounded-xl zd:w-full">
      <div className="zd:flex zd:flex-row zd:justify-between zd:items-center">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <Icon name="stars" className="zd:h-4 zd:w-4 zd:text-solarOrange" />
          <Text className="zd:text-h3">Smart Funding Gas Details</Text>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="zd:cursor-pointer"
        >
          <Icon
            name={expanded ? 'chevronUp' : 'chevronDown'}
            className="zd:w-4 zd:h-4 zd:text-greyScale"
          />
        </button>
      </div>
      {expanded && (
        <>
          <div className="zd:flex zd:flex-col zd:gap-3">
            <DataRow
              label="Total execution time"
              value={formattedExecutionTime}
              trailing={
                <Icon
                  name="clock"
                  className="zd:w-4 zd:h-4 zd:text-solarOrange"
                />
              }
            />
            <DataRow
              label="Slippage:"
              value={`${slippage}%`}
              trailing={
                <Icon
                  name="settings"
                  className="zd:w-4 zd:h-4 zd:text-solarOrange"
                />
              }
            />
          </div>

          {bridge && bridge.length > 0 && (
            <div className="zd:flex zd:flex-col zd:gap-3">
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
            <div className="zd:flex zd:flex-col zd:gap-3">
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

          <div className="zd:flex zd:flex-col zd:gap-3">
            <Text>Fees:</Text>
            {providerFees.map((item, key) => (
              <DataRow
                key={`fee${key.toString()}`}
                label={`${item.provider} Fee (${item.percentage}%)`}
                value={item.fee}
                trailing={
                  <Icon
                    name="gasStation"
                    className="zd:w-4 zd:h-4 zd:text-solarOrange"
                  />
                }
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
