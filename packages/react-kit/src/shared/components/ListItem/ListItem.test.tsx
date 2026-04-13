import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ListItem, ListItemSkeleton } from './index'

describe('ListItem', () => {
  it('renders title', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<ListItem title="Test Title" subtitle="Test Subtitle" />)
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('renders icon when iconName is provided', () => {
    const { container } = render(
      <ListItem title="Test Title" iconName="WalletIcon" />,
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders image when imageUri is provided', () => {
    render(
      <ListItem title="Test Title" imageUri="https://example.com/image.png" />,
    )
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/image.png',
    )
  })

  it('renders chevron when chevron prop is true', () => {
    const { container } = render(<ListItem title="Test Title" chevron />)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
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
    expect(screen.getByText('Detail Text')).toBeInTheDocument()
    expect(screen.getByText('Detail Subtext')).toBeInTheDocument()
  })

  it('applies alert styling when alert prop is true', () => {
    const { container } = render(<ListItem title="Test Title" alert />)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-solarOrange/15')
  })

  it('renders as a button element', () => {
    render(<ListItem title="Test Title" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

describe('ListItemSkeleton', () => {
  it('renders skeleton loading state', () => {
    const { container } = render(<ListItemSkeleton />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ListItemSkeleton className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
