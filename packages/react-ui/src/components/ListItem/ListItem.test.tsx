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

import { ListItem, ListItemChevron, ListItemSkeleton } from './index'

afterEach(() => {
  cleanup()
})

describe('ListItem', () => {
  it('renders title', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeDefined()
  })

  it('renders a string subtitle with the standard styling', () => {
    render(<ListItem title="Test Title" subtitle="Test Subtitle" />)
    expect(screen.getByText('Test Subtitle')).toBeDefined()
  })

  it('renders a node subtitle as-is', () => {
    render(
      <ListItem title="Test Title" subtitle={<span data-testid="badge" />} />,
    )
    expect(screen.getByTestId('badge')).toBeDefined()
  })

  it('renders the icon slot inside the leading tile', () => {
    render(
      <ListItem title="Test Title" icon={<span data-testid="custom-icon" />} />,
    )
    expect(screen.getByTestId('custom-icon')).toBeDefined()
  })

  it('renders the trailing slot', () => {
    render(
      <ListItem
        title="Test Title"
        trailing={<span data-testid="trailing" />}
      />,
    )
    expect(screen.getByTestId('trailing')).toBeDefined()
  })

  it('renders as a button element by default', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('renders into the child element with asChild', () => {
    render(
      <ListItem title="Link Row" asChild trailing={<ListItemChevron />}>
        {/* biome-ignore lint/a11y/useAnchorContent: the row layout (incl. the title text) is injected into the anchor via Slot */}
        <a href="https://example.com" />
      </ListItem>,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('https://example.com')
    // row layout is injected into the anchor
    expect(link.textContent).toContain('Link Row')
    expect(screen.queryByRole('button')).toBeNull()
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
