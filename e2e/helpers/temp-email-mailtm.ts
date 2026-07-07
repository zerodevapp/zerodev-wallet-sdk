/**
 * Temporary email service using the mail.tm/mail.gw API.
 *
 * Kept as an alternative to the default `temp-email.ts` (Guerrilla). mail.tm
 * reliably creates inboxes but silently drops a fraction of inbound mail, so
 * OTP emails often never arrive — that's why the suite switched to Guerrilla.
 * To use this one instead, point the tests' imports here.
 *
 * Both mail.tm and mail.gw endpoints serve the same backend; mail.gw has been
 * intermittently
 * unreachable (HTTP 502) so we default to mail.tm. Override via
 * `MAIL_API_BASE` if a different mirror is needed.
 *
 * Response handling tolerates both shapes the API has shipped:
 *   - bare JSON arrays / objects (newer mail.gw responses)
 *   - `hydra:member`-wrapped collections (older / mail.tm responses)
 */

const MAIL_API_BASE = process.env.MAIL_API_BASE || 'https://api.mail.tm'

export type TempEmailAccount = {
  address: string
  authToken: string
}

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

/**
 * Pings the email service to check availability.
 * @throws If the service is unavailable
 */
export async function ping(): Promise<void> {
  const res = await fetch(`${MAIL_API_BASE}/domains`, {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(
      `Email service unavailable: ${res.status} ${res.statusText}`,
    )
  }
  const data = await res.json()
  // API returns a plain array of domain objects
  const domains = Array.isArray(data) ? data : (data['hydra:member'] ?? [])
  if (domains.length === 0) {
    throw new Error('Email service has no domains available')
  }
}

/**
 * Creates a new temporary email account.
 * Generates a random email address and returns it with an auth token.
 */
export async function createNewAccount(): Promise<TempEmailAccount> {
  // Get available domain
  const domainsRes = await fetch(`${MAIL_API_BASE}/domains`, {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(10_000),
  })
  if (!domainsRes.ok) {
    throw new Error(`Failed to get domains: ${domainsRes.status}`)
  }
  const domainsData = await domainsRes.json()

  // Handle both array response and hydra:member wrapped response
  const domains = Array.isArray(domainsData)
    ? domainsData
    : (domainsData['hydra:member'] ?? [])
  const domain = domains[0]?.domain
  if (!domain) {
    throw new Error('No email domains available')
  }

  // Generate random email
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const address = `email_${randomHex}@${domain}`
  const password = '123456'

  // Create account. mail.tm rate-limits account creation aggressively
  // (~3–5/min). On 429 we back off and retry; for any other failure we
  // fail loud immediately.
  const ACCOUNT_CREATE_ATTEMPTS = 5
  let createRes: Response | undefined
  for (let attempt = 0; attempt < ACCOUNT_CREATE_ATTEMPTS; attempt++) {
    createRes = await fetch(`${MAIL_API_BASE}/accounts`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ address, password }),
    })
    if (createRes.ok) break
    if (createRes.status !== 429) {
      const text = await createRes.text()
      throw new Error(
        `Failed to create email account: ${createRes.status} ${text}`,
      )
    }
    // Exponential backoff: 5s, 10s, 20s, 40s. mail.tm's window is short
    // enough that this almost always recovers within two retries.
    const delayMs = 5_000 * 2 ** attempt
    await new Promise((r) => setTimeout(r, delayMs))
  }
  if (!createRes || !createRes.ok) {
    throw new Error(
      `Failed to create email account after ${ACCOUNT_CREATE_ATTEMPTS} attempts: ${createRes?.status ?? 'no response'}`,
    )
  }

  // Get auth token
  const tokenRes = await fetch(`${MAIL_API_BASE}/token`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ address, password }),
  })
  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Failed to get email token: ${tokenRes.status} ${text}`)
  }
  const tokenData = await tokenRes.json()
  const authToken = tokenData.token
  if (!authToken) {
    throw new Error('No token in response')
  }

  return { address, authToken }
}

/**
 * Polls for a new email and returns its text content.
 *
 * @param authToken - The auth token from createNewAccount
 * @param intervalMs - Poll interval in milliseconds
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns The email text content
 * @throws If no email arrives within the timeout
 */
export async function searchForNewEmail(
  authToken: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await sleep(intervalMs)

    try {
      const messagesRes = await fetch(`${MAIL_API_BASE}/messages`, {
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (!messagesRes.ok) {
        // 401 or 500 may mean the inbox isn't ready yet, keep polling
        if (messagesRes.status >= 500 || messagesRes.status === 401) continue
        throw new Error(`Failed to list messages: ${messagesRes.status}`)
      }

      const messagesData = await messagesRes.json()

      // Handle both array response and hydra:member wrapped response
      const messages = Array.isArray(messagesData)
        ? messagesData
        : (messagesData['hydra:member'] ?? [])
      if (messages.length === 0) continue

      // Get full message content
      const messageId = messages[0].id
      const messageRes = await fetch(`${MAIL_API_BASE}/messages/${messageId}`, {
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (!messageRes.ok) {
        throw new Error(`Failed to get message: ${messageRes.status}`)
      }

      const messageData = await messageRes.json()
      const text = messageData.text
      if (text) return text
    } catch (err) {
      // Network errors during polling — keep trying
      if (Date.now() >= deadline) throw err
    }
  }

  throw new Error(`No email received within ${timeoutMs}ms timeout`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
