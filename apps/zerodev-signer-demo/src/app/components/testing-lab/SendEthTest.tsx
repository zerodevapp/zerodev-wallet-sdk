"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { type Address, parseEther } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import { cn } from "../../lib/utils";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const shortAddress = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

/**
 * Test Case — a plain `sendTransaction` of ETH to a valid recipient. Defaults
 * to a tiny self-send. The button is never gated, so sends can be stacked into
 * the Tx review queue.
 */
export function SendEthTest() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { runs, track, clear } = useTxRuns();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0.0001");

  const handleSend = () => {
    const target = (to.trim() || address || "") as Address;
    track(`Send ${amount || "0"} ETH → ${shortAddress(target)}`, () =>
      sendTransactionAsync({ to: target, value: parseEther(amount || "0") }),
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Send ETH
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            A plain <code>sendTransaction</code> transferring ETH. Leave the
            recipient blank to send to yourself.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Recipient
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={address ?? "0x…"}
            spellCheck={false}
            className={cn(
              "w-full rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "text-gray-900 placeholder:text-gray-400",
            )}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Amount (ETH)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0001"
            className={cn(
              "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "text-gray-900 placeholder:text-gray-400",
            )}
          />
        </div>
      </div>

      <button
        onClick={handleSend}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <Send className="h-4 w-4" />
        Send ETH
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
