import { Icon, type IconName, Text } from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface Token {
  symbol: string
  imageSource?: string
  network: string
}

export interface TokenCardProps {
  token: Token
  pooledAmount: string
  availableAmount: string
}

export function TokenCard({
  token,
  pooledAmount,
  availableAmount,
}: TokenCardProps) {
  const { symbol, imageSource, network } = token

  return (
    <div className="zd:w-full zd:p-2 zd:flex zd:flex-row zd:justify-between zd:items-center">
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
        <div className="zd:bg-offWhite zd:rounded-xl zd:w-8 zd:h-8 zd:flex zd:items-center zd:justify-center zd:shrink-0">
          {imageSource && (
            <img src={imageSource} alt="" className="zd:w-[18px] zd:h-[18px]" />
          )}
        </div>
        <div className="zd:flex zd:flex-col">
          <Text className="zd:text-body1">{symbol}</Text>
          <div className="zd:flex zd:flex-row zd:gap-1 zd:items-center">
            <Icon name={network as IconName} className="zd:h-3 zd:w-3" />
            <Text className="zd:text-body3 zd:text-greyScale/50">
              {capitalizeFirst(network)}
            </Text>
          </div>
        </div>
      </div>
      <Text>
        {pooledAmount}{' '}
        <Text as="span" className="zd:text-greyScale/50">
          / {availableAmount} {symbol}
        </Text>
      </Text>
    </div>
  )
}
