import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestDataApiGet } from './requestDataApi.js'

describe('requestDataApiGet', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    '//evil.example/v1',
    '/\\evil.example/v1',
    '/v1/me#fragment',
    '/v1/me/../other',
  ])(
    'rejects a request target that URL would reinterpret: %s',
    async (path) => {
      const stamp = vi.fn()
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(
        requestDataApiGet({
          baseUrl: 'https://data.example',
          environment: 'mainnet',
          path,
          query: {},
          stamper: { stamp },
          walletAddress: '0x1111111111111111111111111111111111111111',
        }),
      ).rejects.toThrow('invalid Data API request target')

      expect(stamp).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
