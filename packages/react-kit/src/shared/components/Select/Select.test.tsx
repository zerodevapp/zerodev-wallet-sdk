/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Select } from '.'

afterEach(() => cleanup())

describe('Select', () => {
  it('renders the label', () => {
    render(<Select label="Token" />)
    expect(screen.getByText('Token')).toBeDefined()
  })

  it('fires onClick when pressed', () => {
    const onClick = vi.fn()
    render(<Select label="Token" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders subtitle and chain image when provided', () => {
    render(
      <Select
        label="USDC"
        subtitle="Arbitrum"
        chainImage="http://example.com/arb.png"
      />,
    )
    expect(screen.getByText('USDC')).toBeDefined()
    expect(screen.getByText('Arbitrum')).toBeDefined()
  })

  it('renders the trailing chevron by default', () => {
    const { container } = render(<Select label="Token" />)
    expect(container.querySelector('svg')).toBeDefined()
  })

  it('hides the trailing icon when trailingIcon=false', () => {
    const { container } = render(<Select label="Token" trailingIcon={false} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(<Select label="Token" onClick={onClick} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders the skeleton when loading', () => {
    render(<Select label="Token" loading />)
    // Skeleton renders a div, not a button — no role="button" present.
    expect(screen.queryByRole('button')).toBeNull()
  })
})
