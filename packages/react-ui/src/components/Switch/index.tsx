import { cn } from '../../utils/common'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface SwitchProps {
  value?: boolean
  onValueChange?: () => void
}

export function Switch({ value, onValueChange }: SwitchProps) {
  return (
    <Wrapper variant="ghost" className="zd:w-14 zd:h-7 zd:rounded-xl zd:p-1">
      <button
        type="button"
        role="switch"
        aria-checked={value ?? false}
        onClick={onValueChange}
        className="zd:flex zd:items-center zd:justify-center zd:flex-row zd:gap-1.5 zd:w-full zd:h-full zd:rounded-lg zd:bg-white/70 zd:cursor-pointer"
      >
        {value && (
          <Text className="zd:text-body3 zd:text-greyScale/90">On</Text>
        )}
        <div
          className={cn(
            'zd:w-3.5 zd:h-3.5 zd:rounded-full zd:shadow-sm',
            value ? 'zd:bg-solarOrange' : 'zd:bg-greyScale/30',
          )}
        />
        {!value && (
          <Text className="zd:text-body3 zd:text-greyScale/50">Off</Text>
        )}
      </button>
    </Wrapper>
  )
}
