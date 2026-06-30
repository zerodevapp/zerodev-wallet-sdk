import { Icon, type IconName, Text } from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface GasRoute {
  source: string
  destination: string
  gasFee: string
}

export function RouteItem({ source, destination, gasFee }: GasRoute) {
  return (
    <div className="w-full flex flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-1">
        <div className="relative flex flex-row items-center w-[52px] h-8">
          <div className="w-8 h-8 flex items-center justify-center bg-offWhite rounded-xl">
            <Icon name={source as IconName} className="w-[18px] h-[18px]" />
          </div>
          <div className="w-8 h-8 flex items-center justify-center bg-offWhite rounded-xl absolute right-0">
            <Icon
              name={destination as IconName}
              className="w-[18px] h-[18px]"
            />
          </div>
        </div>
        <div className="flex flex-row items-center gap-1">
          <Text>{capitalizeFirst(source)}</Text>
          <Icon name="arrowRightFill" className="h-3 w-3 text-greyScale/50" />
          <Text>{capitalizeFirst(destination)}</Text>
        </div>
      </div>
      <div className="flex flex-row items-center gap-1">
        <Text>{gasFee}</Text>
        <Icon name="gasStation" className="w-4 h-4 text-solarOrange" />
      </div>
    </div>
  )
}
