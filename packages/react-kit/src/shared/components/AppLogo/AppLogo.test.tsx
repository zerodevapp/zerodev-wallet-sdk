import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the Icon component
vi.mock('../Icon', () => ({
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
}))

import { AppLogo } from './index'

afterEach(() => {
  cleanup()
})

describe('AppLogo', () => {
  describe('rendering', () => {
    it('renders the appLogo icon', () => {
      render(<AppLogo />)
      expect(screen.getByTestId('icon-appLogo')).toBeDefined()
    })

    it('renders with default dimensions', () => {
      render(<AppLogo />)
      const icon = screen.getByTestId('icon-appLogo')
      expect(icon.className).toContain('w-[66px]')
      expect(icon.className).toContain('h-[18px]')
    })
  })

  describe('integration with Icon component', () => {
    it('passes the correct icon name', () => {
      render(<AppLogo />)
      const icon = screen.getByTestId('icon-appLogo')
      expect(icon.querySelector('title')?.textContent).toBe('appLogo')
    })
  })
})
