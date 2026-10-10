"use client";

import type { Vault } from "@zerodev/earn";
import { Check, ExternalLink, Loader2, Send } from "lucide-react";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { cn } from "../../lib/utils";
import { ErrorBox, linkChipClass, primaryButtonClass } from "./ui";
import { useDepositExecution } from "./useDepositExecution";
import type { EarnState } from "./useEarnState";
import type { SendCalls } from "./useWalletSendCalls";
import { explorerTx, sraDashboard } from "./utils/chains";
import { formatTokenAmount } from "./utils/format";
import type { ExecPhase } from "./utils/historyStore";

/** Step 3: send the quote and track the deposit until the relayer settles it. */
export function ExecutePanel({ d, sendCalls }: { d: EarnState; sendCalls: SendCalls }) {
  const vault = d.selected as Vault;
  // Keyed so a different vault starts a fresh run.
  return <ExecuteInner key={vault.id} vault={vault} d={d} sendCalls={sendCalls} />;
}

function ExecuteInner({ vault, d, sendCalls }: { vault: Vault; d: EarnState; sendCalls: SendCalls }) {
  const exec = useDepositExecution({
    owner: d.owner,
    sendCalls,
    quote: d.quote,
    vault,
    meta: { amount: d.amountStr, srcSymbol: d.srcSymbol },
    ownerMismatch: d.ownerMismatch,
  });

  const srcChainId = d.quote?.transaction.chainId ?? d.srcChainId;
  const inFlight = exec.status === "signing" || exec.status === "bridging";
  const canExecute = d.quoteValid && !!d.owner && !exec.isExecuting && !inFlight;
  const sameChain = d.quote?.route?.sameChain ?? false;
  const deposited = exec.status === "deposited";

  // Vault share balance, read from the chain once the deposit lands.
  const { data: shares } = useReadContract({
    address: vault.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: d.owner ? [d.owner] : undefined,
    chainId: vault.chainId,
    query: { enabled: deposited && !!d.owner },
  });
  const balance = shares != null ? formatTokenAmount(shares, vault.asset.decimals, vault.asset.symbol) : null;

  return (
    <div className="space-y-4">
      {d.quote && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <ExecProgress status={exec.status} sameChain={sameChain} />
        </div>
      )}

      <button type="button" onClick={exec.execute} disabled={!canExecute} className={primaryButtonClass}>
        {inFlight ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {exec.status === "signing" ? "Signing..." : sameChain ? "Executing..." : "Bridging..."}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {deposited ? "Execute again" : "Execute"}
          </>
        )}
      </button>
      {d.quote && d.quoteExpired && !d.ownerMismatch && (
        <p className="-mt-2 text-xs text-gray-500">
          Quote expired.{" "}
          <button type="button" onClick={() => d.goStep(2)} className="font-medium text-blue-500 hover:text-blue-700 cursor-pointer">
            Get a fresh one
          </button>
        </p>
      )}

      {(exec.txHashes.length > 0 || d.quote?.sra) && (
        <div className="flex flex-wrap items-center gap-2">
          {exec.txHashes.map((h, i) => (
            <a
              key={h}
              className={linkChipClass}
              href={explorerTx(srcChainId, h)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3" />
              tx {exec.txHashes.length > 1 ? `${i + 1}/${exec.txHashes.length}` : ""}
            </a>
          ))}
          {d.quote?.sra && (
            <a
              className={linkChipClass}
              href={sraDashboard(d.quote.sra)}
              target="_blank"
              rel="noopener noreferrer"
              title="View / withdraw funds at the SRA dashboard"
            >
              <ExternalLink className="h-3 w-3" />
              Track SRA deposit
            </a>
          )}
        </div>
      )}

      {d.ownerMismatch && (
        <ErrorBox title="Wallet changed">
          This quote was built for a different wallet.{" "}
          <button type="button" onClick={() => d.goStep(2)} className="font-medium underline cursor-pointer">
            Re-quote for the current account
          </button>
          .
        </ErrorBox>
      )}

      {exec.error && (
        <ErrorBox title="Execution Failed">
          <p className="line-clamp-3" title={exec.error}>
            {exec.error}
          </p>
          {!!d.quote?.sra && (
            <p className="mt-1 text-red-900">
              Funds may have landed in the SRA. Recover them with Withdraw in Deposit history below.
            </p>
          )}
        </ErrorBox>
      )}

      {deposited && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="shrink-0 text-sm font-semibold text-gray-950">
                Deposited into {vault.asset.symbol} · {vault.protocol}
              </p>
              {balance && <span className="font-mono text-xs text-gray-500">Vault balance: {balance}</span>}
            </div>
          </div>
          <span className="text-xs text-gray-500">Saved to Deposit history below.</span>
        </div>
      )}
    </div>
  );
}

/** Sign → Bridge/Execute → Deposited strip. */
function ExecProgress({ status, sameChain }: { status: ExecPhase; sameChain: boolean }) {
  const order: ExecPhase[] = ["signing", "bridging", "deposited"];
  const labels: Record<ExecPhase, string> = {
    idle: "Idle",
    signing: "Sign + send",
    // Same-chain has no bridge leg, but the relayer still executes the deposit.
    bridging: sameChain ? "Executing" : "Bridging",
    deposited: "Deposited",
    error: "Error",
  };
  const activeIdx = order.indexOf(status);
  return (
    <div className="flex items-start">
      {order.map((p, i) => {
        const done = activeIdx > i || status === "deposited";
        const active = activeIdx === i && status !== "deposited";
        const last = i === order.length - 1;
        return (
          <div key={p} className={cn("flex flex-col gap-1.5", !last && "flex-1")}>
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                  done
                    ? "border-gray-950 bg-gray-950 text-white"
                    : active
                      ? "border-gray-950 text-gray-950"
                      : "border-gray-300 text-gray-400",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {!last && <span className={cn("mx-1 h-0.5 flex-1 rounded-full", done ? "bg-gray-950" : "bg-gray-200")} />}
            </div>
            <span
              className={cn(
                "text-[11px] leading-none",
                done || active ? "text-gray-900" : "text-gray-400",
                active && "animate-pulse",
              )}
            >
              {labels[p]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
