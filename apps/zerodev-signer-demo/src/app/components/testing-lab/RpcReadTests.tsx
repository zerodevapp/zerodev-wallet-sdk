"use client";

import { AlertCircle, Check, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { formatGwei } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { cn } from "../../lib/utils";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type Source = "wallet" | "rpc";
type RunState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; source: Source; text: string; raw: string }
  | { status: "error"; text: string; raw: string };

const rawStringify = (value: unknown): string => {
  try {
    return JSON.stringify(
      value,
      (_key, val) => (typeof val === "bigint" ? val.toString() : val),
      2,
    );
  } catch {
    return String(value);
  }
};

interface RpcCall {
  key: string;
  method: string;
  params?: unknown[];
  description: string;
  format: (result: unknown) => string;
}

const hexToDec = (v: unknown) =>
  typeof v === "string" ? `${v} (${BigInt(v).toString()})` : String(v);

const CALLS: RpcCall[] = [
  {
    key: "eth_accounts",
    method: "eth_accounts",
    description: "Addresses the wallet exposes",
    format: (r) =>
      Array.isArray(r) && r.length ? (r as string[]).join(", ") : "(none)",
  },
  {
    key: "eth_requestAccounts",
    method: "eth_requestAccounts",
    description: "Request the wallet's accounts",
    format: (r) =>
      Array.isArray(r) && r.length ? (r as string[]).join(", ") : "(none)",
  },
  {
    key: "eth_chainId",
    method: "eth_chainId",
    description: "Active chain id",
    format: hexToDec,
  },
  {
    key: "eth_blockNumber",
    method: "eth_blockNumber",
    description: "Latest block number",
    format: hexToDec,
  },
  {
    key: "eth_gasPrice",
    method: "eth_gasPrice",
    description: "Current gas price",
    format: (r) =>
      typeof r === "string" ? `${formatGwei(BigInt(r))} gwei` : String(r),
  },
];

const isNotSupported = (err: unknown): boolean => {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  return /not supported|method not found|unsupported/i.test(msg);
};

/**
 * Read-only RPC test cases. Each call goes through the wallet's EIP-1193
 * provider first; if the SDK provider reports the method is unsupported, it
 * falls back to the viem public client (wagmi's configured / default RPC). The
 * result shows which source answered.
 */
export function RpcReadTests() {
  const { connector } = useAccount();
  const publicClient = usePublicClient();
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  const setRun = (key: string, state: RunState) =>
    setRuns((prev) => ({ ...prev, [key]: state }));

  const runCall = async (call: RpcCall) => {
    setRun(call.key, { status: "pending" });
    try {
      // Wallet provider first.
      const provider = (await connector?.getProvider()) as Eip1193 | undefined;
      if (provider) {
        try {
          const result = await provider.request({
            method: call.method,
            params: call.params,
          });
          setRun(call.key, {
            status: "done",
            source: "wallet",
            text: call.format(result),
            raw: rawStringify(result),
          });
          return;
        } catch (err) {
          if (!isNotSupported(err)) throw err;
          // fall through to the public client
        }
      }

      if (!publicClient) throw new Error("No RPC client available");
      const rpc = publicClient as unknown as Eip1193;
      const result = await rpc.request({
        method: call.method,
        params: call.params,
      });
      setRun(call.key, {
        status: "done",
        source: "rpc",
        text: call.format(result),
        raw: rawStringify(result),
      });
    } catch (err) {
      setRun(call.key, {
        status: "error",
        text: err instanceof Error ? err.message : "Call failed",
        raw: rawStringify(
          err instanceof Error ? { name: err.name, message: err.message } : err,
        ),
      });
    }
  };

  const runAll = () => CALLS.forEach((call) => void runCall(call));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Read RPC calls
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Fires read-only JSON-RPC methods through the wallet provider, with a
            public-RPC fallback when the wallet doesn&apos;t support the method.
          </p>
        </div>
        <button
          onClick={runAll}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-950 bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" />
          Run all
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {CALLS.map((call) => {
          const run = runs[call.key] ?? { status: "idle" };
          return (
            <li
              key={call.key}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-gray-900">
                    {call.method}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {call.description}
                  </p>
                </div>
                <button
                  onClick={() => runCall(call)}
                  disabled={run.status === "pending"}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                >
                  {run.status === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Call"
                  )}
                </button>
              </div>

              {(run.status === "done" || run.status === "error") && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="flex items-start gap-2">
                    {run.status === "done" ? (
                      <>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-700">
                          {run.text}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            run.source === "wallet"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-100 text-amber-800",
                          )}
                          title={
                            run.source === "wallet"
                              ? "Answered by the wallet provider"
                              : "Wallet provider did not support this method — answered by the public RPC fallback"
                          }
                        >
                          {run.source === "wallet" ? "wallet provider" : "RPC fallback"}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span className="min-w-0 flex-1 break-words text-xs text-red-700">
                          {run.text}
                        </span>
                      </>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-gray-400 hover:text-gray-600">
                      raw response
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-100 p-2 font-mono text-[11px] text-gray-700">
                      {run.raw}
                    </pre>
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
