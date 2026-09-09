export function isCancellationError(err: unknown): boolean {
  // Wallets' raw JSON-RPC errors are plain objects, not Error instances;
  // 4001 is EIP-1193 "user rejected".
  if (typeof err === 'object' && err !== null && !(err instanceof Error)) {
    return (err as { code?: unknown }).code === 4001
  }
  if (!(err instanceof Error)) return false
  // WebAuthn / passkey
  if (err.name === 'AbortError' || err.name === 'NotAllowedError') return true
  // EIP-1193 user rejection (external-wallet connect), via viem
  if (err.name === 'UserRejectedRequestError') return true
  // OAuth (existing logic, message-based)
  const msg = err.message.toLowerCase()
  return msg.includes('oauth popup was closed')
}
