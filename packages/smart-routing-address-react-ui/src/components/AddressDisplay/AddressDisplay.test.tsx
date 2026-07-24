/**
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddressDisplayUI } from './index'

afterEach(cleanup)

const ADDRESS = '0x8f527b33CD7c791aEDe7EbA077140D81A0000001'

describe('AddressDisplayUI', () => {
  describe('loading variant', () => {
    it('renders the loading variant when address is omitted', () => {
      render(<AddressDisplayUI />)
      expect(screen.getByTestId('address-display-loading')).toBeDefined()
      expect(screen.queryByTestId('address-display-ready')).toBeNull()
    })

    it('renders the default loading text', () => {
      render(<AddressDisplayUI />)
      expect(screen.getByText('Watching for your deposit…')).toBeDefined()
    })

    it('respects the loadingText prop', () => {
      render(<AddressDisplayUI loadingText="Generating deposit address…" />)
      expect(screen.getByText('Generating deposit address…')).toBeDefined()
    })

    it('does not render the QR button', () => {
      render(<AddressDisplayUI />)
      expect(screen.queryByTestId('address-display-qr-button')).toBeNull()
    })
  })

  describe('ready variant', () => {
    it('renders the ready variant when address is supplied', () => {
      render(<AddressDisplayUI address={ADDRESS} />)
      expect(screen.getByTestId('address-display-ready')).toBeDefined()
      expect(screen.queryByTestId('address-display-loading')).toBeNull()
    })

    it('renders the full address text', () => {
      render(<AddressDisplayUI address={ADDRESS} />)
      expect(screen.getByTestId('address-display-address').textContent).toBe(
        ADDRESS,
      )
    })

    it('renders the QR button', () => {
      render(<AddressDisplayUI address={ADDRESS} />)
      expect(screen.getByTestId('address-display-qr-button')).toBeDefined()
      expect(screen.getByRole('button', { name: 'Show QR code' })).toBeDefined()
    })

    it('fires onQrClick when the QR button is clicked', () => {
      const onQrClick = vi.fn()
      render(<AddressDisplayUI address={ADDRESS} onQrClick={onQrClick} />)
      fireEvent.click(screen.getByTestId('address-display-qr-button'))
      expect(onQrClick).toHaveBeenCalledTimes(1)
    })

    it('does not throw when onQrClick is omitted and the button is clicked', () => {
      render(<AddressDisplayUI address={ADDRESS} />)
      expect(() =>
        fireEvent.click(screen.getByTestId('address-display-qr-button')),
      ).not.toThrow()
    })
  })
})
