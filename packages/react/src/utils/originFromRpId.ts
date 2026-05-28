/**
 * Build the `Origin` header value (or any URL-shaped string) from an
 * `rpId`. If the value already includes an `http://` or `https://` scheme,
 * return it verbatim — useful in dev when a backend ACL requires a
 * non-https origin like `http://localhost:8082`. Otherwise prepend
 * `https://`. Internal — not re-exported from the package.
 */
export function originFromRpId(rpId: string): string {
  return rpId.startsWith('http://') || rpId.startsWith('https://')
    ? rpId
    : `https://${rpId}`
}
