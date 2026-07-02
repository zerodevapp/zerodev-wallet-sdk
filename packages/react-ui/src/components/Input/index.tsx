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
  if (multiline) return 'zd:h-32 zd:py-3'
  if (variant === 'listItemStyle') return 'zd:h-[68px]'
  return 'zd:h-11'
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
      <div className="zd:w-13 zd:h-13 zd:shrink-0 zd:bg-white zd:rounded-2xl zd:flex zd:items-center zd:justify-center">
        <Icon name={iconName} className="zd:w-6 zd:h-6 zd:text-greyScale" />
      </div>
    )
  }
  return (
    <Icon
      name={iconName}
      className="zd:w-5 zd:h-5 zd:shrink-0 zd:text-greyScale/50"
    />
  )
}

// `min-w-0` is required so the input doesn't claim its intrinsic content
// width on mobile browsers (Chrome on Android most visibly), which would
// squash the leading icon and the trailing chevron-button child.
const baseInputClass =
  'zd:flex-1 zd:min-w-0 zd:px-0 zd:text-gray-900 zd:font-medium zd:outline-none zd:bg-transparent zd:min-h-11 zd:placeholder:text-gray-900/50 zd:caret-gray-900'

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
      className={cn(baseInputClass, 'zd:resize-none zd:h-full', className)}
    />
  ) : (
    <input
      {...inputProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(baseInputClass, 'zd:h-full', className)}
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
          'zd:w-full zd:pl-4 zd:pr-2 zd:resize-none',
          className,
        )}
      />
    ) : (
      <input
        {...inputProps}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(baseInputClass, 'zd:w-full zd:pl-4 zd:pr-2', className)}
      />
    )
  }

  const heightClass = getHeightClass(multiline, variant)
  const paddingLeft = variant === 'listItemStyle' ? 'zd:pl-2' : 'zd:pl-4'

  return (
    <Wrapper
      data-testid="input-wrapper"
      className={cn(
        'zd:relative zd:flex zd:w-full zd:rounded-2xl zd:items-center zd:gap-3 zd:pr-2',
        heightClass,
        paddingLeft,
        containerClassName,
      )}
      variant="soft"
    >
      {/* On focus, overlay a white/20 tint over the soft (white/0.5) base so the
          field matches the button hover state. */}
      {isFocused && (
        <div className="zd:absolute zd:inset-0 zd:bg-white/20 zd:pointer-events-none" />
      )}
      {iconName && <InputIcon variant={variant} iconName={iconName} />}
      {inputElement}
      {children}
    </Wrapper>
  )
}
