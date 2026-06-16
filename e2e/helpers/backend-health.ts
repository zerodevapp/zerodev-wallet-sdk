import { HEALTH_CHECK_INTERVAL_MS, HEALTH_CHECK_RETRIES } from './constants.js'

/**
 * Checks if the backend is reachable by calling the server-info endpoint.
 * For staging/production URLs this uses /api/v1/server-info/auth-proxy-id.
 * For local development, falls back to /healthz on the ops port.
 *
 * @param baseUrl - The backend base URL (e.g. https://kms.staging.zerodev.app/api/v1)
 * @param retries - Number of retries before giving up
 * @param intervalMs - Interval between retries in milliseconds
 */
export async function waitForBackend(
  baseUrl: string,
  retries = HEALTH_CHECK_RETRIES,
  intervalMs = HEALTH_CHECK_INTERVAL_MS,
): Promise<void> {
  // Use the server-info endpoint as a health check — it works for both
  // local and remote backends without needing to know the ops port.
  const healthUrl = `${baseUrl}/server-info/auth-proxy-id`

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5_000),
      })
      if (res.ok) return
    } catch {
      // Connection refused or timeout, keep trying
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }

  throw new Error(
    `Backend at ${baseUrl} not reachable after ${retries} retries`,
  )
}

/**
 * Fetches the auth proxy config ID from the backend.
 *
 * @param baseUrl - The backend base URL (e.g. https://kms.staging.zerodev.app/api/v1)
 * @returns The auth proxy config ID
 */
export async function getAuthProxyConfigId(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/server-info/auth-proxy-id`)
  if (!res.ok) {
    throw new Error(
      `Failed to get auth proxy config ID: ${res.status} ${res.statusText}`,
    )
  }
  const data = await res.json()
  return data.authProxyConfigId
}

/**
 * Fetches the Turnkey parent (base) organization ID. Stamp-login payloads must
 * be signed against this org — the backend relays the stamp to Turnkey under
 * the parent org and derives the sub-org from the credential. Tests fetch it so
 * they work regardless of which base org the target backend is configured with.
 */
export async function getParentOrgId(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/server-info/parent-org-id`)
  if (!res.ok) {
    throw new Error(
      `Failed to get parent org ID: ${res.status} ${res.statusText}`,
    )
  }
  const data = await res.json()
  return data.parentOrgId
}
