/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorRetryCard } from './index'

afterEach(cleanup)

const MESSAGE = 'Failed to create deposit address...'

describe('ErrorRetryCard', () => {
  it('renders the message', () => {
    render(<ErrorRetryCard message={MESSAGE} onRetry={() => {}} />)
    expect(screen.getByText(MESSAGE)).toBeDefined()
  })

  it('exposes role="alert" so assistive tech announces it', () => {
    render(<ErrorRetryCard message={MESSAGE} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('renders the retry button with the default aria-label', () => {
    render(<ErrorRetryCard message={MESSAGE} onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
  })

  it('honours a custom retryLabel', () => {
    render(
      <ErrorRetryCard
        message={MESSAGE}
        onRetry={() => {}}
        retryLabel="Try again"
      />,
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })

  it('fires onRetry when the button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorRetryCard message={MESSAGE} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  describe('busy state', () => {
    it('disables the button', () => {
      render(<ErrorRetryCard message={MESSAGE} onRetry={() => {}} busy />)
      const button = screen.getByRole('button', {
        name: 'Retry',
      }) as HTMLButtonElement
      expect(button.disabled).toBe(true)
    })

    it('marks the button aria-busy', () => {
      render(<ErrorRetryCard message={MESSAGE} onRetry={() => {}} busy />)
      expect(
        screen.getByRole('button', { name: 'Retry' }).getAttribute('aria-busy'),
      ).toBe('true')
    })

    it('does not fire onRetry while busy', () => {
      const onRetry = vi.fn()
      render(<ErrorRetryCard message={MESSAGE} onRetry={onRetry} busy />)
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(onRetry).not.toHaveBeenCalled()
    })
  })

  it('merges a custom className with the defaults', () => {
    render(
      <ErrorRetryCard
        message={MESSAGE}
        onRetry={() => {}}
        className="custom-class"
      />,
    )
    const root = screen.getByRole('alert')
    expect(root.className).toContain('custom-class')
    // Sanity: default background tint is still applied
    expect(root.className).toContain('zd:bg-error-subtle')
  })
})
