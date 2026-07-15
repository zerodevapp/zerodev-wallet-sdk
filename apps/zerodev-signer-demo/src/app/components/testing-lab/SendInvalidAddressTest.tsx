"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { type Address, parseEther } from "viem";
import { useSendTransaction } from "wagmi";
import { cn } from "../../lib/utils";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const DEFAULT_INVALID = "0x1234";

/**
 * Test Case — a `sendTransaction` whose `to` is a malformed address, to verify
 * the invalid-address error is surfaced (viem rejects before submission).
 */
export function SendInvalidAddressTest() {
  const { sendTransactionAsync } = useSendTransaction();
  const { runs, track, clear } = useTxRuns();
  const [to, setTo] = useState(DEFAULT_INVALID);

  const handleSend = () => {
    track(`Send to invalid address "${to}"`, () =>
      sendTransactionAsync({
        to: to as Address,
        value: parseEther("0.0001"),
      }),
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Send to invalid address
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Fires a <code>sendTransaction</code> to a malformed <code>to</code>{" "}
            address to verify validation rejects it cleanly.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Invalid recipient
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          spellCheck={false}
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
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
        Send to invalid address
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
