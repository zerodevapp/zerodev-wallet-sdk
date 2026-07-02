import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the Icon component
vi.mock('@zerodev/react-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zerodev/react-ui')>()
  return {
    ...actual,
    Icon: ({
      name,
      className,
      ...props
    }: {
      name: string
      className?: string
    }) => (
      <svg data-testid={`icon-${name}`} className={className} {...props}>
        <title>{name}</title>
      </svg>
    ),
  }
})

import { PoweredBy } from './index'

afterEach(() => {
  cleanup()
})

describe('PoweredBy', () => {
  describe('rendering', () => {
    it('renders the zerodevLogo icon', () => {
      render(<PoweredBy />)
      expect(screen.getByTestId('icon-zerodevLogo')).toBeDefined()
    })

    it('renders with default dimensions', () => {
      render(<PoweredBy />)
      const icon = screen.getByTestId('icon-zerodevLogo')
      expect(icon.className).toContain('h-[18px]')
      expect(icon.className).toContain('w-auto')
    })
  })

  describe('integration with Icon component', () => {
    it('passes the correct icon name', () => {
      render(<PoweredBy />)
      const icon = screen.getByTestId('icon-zerodevLogo')
      expect(icon.querySelector('title')?.textContent).toBe('zerodevLogo')
    })
  })
})
