'use client'

import { useEffect } from 'react'
import { useConfig } from 'wagmi'

/**
 * Dev-only: times what wagmi's page-load reconnect() awaits. The sweep calls
 * getProvider() then isAuthorized() on EVERY connector — including each wallet
 * extension discovered via EIP-6963 — and flips `status` only when all have
 * answered. One slow extension stalls the whole app; this names it.
 */
export function ReconnectDiagnostics() {
  const config = useConfig()

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const t = () => `+${Math.round(performance.now())}ms`
    let probed = false

    const probe = () => {
      if (probed) return
      probed = true
      console.log(
        `[diag ${t()}] connectors in sweep order: ${config.connectors.map((c) => c.id).join(', ')}`,
      )
      for (const c of config.connectors) {
        const start = performance.now()
        const took = () => `${Math.round(performance.now() - start)}ms`
        c.getProvider()
          .then(() => c.isAuthorized())
          .then(
            (ok) => console.log(`[diag ${t()}] isAuthorized(${c.id}) → ${ok} (${took()})`),
            (e) => console.log(`[diag ${t()}] isAuthorized(${c.id}) threw (${took()})`, e),
          )
      }
    }

    console.log(`[diag ${t()}] wagmi status at mount: ${config.state.status}`)
    // Discovered (EIP-6963) connectors are appended when hydration starts, so
    // probe once the sweep has begun rather than at mount.
    const unsubscribe = config.subscribe(
      (s) => s.status,
      (status) => {
        console.log(`[diag ${t()}] wagmi status → ${status}`)
        if (status === 'connecting' || status === 'reconnecting') probe()
      },
    )
    return unsubscribe
  }, [config])

  return null
}
