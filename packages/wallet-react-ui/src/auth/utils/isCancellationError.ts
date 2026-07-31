export function isCancellationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // WebAuthn / passkey
  if (err.name === 'AbortError' || err.name === 'NotAllowedError') return true
  // OAuth (existing logic, message-based)
  const msg = err.message.toLowerCase()
  return msg.includes('oauth popup was closed')
}
