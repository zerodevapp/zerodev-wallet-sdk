import { describe, expect, it } from 'vitest'
import { formatGasFee } from './formatGasFee'

describe('formatGasFee', () => {
  it('shows the floor placeholder for zero wei', () => {
    expect(formatGasFee(0n)).toBe('< 0.00001 ETH')
  })

  it('shows the floor placeholder when the value rounds to zero at 5 decimals', () => {
    // 1 wei = 1e-18 ETH — well below the 5-decimal threshold
    expect(formatGasFee(1n)).toBe('< 0.00001 ETH')
    // 1 gwei = 1e-9 ETH — also below
    expect(formatGasFee(1_000_000_000n)).toBe('< 0.00001 ETH')
  })

  it('renders a fee at the lower edge of the precision', () => {
    // 1e13 wei = 0.00001 ETH (exactly at the threshold)
    expect(formatGasFee(10_000_000_000_000n)).toBe('0.00001 ETH')
  })

  it('renders a typical gas fee', () => {
    // 1.8e14 wei = 0.00018 ETH
    expect(formatGasFee(180_000_000_000_000n)).toBe('0.00018 ETH')
  })

  it('strips trailing zeros from the formatted number', () => {
    // 5e17 wei = 0.5 ETH (not 0.50000)
    expect(formatGasFee(500_000_000_000_000_000n)).toBe('0.5 ETH')
  })

  it('renders a whole-ether value', () => {
    // 1e18 wei = 1 ETH
    expect(formatGasFee(1_000_000_000_000_000_000n)).toBe('1 ETH')
  })
})
