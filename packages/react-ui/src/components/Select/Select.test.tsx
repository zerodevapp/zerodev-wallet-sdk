/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
} from './index'

const TOKENS = [
  { id: 'USDC', symbol: 'USDC' },
  { id: 'WETH', symbol: 'WETH' },
  { id: 'USDT', symbol: 'USDT' },
]

// Radix Select uses PointerEvent internally; happy-dom needs the standard
// pointer coords for click-to-open to work.
function clickTrigger(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

function Fixture({
  onValueChange,
  disabled,
  initialValue = 'USDC',
}: {
  onValueChange?: (id: string) => void
  disabled?: boolean
  initialValue?: string
} = {}) {
  const [value, setValue] = useState(initialValue)
  const handleChange = (v: string) => {
    setValue(v)
    onValueChange?.(v)
  }
  return (
    <Select
      value={value}
      onValueChange={handleChange}
      {...(disabled && { disabled })}
    >
      <SelectTrigger>
        <span>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {TOKENS.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <SelectItemText>{t.symbol}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

afterEach(cleanup)

describe('Select', () => {
  it('renders the trigger with the current value', () => {
    render(<Fixture initialValue="WETH" />)
    expect(screen.getByRole('combobox').textContent).toContain('WETH')
  })

  it('opens the listbox when the trigger is clicked', () => {
    render(<Fixture />)
    expect(screen.queryByRole('listbox')).toBeNull()
    clickTrigger(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeDefined()
  })

  it('renders one option per item', () => {
    render(<Fixture />)
    clickTrigger(screen.getByRole('combobox'))
    expect(screen.getAllByRole('option')).toHaveLength(TOKENS.length)
  })

  it('calls onValueChange with the picked item id', () => {
    const onValueChange = vi.fn()
    render(<Fixture onValueChange={onValueChange} />)
    clickTrigger(screen.getByRole('combobox'))
    const weth = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('WETH'))
    expect(weth).toBeDefined()
    fireEvent.click(weth!)
    expect(onValueChange).toHaveBeenCalledWith('WETH')
  })

  it('does not open when disabled', () => {
    render(<Fixture disabled />)
    clickTrigger(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
