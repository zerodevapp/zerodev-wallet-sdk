import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

import { IconButton } from './index'

afterEach(() => {
  cleanup()
})

describe('IconButton', () => {
  describe('rendering', () => {
    it('renders an icon', () => {
      render(<IconButton iconName="check" />)
      expect(screen.getByTestId('icon-check')).toBeDefined()
    })

    it('renders as a button element', () => {
      render(<IconButton iconName="check" />)
      const button = screen.getByRole('button')
      expect(button).toBeDefined()
    })

    it('defaults to type="button"', () => {
      render(<IconButton iconName="check" />)
      const button = screen.getByRole('button')
      expect(button.getAttribute('type')).toBe('button')
    })
  })

  describe('className merging', () => {
    it('merges custom className onto the wrapper', () => {
      render(<IconButton iconName="check" className="my-custom-class" />)
      const wrapper = screen.getByRole('button').parentElement
      expect(wrapper?.className).toContain('my-custom-class')
      expect(wrapper?.className).toContain('rounded-2xl')
    })
  })

  describe('event handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<IconButton iconName="check" onClick={handleClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<IconButton iconName="check" disabled onClick={handleClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes through aria-label', () => {
      render(<IconButton iconName="check" aria-label="Confirm" />)
      const button = screen.getByRole('button', { name: 'Confirm' })
      expect(button).toBeDefined()
    })
  })
})
