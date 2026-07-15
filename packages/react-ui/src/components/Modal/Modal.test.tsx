/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Modal } from './index'

afterEach(cleanup)

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <div data-testid="content">hello</div>
      </Modal>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
  })

  it('does not mount when open starts false', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <div data-testid="content">hello</div>
      </Modal>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('fires onClose when the dim backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        <div>content</div>
      </Modal>,
    )
    const backdrop = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        <div>content</div>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClose on Escape when closed', () => {
    const onClose = vi.fn()
    render(
      <Modal open={false} onClose={onClose}>
        <div>content</div>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('merges caller className onto the sheet', () => {
    const { container } = render(
      <Modal open onClose={() => {}} className="custom-sheet">
        <div>content</div>
      </Modal>,
    )
    expect(container.querySelector('.custom-sheet')).not.toBeNull()
  })
})
