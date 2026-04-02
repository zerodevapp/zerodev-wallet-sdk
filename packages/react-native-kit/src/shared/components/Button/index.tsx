import { Pressable, type PressableProps, Text, View } from 'react-native'

import { cn } from '../../utils/common'

const baseClass = 'items-center justify-center rounded-3xl h-16 self-stretch'

const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'bg-gray-900/90',
  secondary: 'bg-white/50 border border-gray-200',
  secondaryNeutral: 'bg-gray-700/70',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'text-white text-base',
  secondary: 'text-gray-900 text-base',
  secondaryNeutral: 'text-white text-base',
}

export interface ButtonProps extends PressableProps {
  text?: string
  action?: 'primary' | 'secondary' | 'secondaryNeutral'
  trailIcon?: boolean
}

export function Button({
  text,
  className,
  trailIcon: _trailIcon,
  disabled,
  action = 'primary',
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      role={rest.role ?? 'button'}
      className={cn(
        baseClass,
        bgClasses[action],
        {
          'opacity-50': disabled,
        },
        className,
      )}
      disabled={disabled === true}
      {...rest}
    >
      <View className="flex-row items-center gap-2 justify-center">
        {text && <Text className={textClasses[action]}>{text}</Text>}
      </View>
    </Pressable>
  )
}
