import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface TokenSummaryProps {
  /** Token logo URL, shown in the tile floating over the card's top edge.
   * The tile renders empty (neutral background) when omitted. */
  tokenLogoUrl?: string | undefined
  /** Rendered centred in the tile when there is no `tokenLogoUrl`: initials,
   * an icon. The tile stays empty when both are omitted. */
  tokenFallback?: ReactNode
  /** Small round badge on the tile's bottom-right corner — typically the
   * chain logo (Figma `20002:38009`). Omitted → no badge. */
  badgeLogoUrl?: string | undefined
  /** Headline, e.g. `"+$170.27"` (wallet home) or `"249.78 USDG"`
   * (transaction details). Display-agnostic on purpose: which of fiat /
   * token amount leads varies per screen. */
  primaryValue: string
  /** Secondary line under the headline; omitted → single-line hero. */
  secondaryValue?: string | undefined
  className?: string
}

/**
 * Token-value hero (Figma "Portfolio Value", `15873:58532` /
 * `20002:38000`): a card headed by a token logo tile that overhangs the top
 * edge, with a large headline and an optional secondary line beneath. The
 * overhang headroom is part of the component, so consumers can stack it
 * without clipping the tile.
 */
export function TokenSummary({
  tokenLogoUrl,
  tokenFallback,
  badgeLogoUrl,
  primaryValue,
  secondaryValue,
  className,
}: TokenSummaryProps) {
  return (
    <div className={cn('zd:relative zd:w-full zd:pt-7', className)}>
      <Wrapper
        variant="ghost"
        className="zd:flex zd:w-full zd:flex-col zd:items-center zd:gap-2 zd:rounded-2xl zd:px-2 zd:pt-16 zd:pb-2"
      >
        <Text className="zd:max-w-full zd:line-clamp-2 zd:wrap-anywhere zd:text-balance zd:text-center zd:text-h1">
          {primaryValue}
        </Text>
        {secondaryValue && (
          <Text className="zd:max-w-full zd:truncate zd:text-center zd:text-h3">
            {secondaryValue}
          </Text>
        )}
      </Wrapper>
      {/* Token tile — straddles the card's top edge, centred. */}
      <div className="zd:absolute zd:top-0 zd:left-1/2 zd:size-18.5 zd:-translate-x-1/2 zd:rounded-3xl zd:border zd:border-white/20 zd:bg-offWhite/80 zd:backdrop-blur-[15px]">
        {tokenLogoUrl ? (
          <img
            src={tokenLogoUrl}
            alt=""
            aria-hidden
            className="zd:absolute zd:top-1/2 zd:left-1/2 zd:size-10.5 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:rounded-full zd:object-contain"
          />
        ) : (
          tokenFallback && (
            <span className="zd:absolute zd:inset-0 zd:flex zd:items-center zd:justify-center">
              {tokenFallback}
            </span>
          )
        )}
        {badgeLogoUrl && (
          <img
            src={badgeLogoUrl}
            alt=""
            aria-hidden
            className="zd:absolute zd:right-1.5 zd:bottom-1.5 zd:size-5 zd:rounded-full zd:object-cover"
          />
        )}
      </div>
    </div>
  )
}
