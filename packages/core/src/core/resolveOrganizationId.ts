/**
 * Builds a memoized resolver for the Turnkey parent org that stamp-login is
 * signed against. Resolution order:
 *   1. explicit override (self-hosted / local backends)
 *   2. value fetched from the backend, cached after the first success
 *   3. fallback (the known prod parent org) if the fetch fails
 *
 * The fetch is only attempted when there's no override, and only once — a
 * failure is cached as the fallback so we don't refetch on every login.
 */
export function createOrganizationIdResolver(opts: {
  organizationId?: string | undefined
  fetchParentOrgId: () => Promise<string>
  fallback: string
}): () => Promise<string> {
  let cached: string | undefined
  return async function resolveOrganizationId(): Promise<string> {
    if (opts.organizationId) return opts.organizationId
    if (cached === undefined) {
      try {
        cached = await opts.fetchParentOrgId()
      } catch {
        cached = opts.fallback
      }
    }
    return cached
  }
}
