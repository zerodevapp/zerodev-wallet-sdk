/**
 * Guards the layer's wiring, not a seam in the SDK.
 *
 * `vitest.integration.setup.ts` stubs `fetch` to reject, and only
 * `vitest.integration.config.ts` loads it. So this also fails if `pnpm test`
 * picks the file up, which happens the moment `vitest.config.ts` loses its
 * `*.integration.test.ts` exclude: its include glob already matches this layer.
 */
import { describe, expect, it } from 'vitest'

describe('integration runner: the layer is wired, and separate from the unit suite', () => {
  it('rejects an unstubbed request, which only the integration setup does', async () => {
    // `.invalid` never resolves, so the unit runner fails on the message rather
    // than by reaching anything.
    await expect(fetch('https://example.invalid/never')).rejects.toThrow(
      /integration tests must stub fetch/,
    )
  })
})
