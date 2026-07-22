"use client";

import { AlertCircle, Check, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { cn } from "../../lib/utils";
import { TEST_ERC20 } from "./contracts";

type Eip1193 = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
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

/**
 * Test Case — `wallet_watchAsset` (EIP-747) for the registered test ERC20.
 * Fires through the wallet provider; the SDK provider doesn't implement this
 * method yet, so it's expected to return "Method not supported".
 */
export function WatchAssetTest() {
  const { connector } = useAccount();
  const [run, setRun] = useState<RunState>({ status: "idle" });

  const { data } = useReadContracts({
    contracts: [
      {
        address: TEST_ERC20.address,
        abi: erc20Abi,
        functionName: "symbol",
        chainId: TEST_ERC20.chainId,
      },
      {
        address: TEST_ERC20.address,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: TEST_ERC20.chainId,
      },
    ],
  });

  const symbol = (data?.[0]?.result as string | undefined) ?? "";
  const decimals = (data?.[1]?.result as number | undefined) ?? 18;

  const params = {
    type: "ERC20",
    options: {
      address: TEST_ERC20.address,
      symbol,
      decimals,
    },
  };

  const handleWatch = async () => {
    setRun({ status: "pending" });
    try {
      const provider = (await connector?.getProvider()) as Eip1193 | undefined;
      if (!provider) throw new Error("No wallet provider");
      const result = await provider.request({
        method: "wallet_watchAsset",
        params,
      });
      setRun({
        status: "done",
        text: result === true ? "added (true)" : String(result),
        raw: rawStringify(result),
      });
    } catch (err) {
      setRun({
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
      <h3 className="text-base font-semibold text-gray-900">Watch asset</h3>
      <p className="mt-1 text-sm text-gray-500">
        Fires <code>wallet_watchAsset</code> (EIP-747) for the registered test
        ERC20 through the wallet provider.
      </p>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-[11px] text-gray-600">
        <div className="truncate" title={TEST_ERC20.address}>
          address: {TEST_ERC20.address}
        </div>
        <div>
          symbol: {symbol || "…"} · decimals: {decimals}
        </div>
      </div>

      <button
        onClick={handleWatch}
        disabled={run.status === "pending"}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2 disabled:opacity-50",
        )}
      >
        {run.status === "pending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        Watch asset
      </button>

      {(run.status === "done" || run.status === "error") && (
        <div className="mt-3 border-t border-gray-200 pt-2">
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
    </div>
  );
}
