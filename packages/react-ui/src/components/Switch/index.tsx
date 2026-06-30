import { cn } from '../../utils/common'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface SwitchProps {
  value?: boolean
  onValueChange?: () => void
}

export function Switch({ value, onValueChange }: SwitchProps) {
  return (
    <Wrapper variant="ghost" className="w-14 h-7 rounded-xl p-1">
      <button
        type="button"
        role="switch"
        aria-checked={value ?? false}
        onClick={onValueChange}
        className="flex items-center justify-center flex-row gap-1.5 w-full h-full rounded-lg bg-white/70 cursor-pointer"
      >
        {value && <Text className="text-body3 text-greyScale/90">On</Text>}
        <div
          className={cn(
            'w-3.5 h-3.5 rounded-full shadow-sm',
            value ? 'bg-solarOrange' : 'bg-greyScale/30',
          )}
        />
        {!value && <Text className="text-body3 text-greyScale/50">Off</Text>}
      </button>
    </Wrapper>
  )
}
