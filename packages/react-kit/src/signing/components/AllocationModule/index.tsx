import { useId } from 'react'

import { Icon, type IconName } from '../../../shared/components/Icon'
import { Input } from '../../../shared/components/Input'
import { Text } from '../../../shared/components/Text'
import { WrappedPressable } from '../../../shared/components/WrappedPressable'
import { capitalizeFirst } from '../../../shared/utils/common'
import type { Token } from '../TokenCard'

export interface AllocationModuleProps {
  token: Token
  availableAmount: number
  checked: boolean
  onCheck: () => void
}

export function AllocationModule({
  token,
  availableAmount,
  checked,
  onCheck,
}: AllocationModuleProps) {
  const { symbol, imageSource, network } = token
  const checkboxId = useId()

  return (
    <div className="w-full flex flex-col p-2 pb-3 gap-2 border-b border-offWhite/50">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <div className="bg-offWhite rounded-xl w-11 h-11 flex items-center justify-center shrink-0">
            {imageSource && (
              <img src={imageSource} alt="" className="w-6 h-6" />
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
        <label
          htmlFor={checkboxId}
          className="flex flex-row items-center gap-2 cursor-pointer select-none"
        >
          <Text className="text-body1">
            {availableAmount} {symbol}
          </Text>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="h-4 w-4 cursor-pointer accent-solarOrange"
          />
        </label>
      </div>
      <Input placeholder="0">
        <WrappedPressable className="w-14 h-7">
          <Text>Max</Text>
        </WrappedPressable>
      </Input>
    </div>
  )
}
