import { formatUnits } from "viem";

/** Base units to a human amount with trailing zeros trimmed: `("8744920", 6, "USDC")` → `8.74492 USDC`. */
export function formatTokenAmount(
  raw: string | bigint | null | undefined,
  decimals: number,
  symbol?: string,
): string {
  if (raw == null) return "—";
  let human: string;
  try {
    human = formatUnits(BigInt(raw), decimals);
  } catch {
    human = String(raw);
  }
  if (human.includes(".")) human = human.replace(/\.?0+$/, "");
  return symbol ? `${human} ${symbol}` : human;
}

/** Countdown to a target epoch (ms): `{ text: "1m 30s", expired: false }`. */
export function relativeExpiry(targetMs: number, nowMs: number): { text: string; expired: boolean } {
  const diff = targetMs - nowMs;
  if (diff <= 0) return { text: "expired", expired: true };
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { text: m > 0 ? `${m}m ${s}s` : `${s}s`, expired: false };
}

export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function fmtApy(apy: number | null): string {
  return apy == null ? "—" : `${apy.toFixed(2)}%`;
}

export function fmtTvl(tvl: number | null): string {
  if (tvl == null) return "—";
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`;
  return `$${Math.round(tvl)}`;
}

export function fmtPct(bps: number): string {
  return `${bps % 100 === 0 ? bps / 100 : (bps / 100).toFixed(1)}%`;
}
