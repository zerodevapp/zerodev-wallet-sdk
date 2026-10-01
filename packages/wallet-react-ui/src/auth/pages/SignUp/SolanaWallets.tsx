import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useSolanaAutoReconnect } from '../../../solana/hooks/useSolanaAutoReconnect'
import { useSolanaWallets } from '../../../solana/hooks/useSolanaWallets'
import { useSignUpContext } from './context'
import { useSolanaConnect } from './useSolanaConnect'

/**
 * Auto-discovered rows for installed Solana wallets: one row per wallet the
 * Wallet Standard registry announces with a `solana:*` chain (Phantom,
 * Solflare, Backpack, …). Renders nothing when none is installed.
 *
 * Connecting goes through the wallet's `standard:connect` and lands in the
 * kit store's `solana` slot — independent of the wagmi (EVM) connection, so
 * a user can hold both. Multichain wallets (Phantom) also announce an EVM
 * provider through EIP-6963 and so appear in `SignUp.InstalledWallets` too;
 * prefer `<SignUp.InstalledWallets namespaces={['eip155', 'solana']} />`
 * for one merged list with a chain choice. On success the sign-up flow
 * closes, like an EVM wallet connection.
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
  const { authPending } = useSignUpContext()
  const wallets = useSolanaWallets()
  // A wallet authorised on a previous visit comes back without a prompt.
  useSolanaAutoReconnect()
  const { connectSolana, pendingSolanaName, connectedSolanaName } =
    useSolanaConnect()

  const rows = wallets
    .filter((w) => !excludeWalletNames.includes(w.name))
    .slice(0, maxWallets)

  return (
    <>
      {rows.map((wallet) => {
        const isConnected = connectedSolanaName === wallet.name
        const isPending = pendingSolanaName === wallet.name
        return (
          <ListItem
            key={wallet.name}
            title={wallet.name}
            icon={<img src={wallet.icon} alt="" className="zd:w-6 zd:h-6" />}
            subtitle={
              <span className="zd:flex zd:gap-1">
                <Badge text="SOLANA" variant="secondary" />
                <Badge
                  text={
                    isConnected
                      ? 'CONNECTED'
                      : isPending
                        ? 'CONNECTING'
                        : 'INSTALLED'
                  }
                />
              </span>
            }
            trailing={<ListItemChevron />}
            disabled={authPending || isConnected}
            onClick={() => connectSolana(wallet)}
          />
        )
      })}
    </>
  )
}
