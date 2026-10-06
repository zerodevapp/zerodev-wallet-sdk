/**
 * Whether two wallet names refer to the same wallet. EIP-6963 announcements,
 * Wallet Standard registrations and the wallet guide all carry a display name,
 * and a multichain wallet (Phantom, MetaMask) uses the same one on every side,
 * so a trimmed, case-insensitive compare is how the kit merges namespaces.
 */
export function sameWalletName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
