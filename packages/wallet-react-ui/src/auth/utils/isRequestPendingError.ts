/**
 * EIP-1474 `-32002` "Resource unavailable". Injected wallets send it when a
 * request for this origin is already open (popup closed without answering,
 * then clicked again) and they will not prompt again until it is answered —
 * wagmi's injected connector reads the code the same way ("prompt is already
 * open").
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
