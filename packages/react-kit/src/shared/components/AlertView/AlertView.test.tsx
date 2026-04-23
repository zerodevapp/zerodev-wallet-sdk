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

import { AlertView } from './index'

afterEach(() => {
  cleanup()
})

describe('AlertView', () => {
  it('renders the title', () => {
    render(<AlertView title="Heads up" description="Something happened" />)
    expect(screen.getByText('Heads up')).toBeDefined()
  })

  it('renders the description', () => {
    render(<AlertView title="Heads up" description="Something happened" />)
    expect(screen.getByText('Something happened')).toBeDefined()
  })

  it('renders the info icon', () => {
    render(<AlertView title="Heads up" description="Detail" />)
    expect(screen.getByTestId('icon-info')).toBeDefined()
  })

  it('uses the solid Wrapper variant (rgba alpha 0.8)', () => {
    const { container } = render(
      <AlertView title="Heads up" description="Detail" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toBe('rgba(247, 245, 240, 0.8)')
  })
})
