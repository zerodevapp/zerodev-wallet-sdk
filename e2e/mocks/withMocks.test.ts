import { getLocal, type Mockttp } from 'mockttp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { MockRequest } from './types.js'
import { runWithMocks } from './withMocks.js'

const aMock: MockRequest = {
  url: 'http://api.test/thing',
  method: 'GET',
  response: { ok: true },
}

describe('runWithMocks', () => {
  let server: Mockttp

  beforeAll(async () => {
    server = getLocal()
    await server.start()
  })

  afterEach(async () => {
    await server.reset()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('runs the test suite with the mock server and the mocks applied', async () => {
    let sawServer: Mockttp | undefined
    let endpointsDuringRun = 0

    await runWithMocks(
      server,
      { mocks: [aMock] },
      async ({ mockServer }: { mockServer: Mockttp }) => {
        sawServer = mockServer
        endpointsDuringRun = (await mockServer.getMockedEndpoints()).length
      },
    )

    expect(sawServer).toBe(server)
    expect(endpointsDuringRun).toBeGreaterThan(0) // mock + passthrough fallback
  })

  it('propagates errors from the test suite instead of swallowing them', async () => {
    const boom = new Error('assertion failed')

    await expect(
      runWithMocks(server, { mocks: [aMock] }, async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
  })

  it('resets the server after a successful run', async () => {
    await runWithMocks(server, { mocks: [aMock] }, async () => {})

    expect(await server.getMockedEndpoints()).toHaveLength(0)
  })

  it('resets the server even when the test suite throws', async () => {
    await runWithMocks(server, { mocks: [aMock] }, async () => {
      throw new Error('boom')
    }).catch(() => {})

    expect(await server.getMockedEndpoints()).toHaveLength(0)
  })
})
