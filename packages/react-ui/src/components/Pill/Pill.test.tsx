/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pill } from './index'

afterEach(cleanup)

describe('Pill', () => {
  it('renders the label', () => {
    render(<Pill label="USDC" />)
    expect(screen.getByText('USDC')).toBeDefined()
  })

  it('renders the logo image when logoUri is provided', () => {
    render(<Pill label="USDC" logoUri="https://example.com/usdc.png" />)
    const img = screen.getByTestId('token-chain-pill-logo')
    expect(img.getAttribute('src')).toBe('https://example.com/usdc.png')
  })

  it('renders the initial placeholder when logoUri is absent', () => {
    render(<Pill label="base" />)
    expect(screen.getByText('B')).toBeDefined()
  })

  it('renders no trailing icon by default and no button role without onClick', () => {
    render(<Pill label="USDC" />)
    expect(screen.queryByTestId('pill-trailing-icon')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the trailing icon slot when trailingIcon is supplied', () => {
    render(
      <Pill label="USDC" trailingIcon={<span data-testid="stub-icon" />} />,
    )
    expect(screen.getByTestId('pill-trailing-icon')).toBeDefined()
    expect(screen.getByTestId('stub-icon')).toBeDefined()
  })

  it('becomes an interactive button when onClick is supplied', () => {
    const onClick = vi.fn()
    render(<Pill label="USDC" onClick={onClick} />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick on Enter and Space keys', () => {
    const onClick = vi.fn()
    render(<Pill label="USDC" onClick={onClick} />)
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('ignores unrelated keys', () => {
    const onClick = vi.fn()
    render(<Pill label="USDC" onClick={onClick} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders as non-interactive when disabled, even with onClick', () => {
    const onClick = vi.fn()
    render(<Pill label="Arbitrum One" onClick={onClick} disabled />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
