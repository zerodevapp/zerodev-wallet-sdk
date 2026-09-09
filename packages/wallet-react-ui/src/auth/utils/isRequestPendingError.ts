/**
 * EIP-1193 `-32002` "Resource unavailable": the wallet already has a request
 * open for this origin (MetaMask: "Request of type wallet_requestPermissions
 * already pending"). Happens when the user closed the wallet popup without
 * answering and clicked again — the first request is still waiting inside the
 * extension. wagmi/viem wrap the original error, so walk the cause chain.
 */
export function isRequestPendingError(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (
      (current as { code?: unknown }).code === -32002 ||
      current.name === 'ResourceUnavailableRpcError'
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}
