/**
 * The message of anything thrown or rejected with. WalletConnect rejects
 * with plain `{ code, message }` objects rather than `Error` instances, and
 * `String()` of those is `[object Object]`.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return String(err)
}
