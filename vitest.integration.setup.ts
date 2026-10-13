import { beforeEach, vi } from 'vitest'

/** Nothing in this layer may reach the network. A test that needs `fetch` stubs
 *  it with `vi.stubGlobal`, which replaces this; anything else fails here. */
beforeEach(() => {
  // Async, so it rejects the way `fetch` does instead of throwing synchronously.
  vi.stubGlobal('fetch', async (url: string | URL | Request) => {
    throw new Error(
      `integration tests must stub fetch — unstubbed request to ${String(url)}`,
    )
  })
})
