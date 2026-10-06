import { InstalledWalletsMultichain } from './InstalledWalletsMultichain'

/**
 * Auto-discovered rows for installed Solana wallets: one row per wallet the
 * Wallet Standard registry announces with a `solana:*` chain (Phantom,
 * Solflare, Backpack, …). Renders nothing when none is installed. The same
 * list as `<SignUp.InstalledWallets namespaces={['solana']} />`; prefer
 * `namespaces={['eip155', 'solana']}` for one merged list with a chain choice.
 */
export function SignUpSolanaWallets({
  excludeWalletNames = [],
  maxWallets = 4,
}: {
  /** Wallets to hide, by the name they register under (e.g. `'Phantom'`). */
  excludeWalletNames?: string[]
  /** Cap on the number of rendered rows (default 4). */
  maxWallets?: number
}) {
  return (
    <InstalledWalletsMultichain
      namespaces={['solana']}
      excludeWalletIds={excludeWalletNames}
      maxWallets={maxWallets}
    />
  )
}
