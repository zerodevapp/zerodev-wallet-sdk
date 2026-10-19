"use client";

import { ArrowDownToLine, ChevronRight, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { cn } from "../../lib/utils";
import { linkChipClass, smallButtonClass } from "./ui";
import { useDepositHistory } from "./useDepositHistory";
import { useSraRecovery } from "./useSraRecovery";
import type { SendCalls } from "./useWalletSendCalls";
import { chainName, explorerTx, sraDashboard } from "./utils/chains";
import { earn } from "./utils/client";
import { type DepositRecord, type HistoryPhase, patchPhase } from "./utils/historyStore";

// ABANDONED is deliberately absent: no deposit reached the SRA yet, and a late
// one still can, so the row keeps its Refresh button.
const TERMINAL: HistoryPhase[] = ["deposited", "error", "COMPLETED", "FAILED"];

/** Money is somewhere it should not be: a send that threw, or a deposit the server failed. */
function isFailure(phase: HistoryPhase): boolean {
  return phase === "error" || phase === "FAILED";
}

function phaseClass(phase: HistoryPhase): string {
  if (phase === "deposited" || phase === "COMPLETED") return "border-green-100 bg-green-50 text-green-700";
  if (isFailure(phase)) return "border-red-100 bg-red-50 text-red-700";
  if (phase === "idle" || phase === "PENDING" || phase === "ABANDONED") return "border-gray-200 bg-gray-50 text-gray-600";
  return "border-blue-100 bg-blue-50 text-blue-700";
}

/**
 * Persisted deposits, so the SRA a deposit funded survives a reload. Rows can
 * re-query status, recover stranded funds from the SRA, or be removed.
 */
export function HistoryPanel({ owner, sendCalls }: { owner: Address | undefined; sendCalls: SendCalls }) {
  const { records, remove } = useDepositHistory(owner);
  const [open, setOpen] = useState(false);

  // Warn on close/reload while a deposit is in flight (funds may sit in the SRA).
  const hasPending = records.some((r) => !TERMINAL.includes(r.phase));
  useEffect(() => {
    if (!hasPending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPending]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 cursor-pointer"
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        Deposit history
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700">
          {records.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-200 p-3">
          {records.length === 0 ? (
            <p className="text-sm text-gray-500">
              No deposits yet. Executed deposits are saved here so you never lose the SRA your funds routed through.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {records.map((r) => (
                <HistoryRow key={r.quoteId} rec={r} owner={owner} sendCalls={sendCalls} onRemove={remove} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  rec,
  owner,
  sendCalls,
  onRemove,
}: {
  rec: DepositRecord;
  owner: Address | undefined;
  sendCalls: SendCalls;
  onRemove: (quoteId: string) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const sameChain = rec.srcChainId === rec.vault.chainId;
  const terminal = TERMINAL.includes(rec.phase);
  // The row is written before the funding tx is sent, so it can have no hash yet.
  const fundingTx = rec.txHashes[rec.txHashes.length - 1];
  const canRefresh = !terminal && !!owner && !!fundingTx;
  const recovery = useSraRecovery(rec, owner, sendCalls);
  const recovering = recovery.phase === "preparing" || recovery.phase === "withdrawing";

  async function refresh() {
    if (!owner || !fundingTx) return;
    setRefreshing(true);
    try {
      const status = await earn.getStatus(rec.sra, fundingTx);
      patchPhase(rec.quoteId, status.state, Date.now());
    } catch {
      // Transient: leave the phase as is.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{rec.vault.assetSymbol}</span>
          <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold", phaseClass(rec.phase))}>
            {rec.phase}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {canRefresh && (
            <button type="button" onClick={refresh} disabled={refreshing} className={smallButtonClass} title="Re-query deposit status">
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              Refresh
            </button>
          )}
          {owner && (
            <button
              type="button"
              onClick={recovery.withdraw}
              disabled={recovering}
              className={smallButtonClass}
              title="Recover funds stranded in the SRA back to your wallet"
            >
              <ArrowDownToLine className={cn("h-3 w-3", recovering && "animate-pulse")} />
              Withdraw
            </button>
          )}
          {confirmRemove ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="text-gray-600">Discard SRA?</span>
              <button type="button" onClick={() => onRemove(rec.quoteId)} className={cn(smallButtonClass, "border-red-200 text-red-700 hover:bg-red-50")}>
                Remove
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className={smallButtonClass}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              // Removing an unsettled record discards the SRA needed to recover funds.
              onClick={() => (terminal ? onRemove(rec.quoteId) : setConfirmRemove(true))}
              className="p-1.5 text-gray-400 transition-colors hover:text-red-600 cursor-pointer"
              title="Remove from history"
              aria-label="Remove from history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
        <span>
          {rec.vault.protocol} · {chainName(rec.vault.chainId)}
        </span>
        <span aria-hidden>·</span>
        <span className="font-mono text-gray-900">
          {rec.amount} {rec.srcSymbol}
        </span>
        <span aria-hidden>·</span>
        <span>
          {sameChain
            ? `${chainName(rec.srcChainId)} · same-chain`
            : `${chainName(rec.srcChainId)} → ${chainName(rec.vault.chainId)}`}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {rec.txHashes.map((h, i) => (
          <a key={h} className={linkChipClass} href={explorerTx(rec.srcChainId, h)} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" />
            tx {rec.txHashes.length > 1 ? `${i + 1}/${rec.txHashes.length}` : ""}
          </a>
        ))}
        <a
          className={linkChipClass}
          href={sraDashboard(rec.sra)}
          target="_blank"
          rel="noopener noreferrer"
          title="View / withdraw funds at the SRA dashboard"
        >
          <ExternalLink className="h-3 w-3" />
          SRA
        </a>
      </div>

      {confirmRemove && (
        <p className="mt-2 text-xs text-gray-600">
          This deposit has not settled. Removing it discards the SRA needed to recover funds, so withdraw first if funds may be stranded.
        </p>
      )}
      {isFailure(rec.phase) && (
        <p className="mt-2 text-xs text-gray-600">
          Deposit did not settle. Funds may be in the SRA. Use Withdraw to recover them.
        </p>
      )}
      {rec.phase === "ABANDONED" && (
        <p className="mt-2 text-xs text-gray-600">
          No deposit has reached this SRA. If you funded it, use Withdraw to recover the funds.
        </p>
      )}
      {recovery.phase === "preparing" && <p className="mt-2 text-xs text-gray-500">Checking SRA...</p>}
      {recovery.phase === "withdrawing" && <p className="mt-2 text-xs text-gray-500">Confirm in wallet...</p>}
      {recovery.phase === "done" && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-green-700">
          Withdrawn
          {recovery.txHashes.map((h, i) => (
            <a key={h} className={linkChipClass} href={explorerTx(rec.srcChainId, h)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              tx {recovery.txHashes.length > 1 ? `${i + 1}/${recovery.txHashes.length}` : ""}
            </a>
          ))}
        </p>
      )}
      {recovery.phase === "error" && recovery.error && (
        <p className="mt-2 text-xs text-red-600">{recovery.error}</p>
      )}
    </li>
  );
}
