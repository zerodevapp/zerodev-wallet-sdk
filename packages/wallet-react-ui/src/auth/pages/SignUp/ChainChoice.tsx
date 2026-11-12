import {
  Badge,
  ListItem,
  ListItemChevron,
  ListItemIcon,
} from '@zerodev/react-ui'

/**
 * The chain choice under a multichain wallet row: a wallet installed for
 * both EVM and Solana asks which side to connect, as Reown AppKit does.
 * Shared by `SignUp.InstalledWallets` and `SignUp.Wallet`.
 */
export function ChainChoice({
  name,
  evmDisabled,
  solanaDisabled,
  onEvm,
  onSolana,
}: {
  /** Wallet name, for the test id. */
  name: string
  evmDisabled: boolean
  solanaDisabled: boolean
  onEvm: () => void
  onSolana: () => void
}) {
  return (
    <div
      className="zd:flex zd:flex-col zd:gap-2 zd:pl-8"
      data-testid={`chain-choice-${name}`}
    >
      <ListItem
        title="Ethereum"
        icon={<ListItemIcon name="ethereum" />}
        subtitle={<Badge text="EVM" variant="secondary" />}
        trailing={<ListItemChevron />}
        disabled={evmDisabled}
        onClick={onEvm}
      />
      <ListItem
        title="Solana"
        icon={<ListItemIcon name="solana" />}
        subtitle={<Badge text="SOLANA" variant="secondary" />}
        trailing={<ListItemChevron />}
        disabled={solanaDisabled}
        onClick={onSolana}
      />
    </div>
  )
}

/** The badge strip of a multichain row: a chip per installed side, then
 * the state. */
export function MultichainBadges({
  evm,
  solana,
  state,
}: {
  evm: boolean
  solana: boolean
  state: 'INSTALLED' | 'CONNECTING' | 'CONNECTED'
}) {
  return (
    <span className="zd:flex zd:gap-1">
      {evm && <Badge text="EVM" variant="secondary" />}
      {solana && <Badge text="SOLANA" variant="secondary" />}
      <Badge text={state} />
    </span>
  )
}
