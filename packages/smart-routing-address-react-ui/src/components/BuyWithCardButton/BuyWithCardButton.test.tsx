/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BuyWithCardButton } from './index'

afterEach(cleanup)

describe('BuyWithCardButton', () => {
  it('renders the label and one chip per payment method', () => {
    render(<BuyWithCardButton />)
    expect(screen.getByText('Buy with card')).toBeDefined()
    for (const label of ['Visa', 'Mastercard', 'Google Pay', 'Apple Pay']) {
      expect(screen.getByTitle(label)).toBeDefined()
    }
  })

  it('fires onClick', () => {
    const onClick = vi.fn()
    render(<BuyWithCardButton onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy with card' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick while disabled', () => {
    const onClick = vi.fn()
    render(<BuyWithCardButton onClick={onClick} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy with card' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
