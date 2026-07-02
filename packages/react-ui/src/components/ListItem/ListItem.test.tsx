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

import { ListItem, ListItemSkeleton } from './index'

afterEach(() => {
  cleanup()
})

describe('ListItem', () => {
  it('renders title', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeDefined()
  })

  it('renders subtitle when provided', () => {
    render(<ListItem title="Test Title" subtitle="Test Subtitle" />)
    expect(screen.getByText('Test Subtitle')).toBeDefined()
  })

  it('renders icon when iconName is provided', () => {
    render(<ListItem title="Test Title" iconName="wallet" />)
    expect(screen.getByTestId('icon-wallet')).toBeDefined()
  })

  it('renders chevron when chevron prop is true', () => {
    render(<ListItem title="Test Title" chevron />)
    expect(screen.getByTestId('icon-chevronRight')).toBeDefined()
  })

  it('renders badge when badgeProps is provided', () => {
    render(
      <ListItem
        title="Test Title"
        badgeProps={{ text: 'New', variant: 'secondary' }}
      />,
    )
    expect(screen.getByText('New')).toBeDefined()
  })

  it('applies correct gap when badge is present', () => {
    const { container } = render(
      <ListItem title="Test Title" badgeProps={{ text: 'Badge' }} />,
    )
    const contentDiv = container.querySelector('.zd\\:gap-2')
    expect(contentDiv).not.toBeNull()
  })

  it('renders details when provided', () => {
    render(
      <ListItem
        title="Test Title"
        details={{
          text: 'Detail Text',
          subtext: 'Detail Subtext',
        }}
      />,
    )
    expect(screen.getByText('Detail Text')).toBeDefined()
    expect(screen.getByText('Detail Subtext')).toBeDefined()
  })

  it('applies alert styling when alert prop is true', () => {
    const { container } = render(<ListItem title="Test Title" alert />)
    const button = container.querySelector('button')
    expect(button?.className).toContain('bg-solarOrange/15')
  })

  it('renders as a button element', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByRole('button')).toBeDefined()
  })
})

describe('ListItemSkeleton', () => {
  it('renders skeleton loading state', () => {
    const { container } = render(<ListItemSkeleton />)
    const skeleton = container.querySelector('.zd\\:animate-pulse')
    expect(skeleton).not.toBeNull()
  })

  it('applies custom className', () => {
    const { container } = render(<ListItemSkeleton className="custom-class" />)
    const firstChild = container.firstChild as HTMLElement
    expect(firstChild.className).toContain('custom-class')
  })
})
