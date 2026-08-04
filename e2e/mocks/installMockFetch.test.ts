import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getActiveMocks,
  installMockFetch,
  isMockFetchInstalled,
  jsonBodyIncludes,
  matchMock,
  setMocks,
  uninstallMockFetch,
} from './installMockFetch.js'
import type { MockRequest } from './types.js'

const RPC_URL = 'http://rpc.test/v1'

const rpcInit = (method: string, params: unknown[] = [], id: number = 1) => ({
  method: 'POST',
  body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
})

afterEach(() => {
  uninstallMockFetch()
  vi.restoreAllMocks()
})

describe('jsonBodyIncludes', () => {
  it('matches a subset and ignores extra keys', () => {
    expect(jsonBodyIncludes({ a: 1, b: 2 }, { a: 1 })).toBe(true)
  })

  it('rejects a differing value', () => {
    expect(jsonBodyIncludes({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('rejects a missing key rather than treating undefined as a match', () => {
    expect(jsonBodyIncludes({ a: 1 }, { b: undefined })).toBe(false)
  })

  it('recurses into nested objects', () => {
    expect(
      jsonBodyIncludes(
        { p: { to: '0xabc', data: '0xdead' } },
        { p: { to: '0xabc' } },
      ),
    ).toBe(true)
    expect(
      jsonBodyIncludes({ p: { to: '0xabc' } }, { p: { to: '0xdef' } }),
    ).toBe(false)
  })

  it('matches arrays positionally and allows the actual array to be longer', () => {
    expect(
      jsonBodyIncludes(
        { params: [{ to: '0xabc' }, 'latest'] },
        { params: [{ to: '0xabc' }] },
      ),
    ).toBe(true)
    expect(
      jsonBodyIncludes({ params: [] }, { params: [{ to: '0xabc' }] }),
    ).toBe(false)
  })

  it('does not conflate an array with an object', () => {
    expect(jsonBodyIncludes([1, 2], { 0: 1 })).toBe(false)
  })
})

describe('matchMock', () => {
  const balance: MockRequest = {
    url: RPC_URL,
    method: 'POST',
    payload: { method: 'eth_getBalance' },
    response: { result: '0xbalance' },
  }
  const call: MockRequest = {
    url: RPC_URL,
    method: 'POST',
    payload: { method: 'eth_call' },
    response: { result: '0xcall' },
  }

  const describeReq = (body: string, url = RPC_URL, method = 'POST') => ({
    url,
    method,
    body,
  })

  it('routes by body when url and method are identical', () => {
    const mocks = [balance, call]
    expect(matchMock(mocks, describeReq(rpcInit('eth_getBalance').body))).toBe(
      balance,
    )
    expect(matchMock(mocks, describeReq(rpcInit('eth_call').body))).toBe(call)
  })

  it('honours a RegExp url', () => {
    const anyHost: MockRequest = { url: /\/v1$/, method: 'POST', response: {} }
    expect(matchMock([anyHost], describeReq('', 'http://other.test/v1'))).toBe(
      anyHost,
    )
    expect(
      matchMock([anyHost], describeReq('', 'http://other.test/v2')),
    ).toBeUndefined()
  })

  it('requires the method to match', () => {
    expect(
      matchMock([balance], describeReq('', RPC_URL, 'GET')),
    ).toBeUndefined()
  })

  it('separates same-payload calls by bodyIncludes', () => {
    const balanceOf: MockRequest = {
      url: RPC_URL,
      method: 'POST',
      payload: { method: 'eth_call' },
      bodyIncludes: '0x70a08231',
      response: { result: '0xbalanceOf' },
    }
    const decimals: MockRequest = {
      url: RPC_URL,
      method: 'POST',
      payload: { method: 'eth_call' },
      bodyIncludes: '0x313ce567',
      response: { result: '0xdecimals' },
    }
    const mocks = [balanceOf, decimals]
    const req = (selector: string) =>
      describeReq(rpcInit('eth_call', [{ data: `${selector}00` }]).body)

    expect(matchMock(mocks, req('0x70a08231'))).toBe(balanceOf)
    expect(matchMock(mocks, req('0x313ce567'))).toBe(decimals)
  })

  it('does not match a payload mock when the body is not JSON', () => {
    expect(matchMock([balance], describeReq('not json'))).toBeUndefined()
  })
})

describe('installMockFetch', () => {
  it('is a no-op guard: installing twice keeps one native reference', () => {
    const original = globalThis.fetch
    installMockFetch({ mocks: [] })
    const patched = globalThis.fetch
    installMockFetch({ mocks: [] })
    expect(globalThis.fetch).toBe(patched)
    uninstallMockFetch()
    expect(globalThis.fetch).toBe(original)
  })

  it('leaves fetch untouched until installed', () => {
    const original = globalThis.fetch
    setMocks([{ url: RPC_URL, method: 'POST', response: {} }])
    expect(globalThis.fetch).toBe(original)
    expect(isMockFetchInstalled()).toBe(false)
  })

  it('serves a matching mock without hitting the network', async () => {
    const passthrough = vi.fn()
    globalThis.fetch = passthrough as unknown as typeof globalThis.fetch

    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_getBalance' },
          response: { jsonrpc: '2.0', id: 1, result: '0x2386f26fc10000' },
        },
      ],
    })

    const res = await fetch(RPC_URL, rpcInit('eth_getBalance'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: '0x2386f26fc10000',
    })
    expect(passthrough).not.toHaveBeenCalled()
  })

  it('echoes the request id instead of the id the preset was authored with', async () => {
    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_getBalance' },
          // Authored as id 1 — a caller correlating by id would reject that.
          response: { jsonrpc: '2.0', id: 1, result: '0xbalance' },
        },
      ],
    })

    const res = await fetch(RPC_URL, rpcInit('eth_getBalance', [], 99))
    expect(await res.json()).toMatchObject({ id: 99, result: '0xbalance' })
  })

  it('does not mutate the preset when echoing the id', async () => {
    const mock: MockRequest = {
      url: RPC_URL,
      method: 'POST',
      payload: { method: 'eth_getBalance' },
      response: { jsonrpc: '2.0', id: 1, result: '0xbalance' },
    }
    installMockFetch({ mocks: [mock] })

    await fetch(RPC_URL, rpcInit('eth_getBalance', [], 42))

    expect(mock.response).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: '0xbalance',
    })
  })

  it('routes repeated interleaved calls by body every time', async () => {
    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_getBalance' },
          response: { result: '0xbalance' },
        },
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_call' },
          response: { result: '0xcall' },
        },
      ],
    })

    const results: unknown[] = []
    for (const method of [
      'eth_getBalance',
      'eth_call',
      'eth_getBalance',
      'eth_call',
    ]) {
      const res = await fetch(RPC_URL, rpcInit(method))
      results.push(await res.json())
    }

    expect(results).toEqual([
      { result: '0xbalance' },
      { result: '0xcall' },
      { result: '0xbalance' },
      { result: '0xcall' },
    ])
  })

  it('honours the status override', async () => {
    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          status: 503,
          response: { error: 'down' },
        },
      ],
    })

    const res = await fetch(RPC_URL, { method: 'POST', body: '{}' })
    expect(res.status).toBe(503)
  })

  it('lets a higher-priority mock win, like the proxy does', async () => {
    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          response: { winner: false },
          priority: 1,
        },
        {
          url: RPC_URL,
          method: 'POST',
          response: { winner: true },
          priority: 5,
        },
      ],
    })

    const res = await fetch(RPC_URL, { method: 'POST', body: '{}' })
    expect(await res.json()).toEqual({ winner: true })
    // setMocks stores them already ordered.
    expect(getActiveMocks()[0]?.priority).toBe(5)
  })

  it('passes unmatched traffic through by default', async () => {
    const passthrough = vi
      .fn()
      .mockResolvedValue(new Response('{"from":"real"}', { status: 200 }))
    globalThis.fetch = passthrough as unknown as typeof globalThis.fetch

    installMockFetch({ mocks: [] })
    const res = await fetch('http://elsewhere.test/thing')

    expect(passthrough).toHaveBeenCalledTimes(1)
    expect(await res.json()).toEqual({ from: 'real' })
  })

  it("blocks unmatched traffic with 501 when unmatched is 'block'", async () => {
    const passthrough = vi.fn()
    globalThis.fetch = passthrough as unknown as typeof globalThis.fetch
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    installMockFetch({ mocks: [], unmatched: 'block' })
    const res = await fetch('http://elsewhere.test/thing')

    expect(res.status).toBe(501)
    expect(passthrough).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('matches a Request object, not just a url string', async () => {
    installMockFetch({
      mocks: [
        {
          url: RPC_URL,
          method: 'POST',
          payload: { method: 'eth_getBalance' },
          response: { result: '0xbalance' },
        },
      ],
    })

    const res = await fetch(new Request(RPC_URL, rpcInit('eth_getBalance')))
    expect(await res.json()).toEqual({ result: '0xbalance' })
  })

  it('setMocks swaps the active set while installed', async () => {
    installMockFetch({
      mocks: [{ url: RPC_URL, method: 'POST', response: { v: 'first' } }],
    })
    setMocks([{ url: RPC_URL, method: 'POST', response: { v: 'second' } }])

    const res = await fetch(RPC_URL, { method: 'POST', body: '{}' })
    expect(await res.json()).toEqual({ v: 'second' })
  })
})
