/**
 * Temporary email service using the Guerrilla Mail API.
 *
 * The default provider for the OTP / magic-link e2e tests. It replaced mail.tm
 * (now parked in `temp-email-mailtm.ts`), which reliably created inboxes but
 * silently dropped a fraction of inbound mail — OTP emails often never arrived
 * (or took 20+ min), so the tests timed out waiting. Guerrilla delivers the
 * Turnkey OTP within ~10–20s and needs no account creation (a single GET mints
 * an address), sidestepping mail.tm's account-creation rate limiting too.
 *
 * `authToken` carries Guerrilla's `sid_token` (its session identifier) rather
 * than a bearer token. Override the base URL via `MAIL_API_BASE` if needed. To
 * switch back to mail.tm, point the tests' imports at `./temp-email-mailtm.js`.
 */

const MAIL_API_BASE = 'https://api.guerrillamail.com/ajax.php'

// Guerrilla keys API sessions to the client; a stable UA avoids being treated
// as a fresh anonymous client on every call.
const defaultHeaders = {
  'User-Agent': 'zerodev-wallet-sdk-e2e',
}

export type TempEmailAccount = {
  address: string
  authToken: string
}

type GuerrillaMessage = {
  mail_id: string
  mail_from: string
  mail_subject: string
}

/**
 * Pings the email service to check availability.
 * @throws If the service is unavailable
 */
export async function ping(): Promise<void> {
  // get_email_address is the lightest endpoint that proves the service can mint
  // an inbox — there is no separate health/domains endpoint.
  const res = await fetch(`${MAIL_API_BASE}?f=get_email_address`, {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(
      `Email service unavailable: ${res.status} ${res.statusText}`,
    )
  }
  const data = await res.json()
  if (!data.email_addr) {
    throw new Error('Email service returned no address')
  }
}

/**
 * Creates a new temporary email account.
 * Returns the address and the session token used to read its inbox.
 */
export async function createNewAccount(): Promise<TempEmailAccount> {
  const res = await fetch(`${MAIL_API_BASE}?f=get_email_address`, {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Failed to create email account: ${res.status}`)
  }
  const data = await res.json()
  const address = data.email_addr
  const authToken = data.sid_token
  if (!address || !authToken) {
    throw new Error('No address or session token in response')
  }

  return { address, authToken }
}

/**
 * Polls for a new email and returns its subject + text content.
 *
 * The OTP code lands in the email subject (and body); returning both lets the
 * extractor find it regardless of which the template uses.
 *
 * @param authToken - The session token from createNewAccount
 * @param intervalMs - Poll interval in milliseconds
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns The email subject and text content
 * @throws If no email arrives within the timeout
 */
export async function searchForNewEmail(
  authToken: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const listUrl = `${MAIL_API_BASE}?f=get_email_list&offset=0&sid_token=${encodeURIComponent(authToken)}`

  while (Date.now() < deadline) {
    await sleep(intervalMs)

    try {
      const listRes = await fetch(listUrl, {
        headers: defaultHeaders,
        signal: AbortSignal.timeout(10_000),
      })
      if (!listRes.ok) {
        // Transient server error — the session may not be ready yet, keep polling.
        if (listRes.status >= 500) continue
        throw new Error(`Failed to list messages: ${listRes.status}`)
      }

      const listData = await listRes.json()
      const messages: GuerrillaMessage[] = listData.list ?? []
      // Guerrilla seeds every new inbox with its own welcome email; ignore it
      // so we wait for the actual OTP rather than extracting from the greeting.
      const message = messages.find(
        (m) => !/guerrillamail\.com/i.test(m.mail_from),
      )
      if (!message) continue

      const fetchUrl = `${MAIL_API_BASE}?f=fetch_email&email_id=${encodeURIComponent(message.mail_id)}&sid_token=${encodeURIComponent(authToken)}`
      const emailRes = await fetch(fetchUrl, {
        headers: defaultHeaders,
        signal: AbortSignal.timeout(10_000),
      })
      if (!emailRes.ok) {
        throw new Error(`Failed to get message: ${emailRes.status}`)
      }

      const emailData = await emailRes.json()
      const subject = emailData.mail_subject ?? ''
      const body = emailData.mail_body ?? ''
      if (subject || body) return `${subject}\n\n${body}`
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
