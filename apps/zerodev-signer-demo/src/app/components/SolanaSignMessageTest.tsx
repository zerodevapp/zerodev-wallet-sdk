'use client'

import { useSolanaAccount, useSolanaWallet } from '@zerodev/wallet-react-ui'
import { Loader2, PenLine } from 'lucide-react'
import { useState } from 'react'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Base58 (Solana convention) for display; bytes to text only. */
function toBase58(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits: number[] = []
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      const value = (digits[i] ?? 0) * 256 + carry
      digits[i] = value % 58
      carry = Math.floor(value / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  return (
    '1'.repeat(zeros) +
    digits
      .reverse()
      .map((d) => BASE58[d])
      .join('')
  )
}

/**
 * Sign a message with the connected Solana wallet. The kit signs nothing:
 * this calls the wallet's own `solana:signMessage` feature through
 * `useSolanaWallet()`, so Phantom or MetaMask shows its prompt and returns
 * an ed25519 signature over the message bytes.
 */
export function SolanaSignMessageTest() {
  const solana = useSolanaAccount()
  const handle = useSolanaWallet()
  const [message, setMessage] = useState('Hello from ZeroDev Wallet')
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)

  if (!solana.isConnected || !handle) return null

  const canSign = handle.signMessage !== null

  const sign = async () => {
    if (!handle.signMessage) return
    setIsSigning(true)
    setError(null)
    setSignature(null)
    try {
      const { signature } = await handle.signMessage(
        new TextEncoder().encode(message),
      )
      setSignature(toBase58(signature))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed')
    } finally {
      setIsSigning(false)
    }
  }

  return (
    <div
      data-testid="solana-sign-message"
      className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-[var(--ink)]" />
        <h2 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">
          Sign a message with Solana
        </h2>
        <span className="rounded bg-[#e9f7ef] px-1.5 py-0.5 font-mono text-[11px] text-[#1f7a4d]">
          {solana.walletName ?? 'Solana wallet'}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        The wallet signs with its own prompt; the kit only hands over the
        message bytes and shows the ed25519 signature it returns.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Message to sign"
          className="min-w-0 flex-1 rounded-md border border-[var(--border-warm)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-warm)] focus:ring-2 focus:ring-[var(--accent-warm)]/20"
        />
        <button
          type="button"
          onClick={sign}
          disabled={!canSign || isSigning || message.length === 0}
          data-testid="solana-sign-button"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a1c13] disabled:cursor-default disabled:opacity-50"
        >
          {isSigning && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSigning ? 'Waiting for wallet…' : 'Sign message'}
        </button>
      </div>
      {!canSign && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          This wallet does not expose solana:signMessage.
        </p>
      )}
      {signature && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c958c]">
            Signature (base58)
          </p>
          <p
            data-testid="solana-signature"
            className="mt-1 break-all rounded-md bg-[var(--surface-warm)] px-3 py-2 font-mono text-xs text-[var(--ink)]"
          >
            {signature}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
