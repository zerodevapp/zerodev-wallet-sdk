"use client";

import type { Vault } from "@zerodev/earn";
import { ArrowDownToLine, Check, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { cn } from "../../lib/utils";
import { chipClass, ErrorBox, inputClass, linkChipClass, primaryButtonClass, smallButtonClass } from "./ui";
import type { EarnState } from "./useEarnState";
import { useVaultWithdraw } from "./useVaultWithdraw";
import type { SendCalls } from "./useWalletSendCalls";
import { chainName, explorerTx } from "./utils/chains";
import { formatTokenAmount } from "./utils/format";

/** Step 2, withdraw side: exit the selected vault back to the connected wallet. */
export function WithdrawPanel({ d, sendCalls }: { d: EarnState; sendCalls: SendCalls }) {
  const vault = d.selected as Vault;
  // Keyed so amount and phase reset when the user picks another vault.
  return <WithdrawInner key={vault.id} vault={vault} d={d} sendCalls={sendCalls} />;
}

function WithdrawInner({ vault, d, sendCalls }: { vault: Vault; d: EarnState; sendCalls: SendCalls }) {
  const { available, loadError, phase, error, txHashes, withdraw, reloadAvailable } = useVaultWithdraw(
    vault,
    d.owner,
    sendCalls,
  );
  const [amountStr, setAmountStr] = useState("");

  const { decimals, symbol } = vault.asset;
  const availableHuman = available == null ? null : formatUnits(BigInt(available), decimals);
  const empty = available === "0";
  const busy = phase === "preparing" || phase === "sending";

  // `parseUnits` rounds excess precision silently but the server rejects it.
  const typed = amountStr.trim();
  const tooPrecise = (typed.split(".")[1]?.length ?? 0) > decimals;
  let requested: bigint | null = null;
  try {
    requested = typed === "" || tooPrecise ? null : parseUnits(typed, decimals);
  } catch {
    requested = null;
  }
  const overBalance = requested != null && available != null && requested > BigInt(available);
  const amountValid = requested != null && requested > BigInt(0) && available != null && !overBalance;
  // The whole balance goes out as `max: true`, which the server builds with the
  // protocol's exit-everything form so accrual between now and signing leaves no residue.
  const isMax = availableHuman != null && typed === availableHuman;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="earn-withdraw-amount" className="text-sm font-medium text-gray-700">
            Withdraw from {vault.protocol}
          </label>
          <span className="text-xs text-gray-500">{chainName(vault.chainId)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="earn-withdraw-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0"
            className={cn(inputClass, "font-mono text-2xl font-medium py-2")}
          />
          <span className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900">
            {symbol}
          </span>
        </div>
        <div className="mt-2 flex min-h-6 items-center justify-end">
          {availableHuman != null ? (
            <button
              type="button"
              // "Withdrawable", not "position": Aave collateral backing a borrow can only partly leave.
              title="Withdraw everything that can leave right now"
              onClick={() => setAmountStr(availableHuman)}
              className={cn(chipClass, "cursor-pointer hover:bg-gray-100")}
            >
              Withdrawable: {formatTokenAmount(available, decimals, symbol)}
            </button>
          ) : (
            !loadError && d.owner && <span className="text-xs text-gray-500">Reading your position...</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => withdraw(isMax ? "max" : typed)}
        disabled={!d.owner || !amountValid || busy || empty}
        className={primaryButtonClass}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase === "preparing" ? "Preparing..." : "Confirm in wallet..."}
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw
          </>
        )}
      </button>
      {empty && (
        <p className="-mt-2 text-xs text-gray-500">
          Nothing can leave right now. Either there is no position, or it is committed: Aave collateral
          backing a borrow, a reserve with no spare liquidity, or another collateral Aave wants withdrawn first.
        </p>
      )}
      {overBalance && (
        <p className="-mt-2 text-xs text-red-600">
          More than can be withdrawn right now ({formatTokenAmount(available, decimals, symbol)}).
        </p>
      )}
      {tooPrecise && (
        <p className="-mt-2 text-xs text-red-600">
          {symbol} has {decimals} decimals; trim the extra digits.
        </p>
      )}

      {loadError && (
        <ErrorBox title="Could not read your position">
          <p>{loadError}</p>
          <button type="button" onClick={reloadAvailable} className={cn(smallButtonClass, "mt-2")}>
            Retry
          </button>
        </ErrorBox>
      )}

      {error && <ErrorBox title="Withdraw Failed">{error}</ErrorBox>}

      {phase === "done" && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-gray-950">Withdrawn to your wallet</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {txHashes.map((h, i) => (
              <a
                key={h}
                className={linkChipClass}
                href={explorerTx(vault.chainId, h)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
                tx {txHashes.length > 1 ? `${i + 1}/${txHashes.length}` : ""}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
