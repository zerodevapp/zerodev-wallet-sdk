import { buildDataApiPayload } from '@zerodev/data-api-stamp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestDataApiGet } from './requestDataApi.js'

const WALLET_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

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
          projectId: 'project-1',
          query: {},
          stamper: { stamp },
          walletAddress: WALLET_ADDRESS,
        }),
      ).rejects.toThrow('invalid Data API request target')

      expect(stamp).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('sends and signs the wallet address exactly as given', async () => {
    const stamp = vi.fn(async (payload: string) => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: `signed:${payload}`,
    }))
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await requestDataApiGet({
      baseUrl: 'https://data.example',
      environment: 'testnet',
      path: '/v1/me/transaction-history',
      projectId: 'project-1',
      query: { next: 'cursor-2' },
      stamper: { stamp },
      walletAddress: WALLET_ADDRESS,
    })

    const [, init] = fetchMock.mock.calls[0] ?? []
    const headers = new Headers(init.headers)
    expect(headers.get('X-Wallet-Address')).toBe(WALLET_ADDRESS)
    expect(stamp).toHaveBeenCalledWith(
      buildDataApiPayload({
        method: 'GET',
        requestTarget: '/v1/me/transaction-history?next=cursor-2',
        projectId: 'project-1',
        environment: 'testnet',
        ts: Number(headers.get('X-Timestamp')),
        walletAddress: WALLET_ADDRESS,
      }),
    )
    expect(JSON.parse(stamp.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      walletAddress: WALLET_ADDRESS,
    })
  })
})
