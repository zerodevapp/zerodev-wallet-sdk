"use client";

import type { Quote, Vault } from "@zerodev/earn";
import { ArrowRight, ChevronRight, Copy, ExternalLink, Loader2, TrendingUp } from "lucide-react";
import { type ReactNode, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { cn } from "../../lib/utils";
import { chipClass, ErrorBox, inputClass, primaryButtonClass, smallButtonClass } from "./ui";
import type { EarnState } from "./useEarnState";
import { chainName, EARN_CHAIN_IDS, explorerAddress, sraDashboard } from "./utils/chains";
import { fmtPct, formatTokenAmount, relativeExpiry, truncateMiddle } from "./utils/format";

const SLIPPAGE_PRESETS_BPS = [50, 100, 500, 1000];

/** Step 2, deposit side: amount + route, Get Quote, then the quote. */
export function QuotePanel({ d }: { d: EarnState }) {
  const vault = d.selected as Vault;
  const { data: bal } = useReadContract({
    address: d.srcToken ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: d.owner ? [d.owner] : undefined,
    chainId: d.srcChainId,
    query: { enabled: !!d.owner && !!d.srcToken },
  });
  const balDecimals = d.srcDecimals;
  const quoteBlockedReason = !d.owner
    ? "Please authenticate first"
    : !d.srcToken
      ? "No funding token for this vault on the selected chain"
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="earn-amount" className="text-sm font-medium text-gray-700">
            Deposit from
          </label>
          <select
            value={d.srcChainId}
            onChange={(e) => d.setSrcChainId(Number(e.target.value))}
            className={cn(inputClass, "w-auto py-1.5 pl-3 pr-8 text-xs font-semibold")}
          >
            {EARN_CHAIN_IDS.map((id) => (
              <option key={id} value={id}>
                {chainName(id)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input
            id="earn-amount"
            type="text"
            inputMode="decimal"
            value={d.amountStr}
            onChange={(e) => d.setAmountStr(e.target.value)}
            placeholder="0"
            className={cn(inputClass, "font-mono text-2xl font-medium py-2")}
          />
          <select
            value={d.srcToken ?? ""}
            onChange={(e) => d.setSrcToken(e.target.value as `0x${string}`)}
            disabled={d.tokenOptions.length === 0}
            className={cn(inputClass, "w-auto shrink-0 py-2 pl-3 pr-8 font-semibold")}
          >
            {d.tokenOptions.length === 0 && <option value="">No token</option>}
            {d.tokenOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {bal != null && balDecimals != null && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              title="Use full balance"
              onClick={() => d.setAmountStr(formatUnits(bal, balDecimals))}
              className={cn(chipClass, "cursor-pointer hover:bg-gray-100")}
            >
              Available: {formatTokenAmount(bal, balDecimals, d.srcSymbol)}
            </button>
          </div>
        )}
      </div>

      {/* Route is server-chosen; slippage is the only control. */}
      <div className="space-y-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-gray-500">Route</span>
          <span className="flex items-center gap-1.5 text-sm text-gray-900">
            <span className="font-mono">{d.srcSymbol}</span>
            <span className="text-xs text-gray-500">{chainName(d.srcChainId)}</span>
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <span className="font-mono whitespace-nowrap">{vault.asset.symbol} vault</span>
            <span className="text-xs text-gray-500">{chainName(vault.chainId)}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-gray-500">Max slippage</span>
          <div className="flex items-center gap-1">
            {SLIPPAGE_PRESETS_BPS.map((bps) => (
              <button
                key={bps}
                type="button"
                aria-pressed={bps === d.slippageBps}
                onClick={() => d.setSlippageBps(bps)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer",
                  bps === d.slippageBps
                    ? "border-gray-950 bg-gray-950 text-white"
                    : "border-gray-200 text-gray-500 hover:text-gray-900",
                )}
              >
                {fmtPct(bps)}
              </button>
            ))}
          </div>
        </div>
        <a
          href={explorerAddress(vault.chainId, vault.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700"
        >
          View vault on explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <button type="button" onClick={d.getQuote} disabled={!d.canQuote} className={primaryButtonClass}>
        {d.quoteLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Quoting...
          </>
        ) : (
          <>
            <TrendingUp className="h-4 w-4" />
            Get Quote
          </>
        )}
      </button>
      {quoteBlockedReason && <p className="-mt-2 text-xs text-gray-500">{quoteBlockedReason}</p>}

      {d.quoteError && <ErrorBox title="Quote Failed">{d.quoteError}</ErrorBox>}

      {d.ownerMismatch && (
        <ErrorBox title="Wallet changed">
          This quote targets a different signer. Re-quote before executing.
        </ErrorBox>
      )}

      {d.quote && (
        <>
          <QuoteCard quote={d.quote} vault={vault} d={d} />
          {d.quoteValid && (
            <div className="flex justify-end">
              <button type="button" onClick={() => d.goStep(3)} className={smallButtonClass}>
                Continue to Execute
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-mono text-gray-900">{children}</span>
    </div>
  );
}

function stringifyQuote(q: unknown): string {
  return JSON.stringify(q, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
}

/** Quote result: estimated receive, expiry countdown, fee grid, calldata inspectors. */
function QuoteCard({ quote, vault, d }: { quote: Quote; vault: Vault; d: EarnState }) {
  const [copiedSra, setCopiedSra] = useState(false);
  const target = new Date(quote.expiresAt).getTime();
  const { text, expired } = relativeExpiry(target, d.now);
  const urgent = target - d.now < 30_000;

  // Fees come as base units of each chain's fee token, never USD. Resolve each
  // through the token registry; when they all land on one symbol, sum them.
  // Anything unresolved or mixed renders per chain instead of a wrong total.
  const feeRows = quote.estimatedFees.perChain
    .filter((p) => p.feeAmount !== "0")
    .map((p) => {
      const info = p.feeToken
        ? (d.tokensByChain[p.chainId] ?? []).find(
            (t) => t.address.toLowerCase() === p.feeToken?.toLowerCase(),
          )
        : undefined;
      return { ...p, info: info ? { symbol: info.tokenType, decimals: info.decimals } : undefined };
    });
  const firstInfo = feeRows[0]?.info;
  const singleDenom =
    firstInfo != null &&
    feeRows.every(
      (r) =>
        r.feeAmount != null &&
        r.info?.symbol === firstInfo.symbol &&
        r.info?.decimals === firstInfo.decimals,
    );
  const feeTotal = feeRows.reduce((acc, r) => acc + BigInt(r.feeAmount ?? 0), BigInt(0));

  const copySra = async () => {
    if (!quote.sra) return;
    await navigator.clipboard.writeText(quote.sra);
    setCopiedSra(true);
    setTimeout(() => setCopiedSra(false), 2000);
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-gray-500">Estimated receive</p>
        <p className="mt-1 font-mono text-2xl font-bold text-gray-950">
          {formatTokenAmount(quote.estimatedReceiveAmount, vault.asset.decimals)}{" "}
          <span className="text-sm font-medium text-gray-500">{vault.asset.symbol}</span>
        </p>
        <p className={cn("mt-1", expired || urgent ? "font-semibold text-red-600" : "text-gray-500")}>
          {expired ? "Quote expired, get a fresh one" : `Expires in ${text}`}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-3 py-1">
        {feeRows.length === 0 ? (
          <Row label="Est. fee">0</Row>
        ) : singleDenom ? (
          <Row label="Est. fee">{formatTokenAmount(feeTotal.toString(), firstInfo.decimals, firstInfo.symbol)}</Row>
        ) : (
          feeRows.map((r) => (
            <Row key={r.chainId} label={`Est. fee (${chainName(r.chainId)})`}>
              {r.feeAmount == null
                ? "mixed denominations"
                : r.info
                  ? formatTokenAmount(r.feeAmount, r.info.decimals, r.info.symbol)
                  : r.feeToken
                    ? `${r.feeAmount} base units of ${truncateMiddle(r.feeToken, 6, 4)}`
                    : `${r.feeAmount} base units`}
            </Row>
          ))
        )}
        <Row label="Max slippage">{fmtPct(d.slippageBps)}</Row>
        <Row label="Calls">{quote.transaction.calls.length}</Row>
        {quote.sra && (
          <Row label="SRA">
            <span className="inline-flex items-center gap-1.5">
              <a
                className="text-blue-500 hover:text-blue-700"
                href={sraDashboard(quote.sra)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {truncateMiddle(quote.sra, 8, 6)}
              </a>
              <button
                type="button"
                onClick={copySra}
                title="Copy SRA address"
                className="text-gray-400 hover:text-gray-900 cursor-pointer"
              >
                {copiedSra ? <span className="text-[10px] font-semibold text-green-600">Copied</span> : <Copy className="h-3 w-3" />}
              </button>
            </span>
          </Row>
        )}
      </div>

      <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <summary className="cursor-pointer font-semibold text-gray-700">
          Calldata ({quote.transaction.calls.length})
        </summary>
        <div className="mt-2 space-y-1.5">
          {quote.transaction.calls.map((call, i) => (
            <div key={`${call.to}-${call.data.slice(0, 10)}`} className="rounded-md border border-gray-200 bg-white p-2 font-mono">
              <div className="mb-1 text-gray-500">
                #{i + 1} · value: {call.value}
              </div>
              <div className="break-all">
                <span className="text-gray-500">to:</span> {call.to}
              </div>
              <div className="break-all">
                <span className="text-gray-500">data:</span> {call.data}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <summary className="cursor-pointer font-semibold text-gray-700">Raw quote JSON</summary>
        <pre className="mt-2 overflow-auto font-mono text-gray-900">{stringifyQuote(quote)}</pre>
      </details>
    </div>
  );
}
