import { cn, Icon, Text, Tooltip } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
import { PROVIDER_ICONS } from '../../iconAssets'
import type { FeeBreakdown, FeeLine } from '../../utils/providerFees'
import { formatFeePct, formatFeeUsd } from '../../utils/providerFees'
import { FEE_INFO } from './feeInfo'

/** Home pages for supported providers, so the name links out */
const PROVIDER_URLS: Record<string, string> = {
  Across: 'https://across.to',
  Relay: 'https://relay.link',
}

export type LiveValueProps = {
  /** While true, the value is being re-quoted: show a spinner */
  loading: boolean
  /** Changes with the value so the flash-in animation re-triggers */
  flashKey: string | number
  children: ReactNode
}

/**
 * A value that swaps to a spinner while its route is re-quoting, then flashes
 * the fresh value in. Used so a route change visibly recalculates the min
 * deposit / estimated fee rather than silently snapping to new numbers.
 */
export function LiveValue({ loading, flashKey, children }: LiveValueProps) {
  if (loading) {
    return (
      <span
        className="zd:inline-flex zd:items-center zd:justify-center zd:text-orange"
        role="img"
        aria-label="Updating estimate"
      >
        <Icon
          name="loading"
          className="zd:w-3.5 zd:h-3.5 zd:animate-spin zd:text-orange"
          aria-hidden
        />
      </span>
    )
  }
  return (
    <span
      key={flashKey}
      className="zd:inline-flex zd:items-center zd:gap-1.5 zd:animate-fee-flash"
    >
      {children}
    </span>
  )
}

/** Combined fee value: proportional rate (emphasised) + fixed USD cost */
export function FeeSummary({ breakdown }: { breakdown: FeeBreakdown }) {
  // When the SRA fee can't be priced in USD (non-stable token), show it as a
  // token amount — the partial USD bridge legs must not headline as the total.
  if (breakdown.totalText) {
    return (
      <Text className="zd:whitespace-nowrap zd:font-medium">
        {breakdown.totalText}
      </Text>
    )
  }
  const pct =
    breakdown.ratePct !== null && breakdown.ratePct > 0
      ? formatFeePct(breakdown.ratePct)
      : null
  const usd =
    breakdown.flatUsd !== null ? formatFeeUsd(breakdown.flatUsd) : null
  if (!pct && !usd) {
    return <Text className="zd:whitespace-nowrap">—</Text>
  }
  return (
    <span className="zd:inline-flex zd:items-center zd:gap-1 zd:leading-none">
      {pct && (
        <b className="zd:text-body2 zd:font-bold zd:text-greyScale zd:leading-none">
          {pct}
        </b>
      )}
      {pct && usd && (
        <span className="zd:text-body2 zd:text-greyScale/50 zd:leading-none">
          +
        </span>
      )}
      {usd && (
        <span className="zd:text-body2 zd:font-medium zd:text-greyScale/70 zd:leading-none">
          {usd}
        </span>
      )}
    </span>
  )
}

/** Provider name + brand icon, linked to the provider's site when known */
export function ProviderValue({ provider }: { provider: string }) {
  const url = PROVIDER_URLS[provider]
  const iconUrl = PROVIDER_ICONS[provider]
  const inner = (
    <>
      <Text className="zd:whitespace-nowrap zd:font-medium">{provider}</Text>
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          className="zd:size-3.5 zd:shrink-0 zd:rounded-[4px] zd:object-cover"
        />
      )}
    </>
  )
  if (!url) {
    return (
      <span className="zd:inline-flex zd:items-center zd:gap-1">{inner}</span>
    )
  }
  return (
    <a
      className="zd:inline-flex zd:items-center zd:gap-1 zd:text-greyScale zd:hover:underline"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {inner}
    </a>
  )
}

function InfoMark({ info }: { info: string }) {
  // Real DOM element so Radix's `Tooltip` (via `asChild`) can attach hover /
  // focus handlers and wire `aria-describedby` to its content. Focusable so
  // keyboard users can trigger the tooltip.
  return (
    <Tooltip content={info}>
      {/* button (not span+tabIndex): natively focusable, so keyboard users
          can trigger the tooltip; Radix wires aria-describedby to the
          tooltip copy on hover / focus. `type="button"` keeps it inert
          inside forms. */}
      <button
        type="button"
        aria-label="More info"
        className="zd:inline-flex zd:items-center zd:justify-center zd:cursor-help zd:outline-none zd:bg-transparent"
      >
        <Icon
          name="info"
          className="zd:w-3 zd:h-3 zd:text-greyScale/50"
          aria-hidden
        />
      </button>
    </Tooltip>
  )
}

function LineValue({ line }: { line: FeeLine }) {
  if (line.sponsored) {
    return (
      <Text className="zd:whitespace-nowrap zd:font-medium">Sponsored</Text>
    )
  }
  // Rates are amount-invariant → show percent; flat costs → show USD; fall
  // back to a raw token amount when neither is available.
  const value =
    line.kind === 'rate' && line.pct !== null
      ? formatFeePct(line.pct)
      : line.usd !== null
        ? formatFeeUsd(line.usd)
        : line.pct !== null
          ? formatFeePct(line.pct)
          : (line.text ?? '—')
  return <Text className="zd:whitespace-nowrap zd:font-medium">{value}</Text>
}

function BreakdownRow({
  label,
  info,
  children,
  className,
}: {
  label: string
  info?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'zd:flex zd:w-full zd:items-center zd:gap-1 zd:py-1',
        className,
      )}
    >
      <Text className="zd:whitespace-nowrap zd:text-greyScale/60">{label}</Text>
      {info && <InfoMark info={info} />}
      <div className="zd:min-w-0 zd:flex-1" />
      {children}
    </div>
  )
}

/** Itemised fee rows: provider + each fee leg */
export function FeeBreakdownRows({ breakdown }: { breakdown: FeeBreakdown }) {
  return (
    <div className="zd:flex zd:w-full zd:flex-col zd:pl-2">
      {breakdown.provider && (
        <BreakdownRow label="Provider" info={FEE_INFO.provider}>
          <ProviderValue provider={breakdown.provider} />
        </BreakdownRow>
      )}
      {breakdown.lines.map((line) => (
        <BreakdownRow
          key={line.key}
          label={line.label}
          info={FEE_INFO[line.key as keyof typeof FEE_INFO]}
        >
          <LineValue line={line} />
        </BreakdownRow>
      ))}
    </div>
  )
}

/**
 * The clickable fee value: wraps the summary (children) and the disclosure
 * chevron in one button so the whole value toggles the breakdown, not just
 * the arrow. The aria-label deliberately names the ACTION (it also keeps
 * the e2e "Show fee details" role queries stable); the value itself remains
 * visible beside it.
 */
export function FeeDisclosureButton({
  open,
  onToggle,
  panelId,
  children,
}: {
  open: boolean
  onToggle: () => void
  /** id of the panel this button controls, when the panel carries one. */
  panelId?: string | undefined
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      {...(panelId && { 'aria-controls': panelId })}
      aria-label={open ? 'Hide fee details' : 'Show fee details'}
      className="zd:flex zd:cursor-pointer zd:items-center zd:gap-[5px]"
    >
      {children}
      <Icon
        name={open ? 'chevronUp' : 'chevronDown'}
        className="zd:w-3.5 zd:h-3.5 zd:shrink-0 zd:text-greyScale"
        aria-hidden
      />
    </button>
  )
}
