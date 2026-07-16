/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TokenListItem } from '.'

afterEach(() => cleanup())

describe('TokenListItem', () => {
  it('renders symbol, subtitle, value, and change', () => {
    render(
      <TokenListItem
        symbol="ETH"
        subtitle="3 networks"
        value="$0.00"
        change="+13.31%"
      />,
    )
    expect(screen.getByText('ETH')).toBeDefined()
    expect(screen.getByText('3 networks')).toBeDefined()
    expect(screen.getByText('$0.00')).toBeDefined()
    expect(screen.getByText('+13.31%')).toBeDefined()
  })

  it('renders as a button when onClick is provided', () => {
    const onClick = vi.fn()
    render(<TokenListItem symbol="ETH" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as a non-interactive div when no onClick', () => {
    render(<TokenListItem symbol="ETH" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('applies positive color by default for positive change', () => {
    render(<TokenListItem symbol="ETH" change="+13.31%" />)
    const change = screen.getByText('+13.31%')
    expect(change.className).toContain('text-positive')
  })

  it('applies negative color for change starting with -', () => {
    render(<TokenListItem symbol="ETH" change="-2.15%" />)
    const change = screen.getByText('-2.15%')
    expect(change.className).toContain('text-negative')
  })

  it('renders the skeleton when loading', () => {
    render(<TokenListItem symbol="ETH" loading />)
    expect(screen.queryByText('ETH')).toBeNull()
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(<TokenListItem symbol="ETH" onClick={onClick} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
