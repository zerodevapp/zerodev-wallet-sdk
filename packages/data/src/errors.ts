export class DataApiError extends Error {
  readonly status: number
  readonly body: unknown
  readonly url: string
  readonly retryAfterMs: number | undefined

  constructor(options: {
    status: number
    body: unknown
    url: string
    retryAfterMs?: number
  }) {
    super(`Data API request failed with status ${options.status}`)
    this.name = 'DataApiError'
    this.status = options.status
    this.body = options.body
    this.url = options.url
    this.retryAfterMs = options.retryAfterMs
  }
}

export class InvalidDataApiBaseUrlError extends TypeError {
  readonly baseUrl: string

  constructor(baseUrl: string) {
    super(
      'Data API baseUrl must be an absolute HTTP(S) origin without a path, query, hash, or credentials.',
    )
    this.name = 'InvalidDataApiBaseUrlError'
    this.baseUrl = baseUrl
  }
}

export class InvalidDataApiResponseError extends Error {
  constructor(cause: unknown) {
    super('Data API returned a response that does not match its contract.', {
      cause,
    })
    this.name = 'InvalidDataApiResponseError'
  }
}

export class DataApiNetworkError extends Error {
  constructor(cause: unknown) {
    super('Data API request failed before receiving an HTTP response.', {
      cause,
    })
    this.name = 'DataApiNetworkError'
  }
}

export function parseRetryAfter(
  value: string | null,
  nowMs = Date.now(),
): number | undefined {
  if (value === null) return undefined

  if (/^(?:0|[1-9][0-9]*)$/.test(value)) {
    const seconds = Number(value)
    const milliseconds = seconds * 1_000
    return Number.isSafeInteger(milliseconds) ? milliseconds : undefined
  }

  // Numeric-looking values that are not legal non-negative integer
  // delay-seconds must not fall through to Date.parse(), whose permissive
  // grammar treats inputs such as "-1" as dates.
  if (/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(value)) return undefined

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return undefined
  return Math.max(0, retryAt - nowMs)
}
