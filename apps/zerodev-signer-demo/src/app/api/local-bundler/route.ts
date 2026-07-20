import type { NextRequest } from 'next/server'

/**
 * Same-origin proxy to the local Ultra Relay bundler (docker stack, :18080).
 *
 * The ZeroDev kernel client runs in the browser and (a) would be CORS-blocked
 * talking to the bundler directly, and (b) emits ZeroDev's `zd_*` JSON-RPC
 * dialect that the raw bundler doesn't implement. This route runs server-side
 * (no CORS) and rewrites the `zd_*` methods to the bundler's native ones before
 * forwarding. Only used by the local Anvil (31337) AA override.
 */
const BUNDLER_URL = process.env.LOCAL_BUNDLER_URL ?? 'http://localhost:18080'

const METHOD_MAP: Record<string, string> = {
  zd_getUserOperationGasPrice: 'pimlico_getUserOperationGasPrice',
}

type RpcCall = { method?: string; [k: string]: unknown }

const translate = (call: RpcCall): RpcCall =>
  call && typeof call.method === 'string' && METHOD_MAP[call.method]
    ? { ...call, method: METHOD_MAP[call.method] }
    : call

export async function POST(req: NextRequest) {
  const body = await req.json()
  const payload = Array.isArray(body) ? body.map(translate) : translate(body)

  const res = await fetch(BUNDLER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  })
}
