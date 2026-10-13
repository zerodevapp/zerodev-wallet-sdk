/** EIP-1193 `4001` "user rejected"; WalletConnect's `5000` USER_REJECTED and
 * `5001`-`5003` for rejected chains, methods and events (a Solana pairing
 * rejects with the raw sign-client object, not an Error). */
const CANCELLATION_CODES = new Set([4001, 5000, 5001, 5002, 5003])

/**
 * The user cancelled, rather than something failed: passkey prompt dismissed,
 * OAuth popup closed, or a wallet connection request rejected.
 */
export function isCancellationError(err: unknown): boolean {
  // The code may sit on any object: viem's UserRejectedRequestError, a
  // wallet's own ProviderRpcError (an Error with `code`), wagmi's rethrown
  // raw JSON-RPC object, or WalletConnect's rejection. Walk `.cause`.
  let current: unknown = err
  for (let depth = 0; depth < 5 && isObject(current); depth++) {
    if (
      typeof current.code === 'number' &&
      CANCELLATION_CODES.has(current.code)
    )
      return true
    current = current.cause
  }

  if (!(err instanceof Error)) return false
  // WebAuthn / passkey
  if (err.name === 'AbortError' || err.name === 'NotAllowedError') return true
  // viem's rejection error when `code` was dropped
  if (err.name === 'UserRejectedRequestError') return true
  // OAuth (existing logic, message-based)
  const msg = err.message.toLowerCase()
  return msg.includes('oauth popup was closed')
}

function isObject(
  value: unknown,
): value is { code?: unknown; cause?: unknown } {
  return typeof value === 'object' && value !== null
}
