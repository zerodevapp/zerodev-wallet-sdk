/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LabeledValueRow } from './index'

afterEach(cleanup)

describe('LabeledValueRow', () => {
  it('renders the label and string value', () => {
    render(<LabeledValueRow label="Max slippage" value="0.50%" />)
    expect(screen.getByText('Max slippage')).toBeDefined()
    expect(screen.getByText('0.50%')).toBeDefined()
  })

  it('renders a ReactNode value verbatim', () => {
    render(
      <LabeledValueRow
        label="Status"
        value={<span data-testid="custom-value">custom</span>}
      />,
    )
    expect(screen.getByTestId('custom-value').textContent).toBe('custom')
  })

  it('does not render the info icon by default', () => {
    render(<LabeledValueRow label="Max slippage" value="0.50%" />)
    expect(screen.queryByTestId('labeled-value-row-info')).toBeNull()
  })

  it('renders the info icon when info is true', () => {
    render(<LabeledValueRow label="Max slippage" value="0.50%" info />)
    expect(screen.getByTestId('labeled-value-row-info')).toBeDefined()
  })

  it('renders info icon as a non-interactive element without onInfoClick', () => {
    render(<LabeledValueRow label="Max slippage" value="0.50%" info />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders info icon as a button when onInfoClick is supplied', () => {
    const onInfoClick = vi.fn()
    render(
      <LabeledValueRow
        label="Max slippage"
        value="0.50%"
        info
        onInfoClick={onInfoClick}
      />,
    )
    const button = screen.getByRole('button', {
      name: 'Max slippage — more info',
    })
    fireEvent.click(button)
    expect(onInfoClick).toHaveBeenCalledTimes(1)
  })

  it('renders a trailing element inline with the value', () => {
    render(
      <LabeledValueRow
        label="Estimated fee"
        value="0.74%"
        trailing={<span data-testid="trailing">chev</span>}
      />,
    )
    const valueGroup = screen.getByTestId('labeled-value-row-value')
    expect(valueGroup.querySelector('[data-testid="trailing"]')).not.toBeNull()
  })

  it('applies default styling', () => {
    render(<LabeledValueRow label="X" value="Y" />)
    const label = screen.getByText('X')
    expect(label.className).not.toContain('solarOrange')
  })

  it('applies warning styling to label and value', () => {
    render(
      <LabeledValueRow
        label="Minimum deposit"
        value="27.88 USDC"
        variant="warning"
      />,
    )
    expect(screen.getByText('Minimum deposit').className).toContain(
      'solarOrange',
    )
    expect(screen.getByText('27.88 USDC').className).toContain('solarOrange')
  })
})
