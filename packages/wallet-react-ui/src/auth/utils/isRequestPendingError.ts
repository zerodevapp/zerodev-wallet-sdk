/**
 * EIP-1193 `-32002` "Resource unavailable": the wallet already has a request
 * open for this origin (MetaMask: "Request of type wallet_requestPermissions
 * already pending"). Happens when the user closed the wallet popup without
 * answering and clicked again — the first request is still waiting inside the
 * extension, and the wallet will not open a second prompt until it's
 * resolved there.
 *
 * Shape varies by layer: viem wraps it as `ResourceUnavailableRpcError`, but
 * wagmi's injected connector rethrows the wallet's raw JSON-RPC error object
 * (`{ code: -32002, message }`) — not an `Error` instance. Accept both, and
 * walk `.cause` since wagmi/viem sometimes nest the original.
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
