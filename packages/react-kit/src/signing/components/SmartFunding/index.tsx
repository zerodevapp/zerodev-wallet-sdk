import { Icon } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
import { ToggleButton } from '../../../shared/components/ToggleButton'
import { WrappedPressable } from '../../../shared/components/WrappedPressable'
import { Wrapper } from '../../../shared/components/Wrapper'
import { type Token, TokenCard } from '../TokenCard'

export interface SmartFundingProps {
  inputTokenSymbol: string
  pooledTokens: {
    token: Token
    availableAmount: string
    pooledAmount: string
  }[]
  totalPooledAmount: string
}

export function SmartFunding({
  inputTokenSymbol,
  pooledTokens,
  totalPooledAmount,
}: SmartFundingProps) {
  return (
    <Wrapper className="p-4 flex flex-col gap-3 rounded-xl w-full">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Icon name="stars" className="h-4 w-4 text-solarOrange" />
          <Text className="text-h3">Smart Funding</Text>
        </div>
        <div className="flex flex-row items-center gap-1">
          <ToggleButton value={true} />
          <WrappedPressable className="w-7 h-7">
            <Icon name="edit" className="h-3.5 w-3.5 text-solarOrange" />
          </WrappedPressable>
        </div>
      </div>
      <Text>
        Automatically pooling funds across different networks to minimize fees
        and execution time.
      </Text>
      {pooledTokens.map((pooledToken, key) => (
        <TokenCard
          key={pooledToken.token.symbol + key.toString()}
          token={pooledToken.token}
          pooledAmount={pooledToken.pooledAmount}
          availableAmount={pooledToken.availableAmount}
        />
      ))}
      <div className="flex flex-row items-center justify-between pt-4 px-2 border-t border-offWhite/50">
        <Text className="text-body1">Pooling outcome</Text>
        <Text className="text-body1">
          {totalPooledAmount} {inputTokenSymbol}
        </Text>
      </div>
    </Wrapper>
  )
}
