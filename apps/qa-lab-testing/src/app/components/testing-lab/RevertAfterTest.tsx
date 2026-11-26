"use client";

import { AlertCircle, XOctagon } from "lucide-react";
import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { cn } from "../../lib/utils";
import {
  addressOn,
  TEST_CONTRACT_CHAIN_NAMES,
  TEST_REVERT_AFTER,
} from "./contracts";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

/**
 * Test Case — a transaction that lands on chain and fails. Calls
 * `revertAfter(deadline)` with the latest block's timestamp: gas estimation
 * runs against that block and passes, the mined block is later and reverts.
 * In 4337/7702 the user operation is included with `success = false`; in EOA
 * mode the transaction itself reverts.
 */
export function RevertAfterTest() {
  const { chain } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { writeContractAsync } = useWriteContract();
  const { runs, track, clear } = useTxRuns();
  // Extra seconds on the deadline, for a bundler that simulates against the
  // pending block instead of the latest one.
  const [slack, setSlack] = useState("0");

  const address = addressOn(TEST_REVERT_AFTER, chain?.id);

  const handleSend = () => {
    track("revertAfter(latest block)", async () => {
      if (!address || !publicClient) {
        throw new Error(
          `RevertAfter is not deployed on ${chain?.name ?? "this chain"}`,
        );
      }
      const latest = await publicClient.getBlock({ blockTag: "latest" });
      const deadline = latest.timestamp + BigInt(slack || "0");
      return writeContractAsync({
        address,
        abi: TEST_REVERT_AFTER.abi,
        functionName: "revertAfter",
        args: [deadline],
      });
    });
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-revert-after"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Failed transaction (RevertAfter)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Calls <code>revertAfter(deadline)</code> on{" "}
            <code className="break-all" data-testid="revert-after-address">
              {address ?? "—"}
            </code>{" "}
            with the latest block&apos;s timestamp. Estimation passes; the
            mined transaction reverts, so history should show a Failed row.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      {!address && (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5"
          data-testid="revert-after-unsupported-chain"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Not deployed on {chain?.name ?? "this chain"}. Switch the
            wallet&apos;s network to {TEST_CONTRACT_CHAIN_NAMES}.
          </p>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Extra seconds on the deadline
        </label>
        <input
          type="number"
          min={0}
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          data-testid="revert-after-slack"
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900",
          )}
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Leave at 0. Raise it only if sending fails before signing with{" "}
          <code>DeadlinePassed</code> (the bundler simulated a later block).
        </p>
      </div>

      <div aria-hidden className="grow" />
      <button
        onClick={handleSend}
        disabled={!address}
        data-testid="revert-after-submit"
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-gray-950",
          "flex items-center justify-center gap-2",
        )}
      >
        <XOctagon className="h-4 w-4" />
        Send failing transaction
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
