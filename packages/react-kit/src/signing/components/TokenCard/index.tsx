import { Icon, type IconName } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
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
    <div className="w-full p-2 flex flex-row justify-between items-center">
      <div className="flex flex-row items-center gap-2">
        <div className="bg-offWhite rounded-xl w-8 h-8 flex items-center justify-center shrink-0">
          {imageSource && (
            <img src={imageSource} alt="" className="w-[18px] h-[18px]" />
          )}
        </div>
        <div className="flex flex-col">
          <Text className="text-body1">{symbol}</Text>
          <div className="flex flex-row gap-1 items-center">
            <Icon name={network as IconName} className="h-3 w-3" />
            <Text className="text-body3 text-greyScale/50">
              {capitalizeFirst(network)}
            </Text>
          </div>
        </div>
      </div>
      <Text>
        {pooledAmount}{' '}
        <Text as="span" className="text-greyScale/50">
          / {availableAmount} {symbol}
        </Text>
      </Text>
    </div>
  )
}
