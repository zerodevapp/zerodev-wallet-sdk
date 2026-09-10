/**
 * EIP-1193 `-32002`: the wallet already has a request open for this origin
 * (popup closed without answering, then clicked again). It won't prompt again
 * until that one is answered in the extension.
 *
 * viem wraps it as `ResourceUnavailableRpcError`; wagmi's injected connector
 * rethrows the raw JSON-RPC object. Accept both and walk `.cause`.
 */
export function isRequestPendingError(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 5 && isObject(current); depth++) {
    if (
      current.code === -32002 ||
      current.name === 'ResourceUnavailableRpcError'
    ) {
      return true
    }
    current = current.cause
  }
  return false
}

function isObject(
  value: unknown,
): value is { code?: unknown; name?: unknown; cause?: unknown } {
  return typeof value === 'object' && value !== null
}
