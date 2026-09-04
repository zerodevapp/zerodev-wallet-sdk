import { createConfig, http } from '@wagmi/core'
import { mainnet } from 'viem/chains'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataApiError } from '../errors.js'

const h = vi.hoisted(() => ({
  getZeroDevConnector: vi.fn(),
  getZeroDevStore: vi.fn(),
  getZeroDevWallet: vi.fn(),
}))

vi.mock('@zerodev/wallet-react', async (importOriginal) => ({
  ...(await importOriginal()),
  getZeroDevConnector: h.getZeroDevConnector,
  getZeroDevStore: h.getZeroDevStore,
  getZeroDevWallet: h.getZeroDevWallet,
}))

import { getTransactionHistory } from './getTransactionHistory.js'

const NOW = 1_787_688_000_000
const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const config = createConfig({
  chains: [mainnet],
  connectors: [],
  transports: { [mainnet.id]: http() },
})
const stamper = {
  stamp: vi.fn(async (payload: string) => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: `signed:${payload}`,
  })),
}
const connector = {
  id: 'zerodev-wallet',
  getAccounts: vi.fn(async () => [WALLET_ADDRESS]),
}
const wallet = { client: { apiKeyStamper: stamper } }

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

describe('getTransactionHistory', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    fetchMock = vi.fn(async () => jsonResponse({ items: [], next: 'cursor-2' }))
    vi.stubGlobal('fetch', fetchMock)
    h.getZeroDevConnector.mockReturnValue(connector)
    h.getZeroDevStore.mockResolvedValue({ getState: vi.fn() })
    h.getZeroDevWallet.mockReturnValue(wallet)
    connector.getAccounts.mockResolvedValue([WALLET_ADDRESS])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('signs and sends the dapp-facing mainnet account with no body', async () => {
    await expect(
      getTransactionHistory(config, { baseUrl: 'https://data.example/' }),
    ).resolves.toEqual({ items: [], next: 'cursor-2' })

    expect(stamper.stamp).toHaveBeenCalledWith(
      '{"aud":"zd-data-api","environment":"mainnet","method":"GET","requestTarget":"/v1/me/transaction-history","ts":1787688000000,"walletAddress":"0x1111111111111111111111111111111111111111"}',
    )

    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call ?? []
    expect(url.toString()).toBe(
      'https://data.example/v1/me/transaction-history',
    )
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    const headers = new Headers(init.headers)
    expect(headers.get('X-Wallet-Address')).toBe(WALLET_ADDRESS)
    expect(headers.get('X-Timestamp')).toBe(String(NOW))
    expect(headers.get('X-Env')).toBeNull()
    expect(headers.get('X-Stamp')).toBe(
      `signed:${stamper.stamp.mock.calls[0]?.[0]}`,
    )
  })

  it('round-trips the same opaque cursor through the stamp and URL', async () => {
    const next = 'https://api.zerion.io/page?after=a&label=é/雪'
    const requestTarget =
      '/v1/me/transaction-history?next=https%3A%2F%2Fapi.zerion.io%2Fpage%3Fafter%3Da%26label%3D%C3%A9%2F%E9%9B%AA'

    await getTransactionHistory(config, {
      baseUrl: 'https://data.example',
      environment: 'testnet',
      next,
    })

    const payload = stamper.stamp.mock.calls[0]?.[0]
    expect(payload).toBeDefined()
    expect(JSON.parse(payload ?? '{}')).toMatchObject({
      environment: 'testnet',
      requestTarget,
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(`${url.pathname}${url.search}`).toBe(requestTarget)
    expect(url.searchParams.get('next')).toBe(next)
    expect(new Headers(init.headers).get('X-Env')).toBe('testnet')
  })

  it('passes the query AbortSignal to fetch', async () => {
    const controller = new AbortController()

    await getTransactionHistory(config, {
      baseUrl: 'https://data.example',
      signal: controller.signal,
    })

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init.signal).toBe(controller.signal)
  })

  it('rejects a successful response that violates the shared contract', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ transactions: [] }))

    await expect(
      getTransactionHistory(config, { baseUrl: 'https://data.example' }),
    ).rejects.toMatchObject({ name: 'InvalidDataApiResponseError' })
  })

  it('preserves Retry-After metadata on non-OK responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: 'throttled' },
        { status: 429, headers: { 'retry-after': '30' } },
      ),
    )

    const request = getTransactionHistory(config, {
      baseUrl: 'https://data.example',
    })
    await expect(request).rejects.toMatchObject({
      name: 'DataApiError',
      status: 429,
      body: { error: 'throttled' },
      retryAfterMs: 30_000,
      url: 'https://data.example/v1/me/transaction-history',
    } satisfies Partial<DataApiError>)
  })

  it('distinguishes a fetch failure from an HTTP response error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(
      getTransactionHistory(config, { baseUrl: 'https://data.example' }),
    ).rejects.toMatchObject({ name: 'DataApiNetworkError' })
  })

  it('fails before reading wallet state when no dapp account is ready', async () => {
    connector.getAccounts.mockResolvedValueOnce([])

    await expect(
      getTransactionHistory(config, { baseUrl: 'https://data.example' }),
    ).rejects.toMatchObject({ name: 'NotAuthenticatedError' })
    expect(h.getZeroDevStore).not.toHaveBeenCalled()
  })

  it('rejects a base URL that contains routing state', async () => {
    await expect(
      getTransactionHistory(config, {
        baseUrl: 'https://data.example/proxy',
      }),
    ).rejects.toMatchObject({ name: 'InvalidDataApiBaseUrlError' })
    expect(stamper.stamp).not.toHaveBeenCalled()
  })
})
