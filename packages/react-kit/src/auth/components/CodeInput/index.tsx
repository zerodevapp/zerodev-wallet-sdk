import { useEffect, useRef, useState } from 'react'

import { Text } from '../../../shared/components/Text'
import { Wrapper } from '../../../shared/components/Wrapper'
import { cn } from '../../../shared/utils/common'

const CODE_LENGTH = 6
const CHAR_BOXES = Array.from({ length: CODE_LENGTH }, (_, i) => ({
  id: `char-${i}`,
  index: i,
}))

interface CharBoxProps {
  char: string
  isFocused: boolean
}

function CharBox({ char, isFocused }: CharBoxProps) {
  return (
    <Wrapper
      className={cn(
        'h-16 w-14 rounded-lg flex items-center justify-center',
        isFocused && 'border-[1.5px] border-greyScale',
      )}
    >
      <Text className="text-h2 text-greyScale font-sans font-medium">
        {char}
      </Text>
    </Wrapper>
  )
}

export interface CodeInputProps {
  onChange?: (code: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  'data-testid'?: string
}

export function CodeInput({
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
  'data-testid': testId,
}: CodeInputProps) {
  const [code, setCode] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRef.current?.focus()
    }
  }, [autoFocus, disabled])

  const handleChange = (text: string) => {
    const sanitized = text.slice(0, CODE_LENGTH).toUpperCase()
    setCode(sanitized)
    onChange?.(sanitized)

    if (sanitized.length === CODE_LENGTH) {
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
      className="flex flex-row items-center justify-between gap-2 w-full cursor-text"
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
        maxLength={CODE_LENGTH}
        disabled={disabled}
        className="absolute opacity-0 pointer-events-none"
        style={{ position: 'absolute', opacity: 0 }}
        aria-label="Verification code"
      />
      {CHAR_BOXES.map((box) => (
        <CharBox
          key={box.id}
          char={code[box.index] ?? ''}
          isFocused={!error && isFocused && box.index === code.length}
        />
      ))}
    </button>
  )
}
