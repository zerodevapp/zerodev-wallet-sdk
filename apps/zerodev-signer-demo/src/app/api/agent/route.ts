import { NextResponse } from 'next/server'
import { getAgentAddress } from '../../lib/spike-agent'

export const runtime = 'nodejs'

export function GET() {
  try {
    return NextResponse.json({ agentAddress: getAgentAddress() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
