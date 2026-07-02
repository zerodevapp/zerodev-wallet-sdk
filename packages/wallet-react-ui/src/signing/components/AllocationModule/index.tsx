import {
  Icon,
  type IconName,
  Input,
  Text,
  WrappedPressable,
} from '@zerodev/react-ui'
import { useId } from 'react'
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
    <div className="zd:w-full zd:flex zd:flex-col zd:p-2 zd:pb-3 zd:gap-2 zd:border-b zd:border-offWhite/50">
      <div className="zd:flex zd:flex-row zd:items-center zd:justify-between">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <div className="zd:bg-offWhite zd:rounded-xl zd:w-11 zd:h-11 zd:flex zd:items-center zd:justify-center zd:shrink-0">
            {imageSource && (
              <img src={imageSource} alt="" className="zd:w-6 zd:h-6" />
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
        <label
          htmlFor={checkboxId}
          className="zd:flex zd:flex-row zd:items-center zd:gap-2 zd:cursor-pointer zd:select-none"
        >
          <Text className="zd:text-body1">
            {availableAmount} {symbol}
          </Text>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="zd:h-4 zd:w-4 zd:cursor-pointer zd:accent-solarOrange"
          />
        </label>
      </div>
      <Input placeholder="0">
        <WrappedPressable className="zd:w-14 zd:h-7">
          <Text>Max</Text>
        </WrappedPressable>
      </Input>
    </div>
  )
}
