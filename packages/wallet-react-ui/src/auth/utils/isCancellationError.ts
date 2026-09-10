/**
 * The user cancelled, rather than something failed: passkey prompt dismissed,
 * OAuth popup closed, or wallet connection request rejected.
 */
export function isCancellationError(err: unknown): boolean {
  // EIP-1193 `4001` "user rejected", on any object: viem's
  // UserRejectedRequestError, MetaMask's ProviderRpcError (an Error with
  // `code`), or wagmi's rethrown raw JSON-RPC object. Walk `.cause`.
  let current: unknown = err
  for (let depth = 0; depth < 5 && isObject(current); depth++) {
    if (current.code === 4001) return true
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
