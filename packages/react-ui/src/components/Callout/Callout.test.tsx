import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../Icon', async () => {
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    Icon: MockIcon,
    icons: {},
  }
})

import { Callout } from './index'

afterEach(() => {
  cleanup()
})

describe('Callout', () => {
  it('renders the title', () => {
    render(<Callout title="Heads up" description="Something happened" />)
    expect(screen.getByText('Heads up')).toBeDefined()
  })

  it('renders the description', () => {
    render(<Callout title="Heads up" description="Something happened" />)
    expect(screen.getByText('Something happened')).toBeDefined()
  })

  it('renders the info icon', () => {
    render(<Callout title="Heads up" description="Detail" />)
    expect(screen.getByTestId('icon-info')).toBeDefined()
  })

  it('uses the solid Wrapper variant (rgba alpha 0.8)', () => {
    const { container } = render(
      <Callout title="Heads up" description="Detail" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toBe('rgba(255, 255, 255, 0.8)')
  })
})
