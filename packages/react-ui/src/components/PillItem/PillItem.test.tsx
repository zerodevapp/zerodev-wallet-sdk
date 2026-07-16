/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PillItem } from './index'

afterEach(cleanup)

describe('PillItem', () => {
  it('renders the label', () => {
    render(<PillItem label="USDC" />)
    expect(screen.getByText('USDC')).toBeDefined()
  })

  it('renders the logo image when logoUri is provided', () => {
    render(<PillItem label="USDC" logoUri="https://example.com/usdc.png" />)
    const img = screen.getByTestId('token-chain-pill-logo')
    expect(img.getAttribute('src')).toBe('https://example.com/usdc.png')
  })

  it('renders the initial placeholder when logoUri is absent', () => {
    render(<PillItem label="base" />)
    expect(screen.getByText('B')).toBeDefined()
  })

  it('is not interactive by default (no chevron, no button role)', () => {
    render(<PillItem label="USDC" />)
    expect(screen.queryByTestId('token-chain-pill-chevron')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('becomes an interactive button when onClick is supplied', () => {
    const onClick = vi.fn()
    render(<PillItem label="USDC" onClick={onClick} />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    expect(screen.getByTestId('token-chain-pill-chevron')).toBeDefined()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick on Enter and Space keys', () => {
    const onClick = vi.fn()
    render(<PillItem label="USDC" onClick={onClick} />)
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('ignores unrelated keys', () => {
    const onClick = vi.fn()
    render(<PillItem label="USDC" onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as non-interactive when disabled, even with onClick', () => {
    const onClick = vi.fn()
    render(<PillItem label="Arbitrum One" onClick={onClick} disabled />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByTestId('token-chain-pill-chevron')).toBeNull()
  })
})
