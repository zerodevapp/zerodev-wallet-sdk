import { describe, expect, it } from 'vitest'
import {
  PermissionDeniedError,
  PermissionExpiredError,
  parsePermissionError,
} from './errors.js'

describe('parsePermissionError', () => {
  it('maps the call policy param-rule revert seen on staging', () => {
    const raw = new Error('RPC Request failed. (AA23 reverted 0x59d52e40)')
    const parsed = parsePermissionError(raw)
    expect(parsed).toBeInstanceOf(PermissionDeniedError)
    expect((parsed as PermissionDeniedError).reason).toBe('call-arguments')
    expect((parsed as PermissionDeniedError).cause).toBe(raw)
  })

  it('maps AA22 to an expired permission', () => {
    expect(
      parsePermissionError(new Error('AA22 expired or not due')),
    ).toBeInstanceOf(PermissionExpiredError)
  })

  it('returns unrelated errors unchanged', () => {
    const raw = new Error("AA21 didn't pay prefund")
    expect(parsePermissionError(raw)).toBe(raw)
  })
})
