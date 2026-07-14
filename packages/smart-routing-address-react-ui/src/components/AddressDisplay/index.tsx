import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'

/**
 * The card that renders the deposit address in the SRA "Deposit funds" screen.
 *
 * Two visual states, each mapped 1:1 to a Figma node:
 *   - Loading (Figma 17634:104343, "Smart Funding" card): 16px radius, 20%
 *     white surface, centered loading icon + `loadingText`. Rendered when
 *     `address` is omitted.
 *   - Ready (Figma 17762:78875, address+QR row): 14px radius, 40% offWhite
 *     surface, left-aligned address text + a 52×52 white QR button on the
 *     right. Rendered when `address` is supplied.
 *
 * The two states have deliberately different visuals; they share this
 * component because the parent renders the same slot in both cases.
 */
export interface AddressDisplayProps {
  /** Deposit address to render; when omitted, the loading variant is shown. */
  address?: string
  /**
   * Message rendered in the loading variant. Include chain-specific context
   * from the caller, e.g., `Watching for your deposit on Base…`.
   */
  loadingText?: string
  /** Handler for the QR icon button (ready variant). */
  onQrClick?: () => void
  className?: string
}

export function AddressDisplay({
  address,
  loadingText = 'Watching for your deposit…',
  onQrClick,
  className,
}: AddressDisplayProps) {
  if (address === undefined) {
    return (
      <Wrapper
        variant="ghost"
        className={cn(
          // Figma: rounded-2xl (16px), p-16, centered content, gap 8px, 20%
          // white surface from Wrapper's ghost variant. Height pinned to
          // 68px so it matches the ready variant.
          'zd:relative zd:flex zd:h-[68px] zd:w-full zd:items-center zd:justify-center zd:gap-2 zd:overflow-hidden zd:rounded-2xl zd:px-4',
          'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
          className,
        )}
        data-testid="address-display-loading"
      >
        <Icon name="lineLoading" className="zd:size-4 zd:text-greyScale/50" />
        <Text className="zd:text-body1 zd:text-greyScale/50">
          {loadingText}
        </Text>
      </Wrapper>
    )
  }

  return (
    <Wrapper
      variant="ghost"
      // Figma's 40% offWhite surface — none of Wrapper's white-only variants
      // hit this tint, so override the backgroundColor. Inline style wins
      // over Wrapper's own style prop.
      style={{ backgroundColor: 'rgba(247, 245, 240, 0.4)' }}
      className={cn(
        // Figma: rounded-[14px], pl-16 pr-8 py-8, gap-12 items-center.
        // Height pinned to 68px so the loading and ready variants swap without
        // the layout jumping.
        'zd:relative zd:flex zd:h-[68px] zd:w-full zd:items-center zd:gap-3 zd:overflow-hidden zd:rounded-[14px] zd:pl-4 zd:pr-2 zd:py-2',
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        className,
      )}
      data-testid="address-display-ready"
    >
      <Text
        className="zd:min-w-0 zd:flex-1 zd:break-all zd:text-body2"
        data-testid="address-display-address"
      >
        {address}
      </Text>
      <button
        type="button"
        onClick={onQrClick}
        aria-label="Show QR code"
        className="zd:flex zd:size-13 zd:shrink-0 zd:cursor-pointer zd:items-center zd:justify-center zd:rounded-2xl zd:bg-white"
        data-testid="address-display-qr-button"
      >
        <Icon name="qrCode" className="zd:size-5 zd:text-greyScale" />
      </button>
    </Wrapper>
  )
}
