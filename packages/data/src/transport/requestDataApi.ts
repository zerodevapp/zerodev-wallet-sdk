import {
  buildDataApiPayload,
  type DataApiEnvironment,
} from '@zerodev/data-api-stamp'
import type { ApiKeyStamper } from '@zerodev/wallet-core'
import {
  DataApiError,
  DataApiNetworkError,
  InvalidDataApiBaseUrlError,
  parseRetryAfter,
} from '../errors.js'

export type DataApiGetParameters = {
  baseUrl: string
  environment: DataApiEnvironment
  path: string
  query: Record<string, string>
  signal?: AbortSignal
  stamper: Pick<ApiKeyStamper, 'stamp'>
  walletAddress: string
}

function normalizeBaseUrl(baseUrl: string): string {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new InvalidDataApiBaseUrlError(baseUrl)
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new InvalidDataApiBaseUrlError(baseUrl)
  }

  return url.origin
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function requestDataApiGet(
  parameters: DataApiGetParameters,
): Promise<unknown> {
  const url = new URL(parameters.path, normalizeBaseUrl(parameters.baseUrl))
  url.search = new URLSearchParams(parameters.query).toString()

  const ts = Date.now()
  const payload = buildDataApiPayload({
    method: 'GET',
    path: url.pathname,
    query: parameters.query,
    walletAddress: parameters.walletAddress,
    environment: parameters.environment,
    ts,
  })
  const stamp = await parameters.stamper.stamp(payload)

  const headers = new Headers({
    Accept: 'application/json',
    'X-Timestamp': String(ts),
    'X-Wallet-Address': parameters.walletAddress,
  })
  if (parameters.environment === 'testnet') headers.set('X-Env', 'testnet')
  headers.set(stamp.stampHeaderName, stamp.stampHeaderValue)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      ...(parameters.signal === undefined ? {} : { signal: parameters.signal }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new DataApiNetworkError(error)
  }
  const body = await parseResponseBody(response)

  if (!response.ok) {
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    throw new DataApiError({
      status: response.status,
      body,
      url: url.toString(),
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    })
  }

  return body
}
