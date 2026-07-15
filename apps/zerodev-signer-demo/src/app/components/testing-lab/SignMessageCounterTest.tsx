"use client";

import {
  AlertCircle,
  Check,
  FileSignature,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { hashMessage } from "viem";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import { cn } from "../../lib/utils";

type VerifyStatus = "verifying" | "valid" | "invalid";
type RunStatus = "pending" | "success" | "error";

interface TestRun {
  id: number;
  message: string;
  /** EIP-191 hash of the exact message sent — a deterministic fingerprint. */
  expectedHash: string;
  status: RunStatus;
  signature?: string;
  error?: string;
  verify?: VerifyStatus;
}

const shortHex = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`;

/**
 * Test Case #1 — fires an independent `signMessage` on every click with an
 * incrementing message. The button is intentionally never gated on a pending
 * state, so requests can be stacked into the SDK's Tx review queue to
 * stress-test it. Enable the "Tx review" toggle at the top of the dashboard
 * for the review popup to appear.
 *
 * Each fire records the EIP-191 hash of its message, then verifies the
 * returned signature against this account (EOA / ERC-1271 / ERC-6492) FOR THAT
 * message — so accepting/rejecting requests out of order can be confirmed to
 * return the right hash with nothing lost in between.
 */
export function SignMessageCounterTest() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const [counter, setCounter] = useState(0);
  const [runs, setRuns] = useState<TestRun[]>([]);

  const updateRun = (id: number, patch: Partial<TestRun>) =>
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );

  const handleSign = () => {
    const id = counter + 1;
    setCounter(id);
    const message = `Stress test message #${id}`;
    const expectedHash = hashMessage(message);
    setRuns((prev) => [
      { id, message, expectedHash, status: "pending" },
      ...prev,
    ]);

    signMessageAsync({ message })
      .then(async (signature) => {
        updateRun(id, { status: "success", signature, verify: "verifying" });
        if (!publicClient || !address) {
          updateRun(id, { verify: undefined });
          return;
        }
        try {
          const valid = await publicClient.verifyMessage({
            address,
            message,
            signature,
          });
          updateRun(id, { verify: valid ? "valid" : "invalid" });
        } catch {
          updateRun(id, { verify: "invalid" });
        }
      })
      .catch((err) =>
        updateRun(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Signing failed",
        }),
      );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sign message (dynamic counter)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Each click fires an independent <code>signMessage</code> with an
            incrementing message. The button is never disabled, so you can stack
            requests into the Tx review queue. Each fire records its EIP-191 hash
            and verifies the returned signature against this account.
          </p>
        </div>
        {runs.length > 0 && (
          <button
            onClick={() => setRuns([])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <button
        onClick={handleSign}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <FileSignature className="h-4 w-4" />
        Sign message #{counter + 1}
      </button>

      {runs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
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
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                  {run.status === "error" ? run.error : run.message}
                </span>
                {run.verify === "valid" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    valid
                  </span>
                )}
                {run.verify === "invalid" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    <ShieldAlert className="h-3 w-3" />
                    invalid
                  </span>
                )}
                {run.verify === "verifying" && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                    verifying…
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-[26px] font-mono text-[11px] text-gray-400">
                <span title={run.expectedHash}>
                  hash {shortHex(run.expectedHash)}
                </span>
                {run.signature && (
                  <span title={run.signature}>
                    sig {shortHex(run.signature)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
