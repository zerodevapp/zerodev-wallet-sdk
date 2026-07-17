"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "../../lib/utils";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type RunState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; text: string; raw: string }
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

// Celo mainnet (chain id 42220 = 0xa4ec) — example chain to add/switch to.
const CELO = {
  chainId: "0xa4ec",
  chainName: "Celo",
  nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
  rpcUrls: ["https://forno.celo.org"],
  blockExplorerUrls: ["https://celoscan.io"],
};

// Arbitrum Sepolia (421614 = 0x66eee) — to switch back after testing.
const ARBITRUM_SEPOLIA_HEX = "0x66eee";

interface ChainAction {
  key: string;
  label: string;
  method: string;
  params: unknown[];
  description: string;
}

const ACTIONS: ChainAction[] = [
  {
    key: "add-celo",
    label: "Add Celo chain",
    method: "wallet_addEthereumChain",
    params: [CELO],
    description: "wallet_addEthereumChain",
  },
  {
    key: "switch-celo",
    label: "Switch to Celo",
    method: "wallet_switchEthereumChain",
    params: [{ chainId: CELO.chainId }],
    description: "wallet_switchEthereumChain",
  },
  {
    key: "switch-back",
    label: "Switch to Arbitrum Sepolia",
    method: "wallet_switchEthereumChain",
    params: [{ chainId: ARBITRUM_SEPOLIA_HEX }],
    description: "wallet_switchEthereumChain",
  },
];

/**
 * Test Case — chain-management wallet methods. Fires
 * `wallet_addEthereumChain` / `wallet_switchEthereumChain` through the wallet
 * provider, using Celo as the example chain. The SDK provider currently
 * supports switching but not adding, so "Add Celo chain" is expected to error.
 */
export function ChainMethodsTest() {
  const { connector, chain, chainId } = useAccount();
  const [runs, setRuns] = useState<Record<string, RunState>>({});

  const setRun = (key: string, state: RunState) =>
    setRuns((prev) => ({ ...prev, [key]: state }));

  const runAction = async (action: ChainAction) => {
    setRun(action.key, { status: "pending" });
    try {
      const provider = (await connector?.getProvider()) as Eip1193 | undefined;
      if (!provider) throw new Error("No wallet provider");
      const result = await provider.request({
        method: action.method,
        params: action.params,
      });
      setRun(action.key, {
        status: "done",
        text: result == null ? "ok" : JSON.stringify(result),
        raw: rawStringify(result),
      });
    } catch (err) {
      setRun(action.key, {
        status: "error",
        text: err instanceof Error ? err.message : "Call failed",
        raw: rawStringify(
          err instanceof Error ? { name: err.name, message: err.message } : err,
        ),
      });
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900">
        Switch / add chain
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Fires <code>wallet_addEthereumChain</code> /{" "}
        <code>wallet_switchEthereumChain</code> through the wallet provider,
        with Celo as the example chain.
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span className="text-sm text-gray-500">Active chain</span>
        <span className="text-sm font-semibold text-gray-900">
          {chain?.name ?? "unsupported"}
          <span className="ml-1 font-normal text-gray-500">
            ({chainId ?? "—"})
          </span>
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {ACTIONS.map((action) => {
          const run = runs[action.key] ?? { status: "idle" };
          return (
            <li
              key={action.key}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {action.label}
                  </p>
                  <p className="truncate font-mono text-[11px] text-gray-400">
                    {action.description}
                  </p>
                </div>
                <button
                  onClick={() => runAction(action)}
                  disabled={run.status === "pending"}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                >
                  {run.status === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Run"
                  )}
                </button>
              </div>

              {(run.status === "done" || run.status === "error") && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="flex items-start gap-2">
                    {run.status === "done" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words font-mono text-xs",
                        run.status === "done" ? "text-gray-700" : "text-red-700",
                      )}
                    >
                      {run.text}
                    </span>
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
