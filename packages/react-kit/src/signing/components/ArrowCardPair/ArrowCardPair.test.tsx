import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/components/Icon', async () => {
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

import { ArrowCardPair, ArrowView } from './index'

afterEach(() => {
  cleanup()
})

describe('ArrowCardPair', () => {
  it('renders the top and bottom card content', () => {
    render(
      <ArrowCardPair
        topCard={<div>Top card content</div>}
        bottomCard={<div>Bottom card content</div>}
      />,
    )
    expect(screen.getByText('Top card content')).toBeDefined()
    expect(screen.getByText('Bottom card content')).toBeDefined()
  })

  it('renders the chevron-down arrow between the cards', () => {
    render(
      <ArrowCardPair topCard={<div>Top</div>} bottomCard={<div>Bottom</div>} />,
    )
    expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
  })

  it('wraps each card in its own clipped container', () => {
    render(
      <ArrowCardPair topCard={<div>Top</div>} bottomCard={<div>Bottom</div>} />,
    )
    expect(screen.getByTestId('clipped-card-top')).toBeDefined()
    expect(screen.getByTestId('clipped-card-bottom')).toBeDefined()
  })
})

describe('ArrowView', () => {
  it('renders a standalone chevron-down arrow', () => {
    render(<ArrowView />)
    expect(screen.getByTestId('icon-chevronDown')).toBeDefined()
  })

  it('forwards className to the outer arrow container', () => {
    const { container } = render(<ArrowView className="custom-class" />)
    expect(container.querySelector('.custom-class')).not.toBeNull()
  })
})
