'use client'

import { useSolanaAccount, useSolanaAutoReconnect } from '@zerodev/wallet-react-ui'
import { LogOut } from 'lucide-react'

function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

/**
 * The kit's Solana wallet slot, as the host sees it: which external Solana
 * wallet is connected (Phantom, Solflare, …), its base58 address, and a way
 * to disconnect. Independent of the wagmi (EVM) connection, so it renders
 * on the login screen and in the lab alike. Hidden while disconnected.
 */
export function SolanaAccountStrip({
  showDisconnect = true,
}: {
  /** Render the strip's own disconnect control. Turn it off where a main
   * Logout exists that already clears the Solana slot too. */
  showDisconnect?: boolean
} = {}) {
  const solana = useSolanaAccount()
  // A wallet authorised on an earlier visit comes back without a prompt.
  useSolanaAutoReconnect()

  if (!solana.isConnected || !solana.address) return null

  return (
    <div
      data-testid="solana-account-strip"
      className="flex items-center gap-3 rounded-lg border border-[var(--border-warm)] bg-white px-4 py-2 text-sm"
    >
      {solana.walletIcon && (
        // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data: URIs from the wallet itself
        <img src={solana.walletIcon} alt="" className="h-5 w-5 rounded" />
      )}
      <span className="font-semibold text-[var(--ink)]">
        {solana.walletName ?? 'Solana wallet'}
      </span>
      <span className="rounded bg-[#e9f7ef] px-1.5 py-0.5 font-mono text-[11px] text-[#1f7a4d]">
        SOLANA
      </span>
      <span
        className="font-mono text-[var(--muted)]"
        title={solana.address}
        data-testid="solana-address"
      >
        {shorten(solana.address)}
      </span>
      {showDisconnect && (
        <button
          type="button"
          onClick={() => solana.disconnect()}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[var(--muted)] hover:text-[var(--ink)]"
          aria-label="Disconnect Solana wallet"
        >
          <LogOut className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
