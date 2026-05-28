import { describe, expect, it } from 'vitest'
import { createNoopPasskeyStamper } from './noopPasskeyStamper.js'

describe('createNoopPasskeyStamper', () => {
  it('throws an actionable error when stamp() is called', async () => {
    const stamper = createNoopPasskeyStamper()
    await expect(stamper.stamp('payload')).rejects.toThrow(
      /passkeyStamper is not configured/,
    )
  })

  it('throws an actionable error when register() is called', async () => {
    const stamper = createNoopPasskeyStamper()
    await expect(
      stamper.register({ rp: { id: 'example.com', name: '' }, userName: 'u' }),
    ).rejects.toThrow(/passkeyStamper is not configured/)
  })

  it('resolves clear() as a no-op', async () => {
    const stamper = createNoopPasskeyStamper()
    await expect(stamper.clear()).resolves.toBeUndefined()
  })
})
