import { Icon, type IconName, Text } from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface GasRoute {
  source: string
  destination: string
  gasFee: string
}

export function RouteItem({ source, destination, gasFee }: GasRoute) {
  return (
    <div className="zd:w-full zd:flex zd:flex-row zd:items-center zd:justify-between">
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
        <div className="zd:relative zd:flex zd:flex-row zd:items-center zd:w-[52px] zd:h-8">
          <div className="zd:w-8 zd:h-8 zd:flex zd:items-center zd:justify-center zd:bg-offWhite zd:rounded-xl">
            <Icon
              name={source as IconName}
              className="zd:w-[18px] zd:h-[18px]"
            />
          </div>
          <div className="zd:w-8 zd:h-8 zd:flex zd:items-center zd:justify-center zd:bg-offWhite zd:rounded-xl zd:absolute zd:right-0">
            <Icon
              name={destination as IconName}
              className="zd:w-[18px] zd:h-[18px]"
            />
          </div>
        </div>
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
          <Text>{capitalizeFirst(source)}</Text>
          <Icon
            name="arrowRightFill"
            className="zd:h-3 zd:w-3 zd:text-greyScale/50"
          />
          <Text>{capitalizeFirst(destination)}</Text>
        </div>
      </div>
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
        <Text>{gasFee}</Text>
        <Icon name="gasStation" className="zd:w-4 zd:h-4 zd:text-solarOrange" />
      </div>
    </div>
  )
}
