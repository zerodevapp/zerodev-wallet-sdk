import { cn, Text, Wrapper } from '@zerodev/react-ui'
import { useEffect, useMemo, useRef, useState } from 'react'

const MIN_LENGTH = 4
const MAX_LENGTH = 8
const DEFAULT_LENGTH = 6

function clampLength(length: number): number {
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, length))
}

interface CharBoxProps {
  char: string
  isFocused: boolean
}

function CharBox({ char, isFocused }: CharBoxProps) {
  return (
    <Wrapper
      data-testid="code-input-box"
      data-active={isFocused || undefined}
      className={cn(
        'zd:h-16 zd:w-14 zd:rounded-lg zd:flex zd:items-center zd:justify-center',
        isFocused && 'zd:border-[1.5px] zd:border-greyScale',
      )}
    >
      <Text className="zd:text-h2">{char}</Text>
    </Wrapper>
  )
}

export interface CodeInputProps {
  onChange?: (code: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  length?: number
  'data-testid'?: string
}

export function CodeInput({
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
  length = DEFAULT_LENGTH,
  'data-testid': testId,
}: CodeInputProps) {
  const codeLength = clampLength(length)
  const charBoxes = useMemo(
    () =>
      Array.from({ length: codeLength }, (_, i) => ({
        id: `char-${i}`,
        index: i,
      })),
    [codeLength],
  )

  const [code, setCode] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus()
    }
  }, [autoFocus, disabled])

  useEffect(() => {
    setCode((prev) => prev.slice(0, codeLength))
  }, [codeLength])

  const handleChange = (text: string) => {
    const sanitized = text.slice(0, codeLength).toUpperCase()
    setCode(sanitized)
    onChange?.(sanitized)

    if (sanitized.length === codeLength) {
      // Makes sure onComplete is run on the next render cycle after the last char is rendered
      setTimeout(() => {
        onComplete?.(sanitized)
        inputRef.current?.blur()
      }, 0)
    }
  }

  return (
    <button
      type="button"
      className="zd:flex zd:flex-row zd:items-center zd:justify-between zd:gap-2 zd:w-full zd:cursor-text"
      onClick={() => inputRef.current?.focus()}
      disabled={disabled}
      data-testid={testId}
    >
      <input
        ref={inputRef}
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        maxLength={codeLength}
        disabled={disabled}
        className="zd:absolute zd:opacity-0 zd:pointer-events-none"
        style={{ position: 'absolute', opacity: 0 }}
        aria-label="Verification code"
      />
      {charBoxes.map((box) => (
        <CharBox
          key={box.id}
          char={code[box.index] ?? ''}
          isFocused={!error && isFocused && box.index === code.length}
        />
      ))}
    </button>
  )
}
