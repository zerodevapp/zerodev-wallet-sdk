/**
 * Temporary inboxes for the OTP and magic-link e2e tests, via Mailosaur.
 *
 * Needs `MAILOSAUR_API_KEY` and `MAILOSAUR_SERVER_ID`. Any address at
 * `<SERVER_ID>.mailosaur.net` reaches the inbox with nothing created up front.
 *
 * Two traps. One server serves every test in a run, so a read must filter on
 * the recipient or tests see each other's mail. And `authToken` carries the
 * address rather than a credential, because that is what identifies an inbox.
 */

const API_BASE = process.env.MAILOSAUR_API_BASE || 'https://mailosaur.com/api'

export type TempEmailAccount = {
  address: string
  authToken: string
}

/** Earliest message worth looking at, per address: anything older is a previous test's. */
const inboxOpenedAt = new Map<string, string>()
/** A second login to the same inbox must not re-read the first email. */
const consumedMessageIds = new Map<string, Set<string>>()

function config() {
  const apiKey = process.env.MAILOSAUR_API_KEY
  const serverId = process.env.MAILOSAUR_SERVER_ID
  if (!apiKey || !serverId) {
    throw new Error(
      'MAILOSAUR_API_KEY and MAILOSAUR_SERVER_ID are required for the Mailosaur provider (see .env.example)',
    )
  }
  // Basic auth with the key as the password, per Mailosaur's own curl example.
  const auth = Buffer.from(`api:${apiKey}`).toString('base64')
  return { serverId, headers: { Authorization: `Basic ${auth}` } }
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

/** A refusal no amount of polling fixes: bad key, bad server id, outage. */
class FatalEmailError extends Error {}

/** Collections have shipped both bare and `items`-wrapped; accept either. */
function itemsOf(data: unknown): { id: string }[] {
  if (Array.isArray(data)) return data as { id: string }[]
  const items = (data as { items?: unknown })?.items
  return Array.isArray(items) ? (items as { id: string }[]) : []
}

/**
 * Mints an address on the server's domain. Nothing is created remotely, so
 * there is no quota or rate limit to hit.
 */
export async function createNewAccount(): Promise<TempEmailAccount> {
  const { serverId } = config()
  const local = `zd-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const address = `${local}@${serverId}.mailosaur.net`
  // A second before now, so a message that lands in the same tick is not missed.
  inboxOpenedAt.set(address, new Date(Date.now() - 1_000).toISOString())
  return { address, authToken: address }
}

/**
 * Polls for the next unread message to this address and returns
 * `subject\n\nbody`, the shape `otp-utils.ts` extracts from.
 *
 * Reads the HTML body: Turnkey's sign-in email carries no text/plain part, so
 * a text-only read is empty and the magic link is lost.
 *
 * @param authToken - the address, as returned by `createNewAccount`
 */
export async function searchForNewEmail(
  authToken: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<string> {
  const { serverId, headers } = config()
  const address = authToken
  const receivedAfter =
    inboxOpenedAt.get(address) ?? new Date(Date.now() - 60_000).toISOString()
  const deadline = Date.now() + timeoutMs
  let lastTransportError: unknown

  while (Date.now() < deadline) {
    await sleep(intervalMs)

    try {
      // Search rather than list: the server is shared, so the recipient filter
      // is what stops one test reading another's email.
      const searchRes = await fetch(
        `${API_BASE}/messages/search?server=${encodeURIComponent(serverId)}&receivedAfter=${encodeURIComponent(receivedAfter)}&itemsPerPage=10`,
        {
          method: 'POST',
          headers: { ...headers, ...jsonHeaders },
          body: JSON.stringify({ sentTo: address }),
          signal: AbortSignal.timeout(10_000),
        },
      )
      // Throttling is the one refusal worth waiting out. Everything else, a
      // bad key, a bad server id, an outage, is a real fault and goes red now
      // rather than as a timeout a minute later.
      if (searchRes.status === 429) continue
      if (!searchRes.ok) {
        throw new FatalEmailError(
          `Mailosaur search failed: ${searchRes.status} ${searchRes.statusText}`,
        )
      }

      const consumed = consumedMessageIds.get(address) ?? new Set<string>()
      // Most recent first, so the oldest unconsumed one is the next to read.
      const summary = itemsOf(await searchRes.json())
        .filter((m) => !consumed.has(m.id))
        .pop()
      if (!summary) continue

      // Summaries carry no body; the full message is a separate GET.
      const messageRes = await fetch(
        `${API_BASE}/messages/${encodeURIComponent(summary.id)}`,
        {
          headers: { ...headers, ...jsonHeaders },
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!messageRes.ok) {
        throw new FatalEmailError(
          `Mailosaur fetch failed: ${messageRes.status} ${messageRes.statusText}`,
        )
      }

      const message = (await messageRes.json()) as {
        subject?: string
        html?: { body?: string }
        text?: { body?: string }
      }
      const subject = message.subject ?? ''
      const body = message.html?.body || message.text?.body || ''
      if (subject || body) {
        consumed.add(summary.id)
        consumedMessageIds.set(address, consumed)
        return `${subject}\n\n${body}`
      }
    } catch (err) {
      if (err instanceof FatalEmailError) throw err
      // A transport blip mid-poll is survivable, but keep the cause so an
      // unreachable API does not masquerade as an email that never arrived.
      lastTransportError = err
    }
  }

  throw new Error(
    lastTransportError
      ? `No email received within ${timeoutMs}ms; last transport error: ${lastTransportError}`
      : `No email received within ${timeoutMs}ms`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
