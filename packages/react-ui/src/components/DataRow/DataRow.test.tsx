/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The real Icon component uses `import.meta.glob` to eagerly load SVGs from
// disk, which vitest can't resolve. Stub it with a minimal mock that emits
// `data-testid="icon-<name>"` for query-by-testid.
vi.mock('../Icon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Icon')>()
  const React = await import('react')

  const MockIcon = ({
    name,
    ...props
  }: { name: string } & React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { 'data-testid': `icon-${name}`, ...props })

  return {
    ...actual,
    Icon: MockIcon,
    icons: {},
  }
})

import { DataRow, DataRowSkeleton } from './index'

afterEach(cleanup)

describe('DataRow', () => {
  it('renders the label and a string value', () => {
    render(<DataRow label="Max slippage" value="0.50%" />)
    expect(screen.getByText('Max slippage')).toBeDefined()
    expect(screen.getByText('0.50%')).toBeDefined()
  })

  it('renders a ReactNode value verbatim (no Text wrapping)', () => {
    render(
      <DataRow
        label="Status"
        value={<span data-testid="custom-value">custom</span>}
      />,
    )
    expect(screen.getByTestId('custom-value').textContent).toBe('custom')
  })

  it('leaves the label untouched (no auto title-casing)', () => {
    render(<DataRow label="gasFee" value="0.001" />)
    expect(screen.getByText('gasFee')).toBeDefined()
    expect(screen.queryByText('Gas Fee')).toBeNull()
  })

  it('does not render the info icon by default', () => {
    render(<DataRow label="Max slippage" value="0.50%" />)
    expect(screen.queryByTestId('data-row-info')).toBeNull()
  })

  it('renders the info icon when info is true', () => {
    render(<DataRow label="Max slippage" value="0.50%" info />)
    expect(screen.getByTestId('data-row-info')).toBeDefined()
  })

  it('renders the info icon as a non-interactive element without onInfoClick', () => {
    render(<DataRow label="Max slippage" value="0.50%" info />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the info icon as a button when onInfoClick is supplied', () => {
    const onInfoClick = vi.fn()
    render(
      <DataRow
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

  it('renders leading content inside the value group, before the value', () => {
    render(
      <DataRow
        label="Fee"
        value="0.05 ETH"
        leading={<span data-testid="leading">L</span>}
      />,
    )
    const valueGroup = screen.getByTestId('data-row-value')
    const leading = valueGroup.querySelector('[data-testid="leading"]')
    expect(leading).not.toBeNull()
    // Leading must appear before the value text within the group.
    expect(valueGroup.textContent).toBe('L0.05 ETH')
  })

  it('renders trailing content inside the value group, after the value', () => {
    render(
      <DataRow
        label="Estimated fee"
        value="0.74%"
        trailing={<span data-testid="trailing">chev</span>}
      />,
    )
    const valueGroup = screen.getByTestId('data-row-value')
    expect(valueGroup.querySelector('[data-testid="trailing"]')).not.toBeNull()
    expect(valueGroup.textContent).toBe('0.74%chev')
  })

  it('applies default styling (no orange text)', () => {
    render(<DataRow label="X" value="Y" />)
    expect(screen.getByText('X').className).not.toContain('solarOrange')
  })

  it('applies warning styling to label and value', () => {
    render(
      <DataRow label="Minimum deposit" value="27.88 USDC" variant="warning" />,
    )
    expect(screen.getByText('Minimum deposit').className).toContain(
      'solarOrange',
    )
    expect(screen.getByText('27.88 USDC').className).toContain('solarOrange')
  })

  it('merges custom className onto the root element', () => {
    const { container } = render(
      <DataRow label="X" value="Y" className="mt-4" />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('mt-4')
    expect(root.className).toContain('flex')
  })
})

describe('DataRowSkeleton', () => {
  it('renders two pulse placeholders when no label is given', () => {
    const { container } = render(<DataRowSkeleton />)
    const pulses = container.querySelectorAll('.zd\\:animate-pulse')
    expect(pulses).toHaveLength(2)
  })

  it('renders the label verbatim on the left when provided', () => {
    render(<DataRowSkeleton label="Fee" />)
    expect(screen.getByText('Fee')).toBeDefined()
  })
})
