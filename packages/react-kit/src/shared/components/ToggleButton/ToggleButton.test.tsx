import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToggleButton } from './index'

afterEach(() => {
  cleanup()
})

describe('ToggleButton', () => {
  describe('rendering', () => {
    it('renders as a switch element', () => {
      render(<ToggleButton />)
      expect(screen.getByRole('switch')).toBeDefined()
    })

    it('shows "Off" label when value is false', () => {
      render(<ToggleButton value={false} />)
      expect(screen.getByText('Off')).toBeDefined()
      expect(screen.queryByText('On')).toBeNull()
    })

    it('shows "On" label when value is true', () => {
      render(<ToggleButton value={true} />)
      expect(screen.getByText('On')).toBeDefined()
      expect(screen.queryByText('Off')).toBeNull()
    })

    it('shows "Off" label when value is undefined (default)', () => {
      render(<ToggleButton />)
      expect(screen.getByText('Off')).toBeDefined()
    })
  })

  describe('aria-checked', () => {
    it('is true when value is true', () => {
      render(<ToggleButton value={true} />)
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
        'true',
      )
    })

    it('is false when value is false', () => {
      render(<ToggleButton value={false} />)
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
        'false',
      )
    })

    it('is false when value is undefined', () => {
      render(<ToggleButton />)
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
        'false',
      )
    })
  })

  describe('thumb color', () => {
    it('uses the solarOrange hex color when value is true', () => {
      const { container } = render(<ToggleButton value={true} />)
      const thumb = container.querySelector('.rounded-full')
      expect(thumb?.className).toContain('bg-solarOrange')
    })

    it('uses greyScale/30 when value is false', () => {
      const { container } = render(<ToggleButton value={false} />)
      const thumb = container.querySelector('.rounded-full')
      expect(thumb?.className).toContain('bg-greyScale/30')
    })
  })

  describe('onValueChange', () => {
    it('is called when the button is clicked', () => {
      const onValueChange = vi.fn()
      render(<ToggleButton value={false} onValueChange={onValueChange} />)
      fireEvent.click(screen.getByRole('switch'))
      expect(onValueChange).toHaveBeenCalledTimes(1)
    })

    it('does nothing when no handler is passed', () => {
      render(<ToggleButton value={false} />)
      expect(() => fireEvent.click(screen.getByRole('switch'))).not.toThrow()
    })
  })
})
