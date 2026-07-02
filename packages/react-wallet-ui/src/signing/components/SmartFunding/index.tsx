import {
  Icon,
  Switch,
  Text,
  WrappedPressable,
  Wrapper,
} from '@zerodev/react-ui'
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
    <Wrapper className="zd:p-4 zd:flex zd:flex-col zd:gap-3 zd:rounded-xl zd:w-full">
      <div className="zd:flex zd:flex-row zd:items-center zd:justify-between">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <Icon name="stars" className="zd:h-4 zd:w-4 zd:text-solarOrange" />
          <Text className="zd:text-h3">Smart Funding</Text>
        </div>
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
          <Switch value={true} />
          <WrappedPressable className="zd:w-7 zd:h-7">
            <Icon
              name="edit"
              className="zd:h-3.5 zd:w-3.5 zd:text-solarOrange"
            />
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
      <div className="zd:flex zd:flex-row zd:items-center zd:justify-between zd:pt-4 zd:px-2 zd:border-t zd:border-offWhite/50">
        <Text className="zd:text-body1">Pooling outcome</Text>
        <Text className="zd:text-body1">
          {totalPooledAmount} {inputTokenSymbol}
        </Text>
      </div>
    </Wrapper>
  )
}
