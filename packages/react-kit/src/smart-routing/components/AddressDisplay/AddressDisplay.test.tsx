/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AddressDisplay } from '.'

afterEach(() => cleanup())

const ADDRESS = '0x8f527b33CD7c791aEDe7EbA077140D81A0000001'

describe('AddressDisplay', () => {
  it('renders the address', () => {
    render(<AddressDisplay address={ADDRESS} onQrClick={() => {}} />)
    expect(screen.getByText(ADDRESS)).toBeDefined()
  })

  it('renders the QR button and calls onQrClick when pressed', () => {
    const onQrClick = vi.fn()
    render(<AddressDisplay address={ADDRESS} onQrClick={onQrClick} />)
    fireEvent.click(screen.getByRole('button', { name: /qr code/i }))
    expect(onQrClick).toHaveBeenCalledTimes(1)
  })
})
