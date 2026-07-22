"use client";

import { Send } from "lucide-react";
import { type Address, parseEther } from "viem";
import { useSendTransaction } from "wagmi";
import { cn } from "../../lib/utils";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const HIGH_AMOUNT = "1000000"; // 1,000,000 ETH — far above any testnet balance.
// Must be a DISTINCT address, not the account itself: a self-send is a
// net-zero transfer that never requires the account to hold the value, so it
// no-ops through simulation instead of failing on insufficient balance.
const RECIPIENT = "0xCF3a5910a38C5A702628B601581E915a8BfF1707" as Address;

/**
 * Test Case — a `sendTransaction` with an intentionally huge ETH value to a
 * burn address, to trigger an insufficient-balance failure and exercise the
 * error path (in the Tx review popup and the SDK).
 */
export function SendHighAmountTest() {
  const { sendTransactionAsync } = useSendTransaction();
  const { runs, track, clear } = useTxRuns();

  const handleSend = () => {
    track(`Send ${HIGH_AMOUNT} ETH → burn (expect insufficient balance)`, () =>
      sendTransactionAsync({
        to: RECIPIENT,
        value: parseEther(HIGH_AMOUNT),
      }),
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Send high amount (insufficient balance)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Fires a <code>sendTransaction</code> for {HIGH_AMOUNT} ETH — far
            above any testnet balance — to verify the insufficient-balance error
            is surfaced.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
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
        Send {Number(HIGH_AMOUNT).toLocaleString()} ETH
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
