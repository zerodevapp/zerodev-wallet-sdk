/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SelectDropdown, type SelectDropdownItem } from './index'

const ITEMS: SelectDropdownItem[] = [
  {
    id: 'USDC',
    symbol: 'USDC',
    subtitle: '13 networks',
    logoBg: '#2775CA',
    badge: 'Recommended',
  },
  {
    id: 'WETH',
    symbol: 'WETH',
    subtitle: '11 networks',
    logoBg: '#627EEA',
  },
  {
    id: 'USDT',
    symbol: 'USDT',
    subtitle: '9 networks',
    logoBg: '#26A17B',
  },
]

afterEach(cleanup)

describe('SelectDropdown', () => {
  it('renders the selected item in the trigger', () => {
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={() => {}} />)
    expect(screen.getByText('USDC')).toBeDefined()
  })

  it('falls back to the first item when value is unknown', () => {
    render(<SelectDropdown items={ITEMS} value="???" onChange={() => {}} />)
    expect(screen.getByText('USDC')).toBeDefined()
  })

  it('does not render the list until the trigger is clicked', () => {
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={() => {}} />)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens the list when the trigger is clicked', () => {
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(ITEMS.length)
  })

  it('marks the currently-selected option with aria-selected', () => {
    render(<SelectDropdown items={ITEMS} value="WETH" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    const options = screen.getAllByRole('option')
    const selected = options.find(
      (el) => el.getAttribute('aria-selected') === 'true',
    )
    expect(selected?.textContent).toContain('WETH')
  })

  it('renders the badge next to items that have one', () => {
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Recommended')).toBeDefined()
  })

  it('calls onChange with the clicked item id and closes the list', () => {
    const onChange = vi.fn()
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    const wethOption = screen
      .getAllByRole('option')
      .find((el) => el.textContent?.includes('WETH'))
    expect(wethOption).toBeDefined()
    fireEvent.click(wethOption!)
    expect(onChange).toHaveBeenCalledWith('WETH')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes when Escape is pressed', () => {
    render(<SelectDropdown items={ITEMS} value="USDC" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('listbox')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  // Outside-click dismissal is provided by Radix's DismissableLayer primitive
  // (which listens on `pointerdown` at the document level with capture). It's
  // already covered by Radix's own tests; we skip re-verifying it here because
  // happy-dom's PointerEvent dispatch doesn't reliably reach the capture-phase
  // listener Radix installs on `document`.

  it('is not clickable when disabled', () => {
    render(
      <SelectDropdown
        items={ITEMS}
        value="USDC"
        onChange={() => {}}
        disabled
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('renders a disabled placeholder pill when the items list is empty', () => {
    render(<SelectDropdown items={[]} value="USDC" onChange={() => {}} />)
    // Both the label and the initial-letter fallback render '—'.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('uses the placeholderLabel prop when supplied', () => {
    render(
      <SelectDropdown
        items={[]}
        value=""
        onChange={() => {}}
        placeholderLabel="Loading"
      />,
    )
    expect(screen.getByText('Loading')).toBeDefined()
  })
})
