/**
 * Did the user cancel, rather than something fail? Passkey prompt dismissed,
 * OAuth popup closed, or an external wallet's connection request rejected.
 */
export function isCancellationError(err: unknown): boolean {
  // EIP-1193 `4001` "user rejected", checked first and on any object: the
  // shape varies by layer. viem throws `UserRejectedRequestError`; MetaMask's
  // own `ProviderRpcError` extends Error with `code: 4001` and a generic
  // name; wagmi's injected connector sometimes rethrows the wallet's raw
  // JSON-RPC object, not an Error at all. Walk `.cause` since wagmi/viem
  // sometimes nest the original.
  let current: unknown = err
  for (let depth = 0; depth < 5 && isObject(current); depth++) {
    if (current.code === 4001) return true
    current = current.cause
  }

  if (!(err instanceof Error)) return false
  // WebAuthn / passkey
  if (err.name === 'AbortError' || err.name === 'NotAllowedError') return true
  // EIP-1193 user rejection via viem, when the code was not preserved
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
