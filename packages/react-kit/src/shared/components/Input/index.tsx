import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  useState,
} from 'react'

import { cn } from '../../utils/common'
import { Wrapper } from '../Wrapper'

type Variant = 'default' | 'ghost' | 'listItemStyle'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  variant?: Variant
  multiline?: boolean
  // TODO: iconName prop — uncomment when Icon component is ready
  // iconName?: IconName
  children?: React.ReactNode
}

function getHeightClass(multiline: boolean | undefined, variant: Variant) {
  if (multiline) return 'h-32 py-3'
  if (variant === 'listItemStyle') return 'h-[68px]'
  return 'h-11'
}

const baseInputClass =
  'flex-1 px-0 text-gray-900 font-medium outline-none bg-transparent min-h-11 placeholder:text-gray-900/50 caret-gray-900'

export function Input({
  variant = 'default',
  multiline,
  children,
  className,
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
      className={cn(
        'flex w-full rounded-2xl items-center gap-3 pr-2',
        heightClass,
        paddingLeft,
      )}
      variant={isFocused ? 'solid' : 'soft'}
    >
      {/* TODO: Icon support — uncomment when Icon component is ready */}
      {/* {iconName && <InputIcon variant={variant} iconName={iconName} />} */}
      {inputElement}
      {children}
    </Wrapper>
  )
}
