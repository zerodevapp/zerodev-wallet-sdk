import { describe, expect, it, vi } from 'vitest'
import { createOrganizationIdResolver } from './resolveOrganizationId.js'

const FALLBACK = '0d98e826-fallback-org'

describe('createOrganizationIdResolver', () => {
  it('returns the explicit override and never fetches', async () => {
    const fetchParentOrgId = vi.fn(async () => 'fetched-org')
    const resolve = createOrganizationIdResolver({
      organizationId: 'override-org',
      fetchParentOrgId,
      fallback: FALLBACK,
    })

    expect(await resolve()).toBe('override-org')
    expect(await resolve()).toBe('override-org')
    expect(fetchParentOrgId).not.toHaveBeenCalled()
  })

  it('fetches the parent org from the backend when there is no override', async () => {
    const fetchParentOrgId = vi.fn(async () => 'fetched-org')
    const resolve = createOrganizationIdResolver({
      fetchParentOrgId,
      fallback: FALLBACK,
    })

    expect(await resolve()).toBe('fetched-org')
    expect(fetchParentOrgId).toHaveBeenCalledTimes(1)
  })

  it('caches the fetched value — fetches only once across calls', async () => {
    const fetchParentOrgId = vi.fn(async () => 'fetched-org')
    const resolve = createOrganizationIdResolver({
      fetchParentOrgId,
      fallback: FALLBACK,
    })

    await resolve()
    await resolve()
    await resolve()
    expect(fetchParentOrgId).toHaveBeenCalledTimes(1)
  })

  it('falls back when the fetch fails, and caches the fallback (no retry)', async () => {
    const fetchParentOrgId = vi.fn(async () => {
      throw new Error('network down')
    })
    const resolve = createOrganizationIdResolver({
      fetchParentOrgId,
      fallback: FALLBACK,
    })

    expect(await resolve()).toBe(FALLBACK)
    expect(await resolve()).toBe(FALLBACK)
    expect(fetchParentOrgId).toHaveBeenCalledTimes(1)
  })
})
