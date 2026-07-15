"use client";

import { AlertCircle, Check, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useAccount } from "wagmi";

type TxRunStatus = "pending" | "success" | "error";

export interface TxRun {
  id: number;
  label: string;
  status: TxRunStatus;
  hash?: `0x${string}`;
  error?: string;
}

const shortHex = (hex: string) => `${hex.slice(0, 8)}…${hex.slice(-6)}`;

const errorMessage = (err: unknown): string => {
  if (
    err &&
    typeof err === "object" &&
    "shortMessage" in err &&
    typeof (err as { shortMessage: unknown }).shortMessage === "string"
  ) {
    return (err as { shortMessage: string }).shortMessage;
  }
  return err instanceof Error ? err.message : "Transaction failed";
};

/**
 * Shared runner for transaction test cases. `track` fires a run (a promise
 * resolving to a tx hash) and records it in an inline list — WITHOUT gating on
 * a pending state, so requests can be stacked into the Tx review queue.
 * Synchronous throws (e.g. bad address / amount parsing) are caught too.
 */
export function useTxRuns() {
  const [runs, setRuns] = useState<TxRun[]>([]);
  const counter = useRef(0);

  const update = useCallback((id: number, patch: Partial<TxRun>) => {
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );
  }, []);

  const track = useCallback(
    (label: string, run: () => Promise<`0x${string}`>) => {
      const id = (counter.current += 1);
      setRuns((prev) => [{ id, label, status: "pending" }, ...prev]);
      console.info(`[tx-test #${id}] firing:`, label);
      Promise.resolve()
        .then(run)
        .then((hash) => {
          console.info(`[tx-test #${id}] SUCCESS hash:`, hash);
          update(id, { status: "success", hash });
        })
        .catch((err) => {
          console.info(`[tx-test #${id}] ERROR:`, err);
          update(id, { status: "error", error: errorMessage(err) });
        });
    },
    [update],
  );

  const clear = useCallback(() => setRuns([]), []);

  return { runs, track, clear };
}

export function TxRunList({ runs }: { runs: TxRun[] }) {
  const { chain } = useAccount();
  const explorerBaseUrl = chain?.blockExplorers?.default?.url;

  if (runs.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2">
      {runs.map((run) => {
        const explorerUrl =
          run.hash && explorerBaseUrl
            ? `${explorerBaseUrl}/tx/${run.hash}`
            : undefined;
        return (
          <li
            key={run.id}
            className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <span className="shrink-0">
              {run.status === "pending" && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
              {run.status === "success" && (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
              {run.status === "error" && (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </span>
            <span className="shrink-0 text-sm font-medium text-gray-900">
              #{run.id}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-sm text-gray-500"
              title={run.status === "error" ? run.error : run.label}
            >
              {run.status === "error" ? run.error : run.label}
            </span>
            {run.hash && (
              <span
                className="shrink-0 font-mono text-[11px] text-gray-400"
                title={run.hash}
              >
                {shortHex(run.hash)}
              </span>
            )}
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                title="View on explorer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Small clear button shared by the transaction test cards. */
export function ClearRunsButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
    >
      Clear
    </button>
  );
}
