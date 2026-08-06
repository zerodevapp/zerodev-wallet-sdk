"use client";

import { AlertCircle, Code2 } from "lucide-react";
import { useState } from "react";
import { type Address, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { cn } from "../../lib/utils";
import {
  addressOn,
  TEST_CONTRACT_CHAIN_NAMES,
  TEST_ERC20,
} from "./contracts";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const ERC20_ABI = TEST_ERC20.abi;
const ASSUMED_DECIMALS = 18;

type Fn = "mint" | "approve" | "transfer" | "transferFrom";

interface Field {
  name: string;
  kind: "address" | "amount";
}

const FUNCTIONS: { key: Fn; label: string; fields: Field[] }[] = [
  {
    key: "mint",
    label: "mint(to, amount)",
    fields: [
      { name: "to", kind: "address" },
      { name: "amount", kind: "amount" },
    ],
  },
  {
    key: "approve",
    label: "approve(spender, value)",
    fields: [
      { name: "spender", kind: "address" },
      { name: "value", kind: "amount" },
    ],
  },
  {
    key: "transfer",
    label: "transfer(to, value)",
    fields: [
      { name: "to", kind: "address" },
      { name: "value", kind: "amount" },
    ],
  },
  {
    key: "transferFrom",
    label: "transferFrom(from, to, value)",
    fields: [
      { name: "from", kind: "address" },
      { name: "to", kind: "address" },
      { name: "value", kind: "amount" },
    ],
  },
];

const fnConfig = (fn: Fn) => FUNCTIONS.find((f) => f.key === fn) ?? FUNCTIONS[0];

const defaultArgs = (fn: Fn, address?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const field of fnConfig(fn).fields) {
    out[field.name] = field.kind === "address" ? (address ?? "") : "1";
  }
  return out;
};

/**
 * Test Case — executes a state-changing function on the test ERC20. The
 * function is picked from a dropdown with editable args; each variant
 * exercises a different Tx review popup decode path (transfer, approve, and a
 * generic call for mint/transferFrom).
 */
export function Erc20ContractTest() {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { runs, track, clear } = useTxRuns();

  const [fn, setFn] = useState<Fn>("mint");
  const [args, setArgs] = useState<Record<string, string>>(() =>
    defaultArgs("mint", address),
  );

  const erc20Address = addressOn(TEST_ERC20, chain?.id);
  const unsupportedChain = !erc20Address;

  const handleFnChange = (next: Fn) => {
    setFn(next);
    setArgs(defaultArgs(next, address));
  };

  const setArg = (name: string, value: string) =>
    setArgs((prev) => ({ ...prev, [name]: value }));

  const execute = (): Promise<`0x${string}`> => {
    const amount = (name: string) => parseUnits(args[name] ?? "0", ASSUMED_DECIMALS);
    const addr = (name: string) => (args[name] ?? "") as Address;
    if (!erc20Address) {
      throw new Error(
        `Test ERC20 is not deployed on ${chain?.name ?? "this chain"}`,
      );
    }
    const base = { address: erc20Address, abi: ERC20_ABI } as const;

    switch (fn) {
      case "mint":
        return writeContractAsync({
          ...base,
          functionName: "mint",
          args: [addr("to"), amount("amount")],
        });
      case "approve":
        return writeContractAsync({
          ...base,
          functionName: "approve",
          args: [addr("spender"), amount("value")],
        });
      case "transfer":
        return writeContractAsync({
          ...base,
          functionName: "transfer",
          args: [addr("to"), amount("value")],
        });
      case "transferFrom":
        return writeContractAsync({
          ...base,
          functionName: "transferFrom",
          args: [addr("from"), addr("to"), amount("value")],
        });
    }
  };

  const handleExecute = () => {
    const label = `${fn}(${fnConfig(fn)
      .fields.map((f) => args[f.name])
      .join(", ")})`;
    track(label, execute);
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-erc20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Execute ERC20 function
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Calls a write function on the test ERC20 at{" "}
            <code className="break-all" data-testid="erc20-address">
              {erc20Address ?? "—"}
            </code>{" "}
            on {chain?.name ?? "the connected chain"}. Amounts assume{" "}
            {ASSUMED_DECIMALS} decimals.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      {unsupportedChain && (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5"
          data-testid="erc20-unsupported-chain"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Not deployed on {chain?.name ?? "this chain"}. Switch the
            wallet&apos;s network (top of the dashboard) to{" "}
            {TEST_CONTRACT_CHAIN_NAMES}.
          </p>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Function
        </label>
        <select
          value={fn}
          onChange={(e) => handleFnChange(e.target.value as Fn)}
          className={cn(
            "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          )}
        >
          {FUNCTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 space-y-3">
        {fnConfig(fn).fields.map((field) => (
          <div key={field.name}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {field.name}
              {field.kind === "amount" && (
                <span className="ml-1 font-normal text-gray-400">
                  (token units)
                </span>
              )}
            </label>
            <input
              type="text"
              value={args[field.name] ?? ""}
              onChange={(e) => setArg(field.name, e.target.value)}
              spellCheck={false}
              placeholder={field.kind === "address" ? "0x…" : "1"}
              className={cn(
                "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm",
                field.kind === "address" && "font-mono",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "text-gray-900 placeholder:text-gray-400",
              )}
            />
          </div>
        ))}
      </div>

      <div aria-hidden className="grow" />
      <button
        onClick={handleExecute}
        disabled={unsupportedChain}
        data-testid="erc20-submit"
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-gray-950",
          "flex items-center justify-center gap-2",
        )}
      >
        <Code2 className="h-4 w-4" />
        Execute {fn}
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
