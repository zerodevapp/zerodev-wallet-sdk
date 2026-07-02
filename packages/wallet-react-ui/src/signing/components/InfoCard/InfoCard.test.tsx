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
    it('wraps the image in a contained white box by default', () => {
      const { container } = render(
        <InfoCard title="My Title" imageSource="https://example.com/x.png" />,
      )
      expect(container.querySelector('.zd\\:bg-white')).not.toBeNull()
      const img = container.querySelector('img') as HTMLImageElement
      expect(img.src).toBe('https://example.com/x.png')
      expect(img.className).toContain('w-8')
      expect(img.className).toContain('h-8')
    })

    it('renders a bare image when imageStyle is "filled"', () => {
      const { container } = render(
        <InfoCard
          title="My Title"
          imageSource="https://example.com/x.png"
          imageStyle="filled"
        />,
      )
      expect(container.querySelector('.zd\\:bg-white')).toBeNull()
      const img = container.querySelector('img') as HTMLImageElement
      expect(img.className).toContain('w-11')
      expect(img.className).toContain('h-11')
    })

    it('does not render an <img> when no imageSource is provided', () => {
      const { container } = render(<InfoCard title="My Title" />)
      expect(container.querySelector('img')).toBeNull()
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
