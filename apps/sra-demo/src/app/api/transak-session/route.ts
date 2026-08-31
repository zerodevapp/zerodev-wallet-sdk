import { NextResponse } from 'next/server'

/**
 * Mints a Transak widget URL for the SRA widget's "Buy with card" flow —
 * the recipe every SRA host needs on their backend: Transak's widget host
 * refuses plain `?apiKey=` embedding (403 + X-Frame-Options), so URLs must
 * come from its server-side session API, authenticated with the partner
 * secret. The secret lives in server-only env (`TRANSAK_API_SECRET`, no
 * NEXT_PUBLIC_ prefix) and never reaches the browser.
 *
 * Flow (docs.transak.com):
 *   1. POST partners/api/v2/refresh-token  (x-api-key + api-secret)
 *      → accessToken, valid 7 days — cached module-level to avoid
 *      rate-limiting.
 *   2. POST api/v2/auth/session  (x-api-key + access-token + x-user-ip)
 *      with widgetParams → widgetUrl (single-use, 5-minute expiry).
 */

const HOSTS = {
  STAGING: {
    partners: 'https://api-stg.transak.com',
    gateway: 'https://api-gateway-stg.transak.com',
  },
  PRODUCTION: {
    partners: 'https://api.transak.com',
    gateway: 'https://api-gateway.transak.com',
  },
} as const

// Access-token cache. Module-level state survives across requests within a
// server instance; a fresh instance simply refetches.
let cached: { token: string; expiresAt: number } | null = null

// Public egress IP cache — dev-only fallback for the x-user-ip header when
// no proxy header exists (see below).
let egressIp: string | null = null

async function getEgressIp(): Promise<string> {
  if (egressIp) return egressIp
  try {
    const res = await fetch('https://api.ipify.org', {
      signal: AbortSignal.timeout(3000),
    })
    egressIp = (await res.text()).trim()
  } catch {
    egressIp = '127.0.0.1'
  }
  return egressIp
}

async function getAccessToken(
  hosts: (typeof HOSTS)[keyof typeof HOSTS],
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  // Refresh 5 minutes early so a token can't expire mid-session-mint.
  if (cached && cached.expiresAt * 1000 > Date.now() + 5 * 60_000) {
    return cached.token
  }
  const res = await fetch(`${hosts.partners}/partners/api/v2/refresh-token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'api-secret': apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  })
  if (!res.ok) {
    throw new Error(`Transak refresh-token failed: ${res.status}`)
  }
  const { data } = (await res.json()) as {
    data: { accessToken: string; expiresAt: number }
  }
  cached = { token: data.accessToken, expiresAt: data.expiresAt }
  return data.accessToken
}

export async function POST(req: Request) {
  const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY
  const apiSecret = process.env.TRANSAK_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Transak is not configured (TRANSAK_API_SECRET missing)' },
      { status: 501 },
    )
  }
  const hosts =
    process.env.NEXT_PUBLIC_TRANSAK_ENV === 'PRODUCTION'
      ? HOSTS.PRODUCTION
      : HOSTS.STAGING

  const {
    walletAddress,
    cryptoCurrencyCode,
    network,
    referrerDomain: referrerOverride,
  } = (await req.json().catch(() => ({}))) as {
    walletAddress?: string
    cryptoCurrencyCode?: string
    network?: string
    /** Dev override for experimenting with Transak's domain matching. */
    referrerDomain?: string
  }

  try {
    const accessToken = await getAccessToken(hosts, apiKey, apiSecret)
    // Transak binds the session to the END USER's IP — mint with the wrong
    // one and the widget 401s on its own sessions/me check. Behind a proxy
    // it's the first x-forwarded-for hop; on localhost dev Next's server
    // fills that header with the loopback address (::1 / 127.0.0.1), which
    // Transak rejects, so treat loopback as "no proxy" and fall back to
    // this machine's public egress IP (same NAT as the browser, so it
    // matches).
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const isLoopback =
      !forwarded || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(forwarded)
    const userIp = isLoopback ? await getEgressIp() : forwarded
    const referrerDomain =
      referrerOverride ?? req.headers.get('origin') ?? new URL(req.url).origin

    const res = await fetch(`${hosts.gateway}/api/v2/auth/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'access-token': accessToken,
        'x-user-ip': userIp,
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey,
          referrerDomain,
          ...(walletAddress && {
            walletAddress,
            // Lock the address form so the purchase can't be misrouted away
            // from the SRA deposit address.
            disableWalletAddressForm: 'true',
          }),
          ...(cryptoCurrencyCode && { cryptoCurrencyCode }),
          ...(network && { network }),
        },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('Transak session failed:', res.status, body.slice(0, 300))
      return NextResponse.json(
        { error: `Transak session failed (${res.status})` },
        { status: 502 },
      )
    }
    const { data } = (await res.json()) as { data: { widgetUrl: string } }
    return NextResponse.json({ widgetUrl: data.widgetUrl })
  } catch (err) {
    console.error('Transak session error:', err)
    return NextResponse.json(
      { error: 'Failed to create Transak session' },
      { status: 502 },
    )
  }
}
