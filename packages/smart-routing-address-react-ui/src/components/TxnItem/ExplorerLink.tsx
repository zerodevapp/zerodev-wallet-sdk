import { cn, Icon } from '@zerodev/react-ui'

export interface ExplorerLinkProps {
  /** Full block-explorer URL, e.g. `https://etherscan.io/tx/0x…`. */
  href: string
  /** Short address / hash used for the accessible label. */
  address: string
  className?: string
}

/**
 * Small icon-only anchor to a block-explorer entry — the trailing action on a
 * `TxnItem` row. Kept as its own component so both `PendingDeposits` (renders
 * it inline via `TxnItem`'s `trailingAction` slot) and `PastDeposits`
 * (renders it as an absolute sibling of the row-select button) use identical
 * markup and styling.
 */
export function ExplorerLink({ href, address, className }: ExplorerLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`View ${address} on block explorer`}
      // Stop the click from bubbling to a parent that might otherwise
      // intercept it (e.g. a row-select `<button>` in `PastDeposits` when
      // this anchor is layered over the row via absolute positioning).
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'zd:inline-flex zd:items-center zd:justify-center zd:rounded-md zd:p-1.5 zd:text-icon-brand-primary zd:hover:bg-bright-secondary',
        className,
      )}
    >
      <Icon name="export" className="zd:size-4" aria-hidden />
    </a>
  )
}
