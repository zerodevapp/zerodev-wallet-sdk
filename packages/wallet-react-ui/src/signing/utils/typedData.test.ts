import { describe, expect, it } from 'vitest'
import { decodeTypedData } from './typedData'

const VALID_TYPED_DATA = JSON.stringify({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'string' },
      { name: 'to', type: 'string' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'Example DApp',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    from: 'Alice',
    to: 'Bob',
    contents: 'Hello!',
  },
})

describe('decodeTypedData', () => {
  it('decodes valid EIP-712 typed data', () => {
    const result = decodeTypedData(VALID_TYPED_DATA)
    expect(result).not.toBeNull()
    expect(result!.primaryType).toBe('Mail')
    expect(result!.message).toEqual({
      from: 'Alice',
      to: 'Bob',
      contents: 'Hello!',
    })
    expect(result!.domain).toEqual({
      name: 'Example DApp',
      chainId: 1,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    })
  })

  it('returns null for invalid JSON', () => {
    expect(decodeTypedData('not json')).toBeNull()
  })

  it('returns null when primaryType is missing', () => {
    const data = JSON.stringify({ message: { foo: 'bar' } })
    expect(decodeTypedData(data)).toBeNull()
  })

  it('returns null when message is missing', () => {
    const data = JSON.stringify({ primaryType: 'Mail' })
    expect(decodeTypedData(data)).toBeNull()
  })

  it('defaults domain to empty object when missing', () => {
    const data = JSON.stringify({
      primaryType: 'Mail',
      message: { from: 'Alice' },
    })
    const result = decodeTypedData(data)
    expect(result).not.toBeNull()
    expect(result!.domain).toEqual({})
  })
})
