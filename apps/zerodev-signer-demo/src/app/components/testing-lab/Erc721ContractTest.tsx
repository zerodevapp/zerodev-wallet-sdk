"use client";

import { AlertCircle, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { type Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { cn } from "../../lib/utils";
import { TEST_ERC721 } from "./contracts";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const NFT_ADDRESS = TEST_ERC721.address;
const NFT_CHAIN_ID = TEST_ERC721.chainId;
const NFT_ABI = TEST_ERC721.abi;

type Fn =
  | "mint"
  | "setImageURI"
  | "approve"
  | "setApprovalForAll"
  | "transferFrom"
  | "safeTransferFrom";

interface Field {
  name: string;
  kind: "address" | "tokenId" | "bool" | "string";
}

const FUNCTIONS: { key: Fn; label: string; fields: Field[] }[] = [
  { key: "mint", label: "mint(to)", fields: [{ name: "to", kind: "address" }] },
  {
    key: "setImageURI",
    label: "setImageURI(uri)",
    fields: [{ name: "uri", kind: "string" }],
  },
  {
    key: "approve",
    label: "approve(to, tokenId)",
    fields: [
      { name: "to", kind: "address" },
      { name: "tokenId", kind: "tokenId" },
    ],
  },
  {
    key: "setApprovalForAll",
    label: "setApprovalForAll(operator, approved)",
    fields: [
      { name: "operator", kind: "address" },
      { name: "approved", kind: "bool" },
    ],
  },
  {
    key: "transferFrom",
    label: "transferFrom(from, to, tokenId)",
    fields: [
      { name: "from", kind: "address" },
      { name: "to", kind: "address" },
      { name: "tokenId", kind: "tokenId" },
    ],
  },
  {
    key: "safeTransferFrom",
    label: "safeTransferFrom(from, to, tokenId)",
    fields: [
      { name: "from", kind: "address" },
      { name: "to", kind: "address" },
      { name: "tokenId", kind: "tokenId" },
    ],
  },
];

const fnConfig = (fn: Fn) => FUNCTIONS.find((f) => f.key === fn) ?? FUNCTIONS[0];

const defaultArgs = (fn: Fn, address?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const field of fnConfig(fn).fields) {
    if (field.kind === "address") out[field.name] = address ?? "";
    else if (field.kind === "bool") out[field.name] = "true";
    else if (field.kind === "string") out[field.name] = "";
    else out[field.name] = "0";
  }
  return out;
};

/**
 * Test Case — executes a state-changing function on the test ERC721. The
 * function is picked from a dropdown with editable args; `mint` and
 * `setApprovalForAll` exercise the Tx review popup's dedicated NFT decode
 * paths, the rest a generic call.
 */
export function Erc721ContractTest() {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { runs, track, clear } = useTxRuns();

  const [fn, setFn] = useState<Fn>("mint");
  const [args, setArgs] = useState<Record<string, string>>(() =>
    defaultArgs("mint", address),
  );

  const wrongChain = chain?.id !== NFT_CHAIN_ID;

  const handleFnChange = (next: Fn) => {
    setFn(next);
    setArgs(defaultArgs(next, address));
  };

  const setArg = (name: string, value: string) =>
    setArgs((prev) => ({ ...prev, [name]: value }));

  const execute = (): Promise<`0x${string}`> => {
    const addr = (name: string) => (args[name] ?? "") as Address;
    const tokenId = (name: string) => BigInt(args[name] || "0");
    const base = { address: NFT_ADDRESS, abi: NFT_ABI } as const;

    switch (fn) {
      case "mint":
        return writeContractAsync({ ...base, functionName: "mint", args: [addr("to")] });
      case "setImageURI":
        return writeContractAsync({
          ...base,
          functionName: "setImageURI",
          args: [args.uri ?? ""],
        });
      case "approve":
        return writeContractAsync({
          ...base,
          functionName: "approve",
          args: [addr("to"), tokenId("tokenId")],
        });
      case "setApprovalForAll":
        return writeContractAsync({
          ...base,
          functionName: "setApprovalForAll",
          args: [addr("operator"), args.approved === "true"],
        });
      case "transferFrom":
        return writeContractAsync({
          ...base,
          functionName: "transferFrom",
          args: [addr("from"), addr("to"), tokenId("tokenId")],
        });
      case "safeTransferFrom":
        return writeContractAsync({
          ...base,
          functionName: "safeTransferFrom",
          args: [addr("from"), addr("to"), tokenId("tokenId")],
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Execute ERC721 function
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Calls a write function on the test NFT at{" "}
            <code className="break-all">{NFT_ADDRESS}</code> (Arbitrum Sepolia).
            <code>mint</code> is open and returns an auto-incrementing token id.
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
              {field.kind === "tokenId" && (
                <span className="ml-1 font-normal text-gray-400">(token id)</span>
              )}
            </label>
            {field.kind === "bool" ? (
              <select
                value={args[field.name] ?? "true"}
                onChange={(e) => setArg(field.name, e.target.value)}
                className={cn(
                  "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 cursor-pointer",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                )}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="text"
                value={args[field.name] ?? ""}
                onChange={(e) => setArg(field.name, e.target.value)}
                spellCheck={false}
                placeholder={
                  field.kind === "address"
                    ? "0x…"
                    : field.kind === "string"
                      ? "https://… or data URI"
                      : "0"
                }
                className={cn(
                  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm",
                  field.kind === "address" && "font-mono",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "text-gray-900 placeholder:text-gray-400",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleExecute}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <ImageIcon className="h-4 w-4" />
        Execute {fn}
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
