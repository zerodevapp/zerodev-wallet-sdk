/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeeDisclosureButton } from './index'

afterEach(cleanup)

describe('FeeDisclosureButton', () => {
  // An aria-label would replace the button's content, so a screen reader
  // would hear the action and never the fee it belongs to.
  it('announces the fee value alongside the action', () => {
    render(
      <FeeDisclosureButton open={false} onToggle={vi.fn()}>
        <span>0.15 USDC</span>
      </FeeDisclosureButton>,
    )

    const button = screen.getByRole('button', { name: /Show fee details/ })
    expect(button.textContent).toContain('0.15 USDC')
    expect(button.getAttribute('aria-label')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('names the action for the open state', () => {
    render(
      <FeeDisclosureButton open onToggle={vi.fn()} panelId="fee-panel">
        <span>0.15 USDC</span>
      </FeeDisclosureButton>,
    )

    const button = screen.getByRole('button', { name: /Hide fee details/ })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-controls')).toBe('fee-panel')
  })
})
