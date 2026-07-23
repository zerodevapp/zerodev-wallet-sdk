import { cn, Icon, Text } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
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

/** Provider name, linked to the provider's site when known */
export function ProviderValue({ provider }: { provider: string }) {
  const url = PROVIDER_URLS[provider]
  const label = (
    <Text className="zd:whitespace-nowrap zd:font-medium">{provider}</Text>
  )
  if (!url) return label
  return (
    <a
      className="zd:inline-flex zd:items-center zd:gap-1 zd:text-greyScale zd:hover:underline"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  )
}

function InfoMark({ info }: { info?: string }) {
  return (
    <Icon
      name="info"
      className="zd:w-3 zd:h-3 zd:text-greyScale/50"
      role="img"
      aria-label={info}
      {...(info && { title: info })}
    />
  )
}

function LineValue({ line }: { line: FeeLine }) {
  if (line.sponsored) {
    return (
      <Text className="zd:whitespace-nowrap zd:font-medium zd:text-positive">
        Sponsored
      </Text>
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
