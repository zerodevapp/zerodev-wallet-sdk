import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Mockttp } from 'mockttp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { applyMocks, reset, startMockServer, stopMockServer } from './server.js'
import type { MockRequest } from './types.js'

/**
 * Drive an HTTP request through Mockttp acting as a proxy, using an
 * absolute-URI request target (standard HTTP proxying). No proxy-client dep.
 */
function proxyRequest(
  proxyPort: number,
  targetUrl: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: string }> {
  const { method = 'GET', body } = opts
  const target = new URL(targetUrl)
  const payload = body === undefined ? undefined : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: proxyPort,
        method,
        path: targetUrl, // absolute-form target => proxy request
        headers: {
          Host: target.host,
          ...(payload && {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          }),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => {
          data += c
        })
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: data }),
        )
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const RPC_URL = 'http://rpc.test/v1'

describe('mock server', () => {
  let server: Mockttp
  let realBackend: http.Server
  let realBackendUrl: string

  beforeAll(async () => {
    server = await startMockServer()

    // A stand-in "real backend" to prove passthrough reaches upstream.
    realBackend = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ from: 'real-backend' }))
    })
    await new Promise<void>((r) => realBackend.listen(0, '127.0.0.1', r))
    const { port } = realBackend.address() as AddressInfo
    realBackendUrl = `http://127.0.0.1:${port}/anything`
  })

  afterEach(async () => {
    await reset(server)
  })

  afterAll(async () => {
    await stopMockServer(server)
    await new Promise<void>((r) => realBackend.close(() => r()))
  })

  it('returns the mocked JSON response for a matching request', async () => {
    const mocks: MockRequest[] = [
      { url: 'http://api.test/ping', method: 'GET', response: { pong: true } },
    ]
    await applyMocks(server, mocks, 'block')

    const res = await proxyRequest(server.port, 'http://api.test/ping')

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ pong: true })
  })

  it('honors status overrides', async () => {
    await applyMocks(
      server,
      [
        {
          url: 'http://api.test/boom',
          method: 'GET',
          status: 503,
          response: { error: 'down' },
        },
      ],
      'block',
    )

    const res = await proxyRequest(server.port, 'http://api.test/boom')

    expect(res.status).toBe(503)
    expect(JSON.parse(res.body)).toEqual({ error: 'down' })
  })

  it('lets a higher-priority mock win over a lower-priority one', async () => {
    await applyMocks(
      server,
      [
        {
          url: 'http://api.test/dup',
          method: 'GET',
          response: { winner: false },
          priority: 1,
        },
        {
          url: 'http://api.test/dup',
          method: 'GET',
          response: { winner: true },
          priority: 5,
        },
      ],
      'block',
    )

    const res = await proxyRequest(server.port, 'http://api.test/dup')

    expect(JSON.parse(res.body)).toEqual({ winner: true })
  })

  it('distinguishes JSON-RPC calls on one URL via partial body match', async () => {
    await applyMocks(
      server,
      [
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_call' },
          response: { result: 'call-result' },
        },
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_getBalance' },
          response: { result: '0xbalance' },
        },
      ],
      'block',
    )

    // Fire each method TWICE, interleaved — dashboards poll the same JSON-RPC
    // method repeatedly. Routing must be by body on every call. This also kills
    // a disabled body-matcher: without it, rules match by url+method only and
    // Mockttp's one-shot-then-reuse rule consumption returns the wrong response
    // on the repeat calls (proven via mutation testing).
    const sequence = [
      'eth_getBalance',
      'eth_call',
      'eth_getBalance',
      'eth_call',
    ]
    const results: unknown[] = []
    for (const method of sequence) {
      const res = await proxyRequest(server.port, RPC_URL, {
        method: 'POST',
        body: { jsonrpc: '2.0', id: 1, method, params: [] },
      })
      results.push(JSON.parse(res.body))
    }

    expect(results).toEqual([
      { result: '0xbalance' },
      { result: 'call-result' },
      { result: '0xbalance' },
      { result: 'call-result' },
    ])
  })

  it("blocks unmatched traffic with 501 when unmatched is 'block'", async () => {
    await applyMocks(server, [], 'block')

    const res = await proxyRequest(server.port, 'http://api.test/unmapped')

    expect(res.status).toBe(501)
  })

  it("forwards unmatched traffic upstream when unmatched is 'passthrough'", async () => {
    await applyMocks(server, [], 'passthrough')

    const res = await proxyRequest(server.port, realBackendUrl)

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ from: 'real-backend' })
  })

  it('defaults to passthrough when the unmatched policy is omitted', async () => {
    await applyMocks(server, []) // 3rd arg omitted -> default

    const res = await proxyRequest(server.port, realBackendUrl)

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ from: 'real-backend' })
  })

  it('matches a mock whose url is a RegExp (used by presets like example)', async () => {
    await applyMocks(
      server,
      [{ url: /\/rpc\/.+$/, method: 'GET', response: { matched: true } }],
      'block',
    )

    const res = await proxyRequest(server.port, 'http://any.host/rpc/123')

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ matched: true })
  })
})
