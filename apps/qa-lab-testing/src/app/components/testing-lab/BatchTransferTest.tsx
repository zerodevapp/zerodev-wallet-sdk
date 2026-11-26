"use client";

import { waitForCallsStatus } from "@wagmi/core";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type Address,
  encodeFunctionData,
  isAddress,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import { arbitrumSepolia, sepolia } from "viem/chains";
import { useAccount, useConfig, useSendCalls } from "wagmi";
import { cn } from "../../lib/utils";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

type BatchAsset = "ETH" | "USDC";

type Call = { to: Address; value?: bigint; data?: `0x${string}` };

interface Recipient {
  id: number;
  address: string;
  percent: string;
}

// Circle's testnet USDC, the same contracts the signer demo's batch send uses.
const USDC_ADDRESSES: Record<number, Address> = {
  [sepolia.id]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [arbitrumSepolia.id]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

const erc20TransferAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const DEFAULT_ADDRESSES = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
];

const MAX_RECIPIENTS = DEFAULT_ADDRESSES.length;

const inputClass = cn(
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "text-gray-900 placeholder:text-gray-400",
);

/**
 * Test Case — one EIP-5792 `wallet_sendCalls` batch that splits an amount of
 * ETH or USDC across up to four recipients by percentage, as the signer demo
 * does. The run resolves to the bundle's transaction hash, so a whole batch is
 * one row here and one transaction on chain.
 */
export function BatchTransferTest() {
  const { chain } = useAccount();
  const config = useConfig();
  const { sendCallsAsync } = useSendCalls();
  const { runs, track, clear } = useTxRuns();
  const [asset, setAsset] = useState<BatchAsset>("ETH");
  const [amount, setAmount] = useState("0.0001");
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: 1, address: DEFAULT_ADDRESSES[0], percent: "50" },
    { id: 2, address: DEFAULT_ADDRESSES[1], percent: "50" },
  ]);

  const usdcAddress = chain ? USDC_ADDRESSES[chain.id] : undefined;
  const totalPercent = recipients.reduce(
    (sum, r) => sum + (Number(r.percent) || 0),
    0,
  );

  const update = (id: number, patch: Partial<Recipient>) =>
    setRecipients((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const addRecipient = () =>
    setRecipients((current) =>
      current.length >= MAX_RECIPIENTS
        ? current
        : [
            ...current,
            {
              id: Date.now(),
              address: DEFAULT_ADDRESSES[current.length],
              percent: "0",
            },
          ],
    );

  const removeRecipient = (id: number) =>
    setRecipients((current) =>
      current.length <= 1 ? current : current.filter((r) => r.id !== id),
    );

  const sendBatch = async (): Promise<`0x${string}`> => {
    if (recipients.some((r) => !isAddress(r.address))) {
      throw new Error("Enter a valid address for every recipient");
    }
    if (totalPercent !== 100) {
      throw new Error("Recipient percentages must add up to 100%");
    }
    if (asset === "USDC" && !usdcAddress) {
      throw new Error("USDC is not available on this chain");
    }

    const total =
      asset === "ETH" ? parseEther(amount || "0") : parseUnits(amount || "0", 6);
    const calls = recipients.flatMap((r): Call[] => {
      const value = (total * BigInt(Number(r.percent))) / BigInt(100);
      if (value === BigInt(0)) return [];
      const to = r.address as Address;
      return asset === "ETH"
        ? [{ to, value }]
        : [
            {
              to: usdcAddress as Address,
              data: encodeFunctionData({
                abi: erc20TransferAbi,
                functionName: "transfer",
                args: [to, value],
              }),
            },
          ];
    });
    if (calls.length === 0) throw new Error("Nothing to send");

    const { id } = await sendCallsAsync({ calls });
    const result = await waitForCallsStatus(config, { id });
    const hash = result.receipts?.[0]?.transactionHash;
    if (result.status === "failure") {
      throw new Error(
        hash ? `Batch transaction failed: ${hash}` : "Batch transaction failed",
      );
    }
    if (!hash) throw new Error("Batch landed without a transaction hash");
    return hash;
  };

  const handleSend = () => {
    const split = recipients.map((r) => `${r.percent}%`).join("/");
    track(`Batch ${amount || "0"} ${asset} → ${recipients.length} (${split})`, sendBatch);
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-batch-transfer"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Batch transfer
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Splits an amount across recipients in one atomic{" "}
            <code>wallet_sendCalls</code> batch.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          {(["ETH", "USDC"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAsset(option)}
              data-testid={`batch-asset-${option.toLowerCase()}`}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors cursor-pointer",
                asset === option
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Total amount ({asset})
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0001"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Recipients
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                totalPercent === 100 ? "text-gray-400" : "text-red-600",
              )}
            >
              {totalPercent}% of 100%
            </span>
          </div>
          {recipients.map((r) => (
            <div key={r.id} className="flex gap-2">
              <input
                type="text"
                value={r.address}
                onChange={(e) => update(r.id, { address: e.target.value })}
                spellCheck={false}
                className={cn(inputClass, "min-w-0 flex-1 font-mono text-xs")}
              />
              <input
                type="text"
                inputMode="numeric"
                value={r.percent}
                onChange={(e) => update(r.id, { percent: e.target.value })}
                aria-label="Percent"
                className={cn(inputClass, "w-16 text-right")}
              />
              <button
                type="button"
                onClick={() => removeRecipient(r.id)}
                disabled={recipients.length <= 1}
                aria-label="Remove recipient"
                className="shrink-0 rounded-lg border border-gray-200 px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {recipients.length < MAX_RECIPIENTS && (
            <button
              type="button"
              onClick={addRecipient}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add recipient
            </button>
          )}
        </div>
      </div>

      <div aria-hidden className="grow" />
      <button
        onClick={handleSend}
        data-testid="batch-transfer-submit"
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <Layers className="h-4 w-4" />
        Send batch
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
