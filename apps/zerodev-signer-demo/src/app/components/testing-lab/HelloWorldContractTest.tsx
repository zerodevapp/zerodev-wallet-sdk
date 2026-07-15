"use client";

import { AlertCircle, MessageSquare, RefreshCw } from "lucide-react";
import { useState } from "react";
import { maxUint256 } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { cn } from "../../lib/utils";
import { TEST_HELLO_WORLD } from "./contracts";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const HW_ADDRESS = TEST_HELLO_WORLD.address;
const HW_CHAIN_ID = TEST_HELLO_WORLD.chainId;
const HW_ABI = TEST_HELLO_WORLD.abi;

// Edge-value presets to stress how the popup renders different uint256
// calldata (small, large, and the uint256 ceiling).
const PRESETS: { label: string; value: string }[] = [
  { label: "0", value: "0" },
  { label: "42", value: "42" },
  { label: "large", value: "123456789012345678901234567890" },
  { label: "max uint256", value: maxUint256.toString() },
];

/**
 * Test Case — the arbitrary (non-token) contract call. Fires
 * `setMessage(uint256)` on the HelloWorld contract, which the Tx review popup
 * renders as a generic call. The button is never gated, so calls can be
 * stacked into the review queue. Reads back the stored value for context.
 */
export function HelloWorldContractTest() {
  const { chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { runs, track, clear } = useTxRuns();
  const [value, setValue] = useState("42");

  const wrongChain = chain?.id !== HW_CHAIN_ID;

  const {
    data: stored,
    refetch,
    isFetching,
  } = useReadContract({
    address: HW_ADDRESS,
    abi: HW_ABI,
    functionName: "readMessage",
    chainId: HW_CHAIN_ID,
    query: { refetchInterval: 15_000 },
  });

  const handleSet = () => {
    track(`setMessage(${value})`, () =>
      writeContractAsync({
        address: HW_ADDRESS,
        abi: HW_ABI,
        functionName: "setMessage",
        args: [BigInt(value || "0")],
      }),
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Arbitrary contract call (HelloWorld)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Calls <code>setMessage(uint256)</code> on{" "}
            <code className="break-all">{HW_ADDRESS}</code> (Arbitrum Sepolia) —
            a non-token write the popup renders as a generic call.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      {wrongChain && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            This contract is on Arbitrum Sepolia. Switch the wallet&apos;s
            network (top of the dashboard) or the call will fail.
          </p>
        </div>
      )}

      {/* Current stored value */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <span className="text-sm text-gray-500">Stored message</span>
        <div className="flex items-center gap-2">
          <span
            className="max-w-[220px] truncate font-mono text-sm font-semibold text-gray-900"
            title={stored?.toString()}
          >
            {stored != null ? stored.toString() : "—"}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-50 cursor-pointer"
            title="Refresh stored value"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          newMessage (uint256)
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          placeholder="0"
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setValue(preset.value)}
              className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSet}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Set message
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
