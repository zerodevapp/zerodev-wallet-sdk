import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  useState,
} from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Wrapper } from '../Wrapper'

type Variant = 'default' | 'ghost' | 'listItemStyle'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  variant?: Variant
  multiline?: boolean
  iconName?: IconName
  children?: React.ReactNode
  containerClassName?: string
}

function getHeightClass(multiline: boolean | undefined, variant: Variant) {
  if (multiline) return 'h-32 py-3'
  if (variant === 'listItemStyle') return 'h-[68px]'
  return 'h-11'
}

function InputIcon({
  variant,
  iconName,
}: {
  variant: Variant
  iconName: IconName
}) {
  if (variant === 'listItemStyle') {
    return (
      <div className="w-13 h-13 shrink-0 bg-white rounded-2xl flex items-center justify-center">
        <Icon name={iconName} className="w-6 h-6 text-greyScale" />
      </div>
    )
  }
  return <Icon name={iconName} className="w-5 h-5 shrink-0 text-greyScale/50" />
}

// `min-w-0` is required so the input doesn't claim its intrinsic content
// width on mobile browsers (Chrome on Android most visibly), which would
// squash the leading icon and the trailing chevron-button child.
const baseInputClass =
  'flex-1 min-w-0 px-0 text-gray-900 font-medium outline-none bg-transparent min-h-11 placeholder:text-gray-900/50 caret-gray-900'

export function Input({
  variant = 'default',
  multiline,
  iconName,
  children,
  className,
  containerClassName,
  onFocus,
  onBlur,
  ...inputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const handleFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setIsFocused(true)
    onFocus?.(e as React.FocusEvent<HTMLInputElement>)
  }

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setIsFocused(false)
    onBlur?.(e as React.FocusEvent<HTMLInputElement>)
  }

  const inputElement = multiline ? (
    <textarea
      {...(inputProps as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(baseInputClass, 'resize-none h-full', className)}
    />
  ) : (
    <input
      {...inputProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(baseInputClass, 'h-full', className)}
    />
  )

  if (variant === 'ghost') {
    return multiline ? (
      <textarea
        {...(inputProps as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        onFocus={
          onFocus as TextareaHTMLAttributes<HTMLTextAreaElement>['onFocus']
        }
        onBlur={onBlur as TextareaHTMLAttributes<HTMLTextAreaElement>['onBlur']}
        className={cn(
          baseInputClass,
          'w-full pl-4 pr-2 resize-none',
          className,
        )}
      />
    ) : (
      <input
        {...inputProps}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(baseInputClass, 'w-full pl-4 pr-2', className)}
      />
    )
  }

  const heightClass = getHeightClass(multiline, variant)
  const paddingLeft = variant === 'listItemStyle' ? 'pl-2' : 'pl-4'

  return (
    <Wrapper
      data-testid="input-wrapper"
      className={cn(
        'relative flex w-full rounded-2xl items-center gap-3 pr-2',
        heightClass,
        paddingLeft,
        containerClassName,
      )}
      variant="soft"
    >
      {/* On focus, overlay a white/20 tint over the soft (white/0.5) base so the
          field matches the button hover state. */}
      {isFocused && (
        <div className="absolute inset-0 bg-white/20 pointer-events-none" />
      )}
      {iconName && <InputIcon variant={variant} iconName={iconName} />}
      {inputElement}
      {children}
    </Wrapper>
  )
}
