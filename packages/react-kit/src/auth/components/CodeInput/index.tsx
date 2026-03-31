import { useEffect, useRef, useState } from 'react'

import { cn } from '../../../shared/utils/common'

export interface CodeInputProps {
  length?: number
  onChange?: (code: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  'data-testid'?: string
}

export function CodeInput({
  length = 6,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
  'data-testid': testId,
}: CodeInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const digitKeys = useRef(Array.from({ length }, (_, i) => `digit-${i}`))

  useEffect(() => {
    setValues(Array(length).fill(''))
    digitKeys.current = Array.from({ length }, (_, i) => `digit-${i}`)
    inputRefs.current = inputRefs.current.slice(0, length)
  }, [length])
  const focusIndex = (index: number) => {
    inputRefs.current[index]?.focus()
  }

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus])

  const handleChange = (index: number, raw: string) => {
    // Accept only the last digit typed (handles Android auto-fill sending full string)
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...values]
    next[index] = digit
    setValues(next)

    const code = next.join('')
    onChange?.(code)
    if (digit && index < length - 1) {
      focusIndex(index + 1)
    }
    if (code.replace(/\s/g, '').length === length && !next.includes('')) {
      onComplete?.(code)
    }
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace') {
      if (values[index]) {
        const next = [...values]
        next[index] = ''
        setValues(next)
        onChange?.(next.join(''))
      } else if (index > 0) {
        focusIndex(index - 1)
        const next = [...values]
        next[index - 1] = ''
        setValues(next)
        onChange?.(next.join(''))
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      focusIndex(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length)
    if (!pasted) return
    const next = [...values]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i] ?? ''
    }
    setValues(next)
    const code = next.join('')
    onChange?.(code)
    const focusTarget = Math.min(pasted.length, length - 1)
    focusIndex(focusTarget)
    if (pasted.length === length) {
      onComplete?.(code)
    }
  }

  return (
    <div className="flex gap-3" data-testid={testId}>
      {digitKeys.current.map((key, i) => (
        <input
          key={key}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={values[i] ?? ''}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          data-testid={testId ? `${testId}-${i}` : undefined}
          onChange={(e) => {
            handleChange(i, e.target.value)
          }}
          onKeyDown={(e) => {
            handleKeyDown(i, e)
          }}
          onPaste={handlePaste}
          onFocus={(e) => {
            e.target.select()
          }}
          className={cn(
            'w-12 h-14 text-center text-xl font-semibold rounded-xl border-2 outline-none transition-colors',
            'bg-white text-gray-900 caret-transparent',
            error
              ? 'border-red-500 focus:border-red-600'
              : 'border-gray-200 focus:border-gray-900',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
          )}
        />
      ))}
    </div>
  )
}
