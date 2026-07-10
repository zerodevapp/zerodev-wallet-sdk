/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LoadingCard } from './index'

afterEach(cleanup)

describe('LoadingCard', () => {
  it('renders the status text', () => {
    render(<LoadingCard text="Watching for your deposit on Base…" />)
    expect(screen.getByText('Watching for your deposit on Base…')).toBeDefined()
  })

  it('renders the spinner icon', () => {
    render(<LoadingCard text="Loading…" />)
    expect(screen.getByTestId('loading-card-icon')).toBeDefined()
  })

  it('forwards extra HTML attributes (e.g., data-testid) to the root', () => {
    render(<LoadingCard text="Loading…" data-testid="custom-root" />)
    expect(screen.getByTestId('custom-root')).toBeDefined()
  })

  it('merges custom className with defaults', () => {
    const { container } = render(
      <LoadingCard text="Loading…" className="custom-class" />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('custom-class')
    // Sanity: the default height class is still applied
    expect(root.className).toContain('zd:h-[68px]')
  })
})
