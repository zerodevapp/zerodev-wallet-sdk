import { NextResponse } from 'next/server'
import type { Address } from 'viem'
import { actForUser } from '../../../lib/spike-agent'

export const runtime = 'nodejs'
export const maxDuration = 60

const STRANGER = '0x000000000000000000000000000000000000dEaD' as Address

/**
 * One run of the agent. `claim` mints to the user; `rogue` simulates a
 * compromised agent minting to someone else, which the policy must block.
 * Stateless: the caller sends the permission context it was granted.
 */
export async function POST(req: Request) {
  const { permissionsContext, user, action } = (await req.json()) as {
    permissionsContext: string
    user: Address
    action: 'claim' | 'rogue'
  }
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  try {
    return NextResponse.json(
      await actForUser({
        permissionsContext,
        to: action === 'rogue' ? STRANGER : user,
        origin,
      }),
    )
  } catch (e) {
    const err = e as { shortMessage?: string; message: string }
    console.error('[agent tick]', err)
    return NextResponse.json(
      { ok: false, kind: 'error', message: err.shortMessage ?? err.message },
      { status: 500 },
    )
  }
}
