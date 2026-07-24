import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { InfoCard } from './index'

afterEach(() => {
  cleanup()
})

describe('InfoCard', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(<InfoCard title="My Title" />)
      expect(screen.getByText('My Title')).toBeDefined()
    })

    it('renders the subtitle when provided', () => {
      render(<InfoCard title="My Title" subtitle="My Subtitle" />)
      expect(screen.getByText('My Subtitle')).toBeDefined()
    })

    it('does not render subtitle when omitted', () => {
      render(<InfoCard title="My Title" />)
      expect(screen.queryByText('My Subtitle')).toBeNull()
    })
  })

  describe('imageStyle', () => {
    it('wraps the image in a contained translucent tile by default', () => {
      const { container } = render(
        <InfoCard title="My Title" imageSource="https://example.com/x.png" />,
      )
      // Contained variant renders the PairMark tile — translucent white/60
      // backdrop-blurred wrapper with a circular token disc inside.
      expect(container.querySelector('.zd\\:bg-white\\/60')).not.toBeNull()
      const img = container.querySelector('img') as HTMLImageElement
      expect(img.src).toBe('https://example.com/x.png')
      expect(img.className).toContain('size-full')
    })

    it('renders a bare image when imageStyle is "filled"', () => {
      const { container } = render(
        <InfoCard
          title="My Title"
          imageSource="https://example.com/x.png"
          imageStyle="filled"
        />,
      )
      expect(container.querySelector('.zd\\:bg-white\\/60')).toBeNull()
      const img = container.querySelector('img') as HTMLImageElement
      expect(img.className).toContain('size-full')
    })

    it('does not render an <img> when no imageSource or chain icon is provided', () => {
      const { container } = render(<InfoCard title="My Title" />)
      expect(container.querySelector('img')).toBeNull()
    })
  })

  describe('chainIconUrl', () => {
    it('renders the chain badge overlay when provided', () => {
      const { container } = render(
        <InfoCard
          title="My Title"
          imageSource="https://example.com/token.png"
          chainIconUrl="https://example.com/chain.png"
        />,
      )
      const imgs = Array.from(container.querySelectorAll('img'))
      expect(imgs.map((i) => (i as HTMLImageElement).src)).toEqual([
        'https://example.com/token.png',
        'https://example.com/chain.png',
      ])
    })

    it('renders the chain badge even without a token image', () => {
      const { container } = render(
        <InfoCard
          title="My Title"
          chainIconUrl="https://example.com/chain.png"
        />,
      )
      const img = container.querySelector('img') as HTMLImageElement
      expect(img.src).toBe('https://example.com/chain.png')
    })
  })

  describe('rightElement', () => {
    it('renders the rightElement when provided', () => {
      render(
        <InfoCard
          title="My Title"
          rightElement={<span data-testid="right">Action</span>}
        />,
      )
      expect(screen.getByTestId('right')).toBeDefined()
    })
  })
})
