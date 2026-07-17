"use client";

import { AlertCircle, Check, FileWarning, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { cn } from "../../lib/utils";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type RunStatus = "pending" | "success" | "error";

interface TestRun {
  id: number;
  preset: string;
  status: RunStatus;
  signature?: string;
  error?: string;
}

interface Preset {
  key: string;
  label: string;
  /** Raw string passed as the eth_signTypedData_v4 payload (params[1]). */
  payload: string;
}

const domain = {
  name: "Ether Mail",
  version: "1",
  chainId: 421614,
  verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
};

const PRESETS: Preset[] = [
  {
    key: "malformed-json",
    label: "Malformed JSON (unparseable)",
    payload: '{ "domain": { "name": "Ether Mail", }, ',
  },
  { key: "empty-object", label: "Empty object {}", payload: "{}" },
  {
    key: "missing-types",
    label: "Missing types",
    payload: JSON.stringify(
      { domain, primaryType: "Mail", message: { contents: "hi" } },
      null,
      2,
    ),
  },
  {
    key: "missing-domain",
    label: "Missing domain",
    payload: JSON.stringify(
      {
        types: { Mail: [{ name: "contents", type: "string" }] },
        primaryType: "Mail",
        message: { contents: "hi" },
      },
      null,
      2,
    ),
  },
  {
    key: "primarytype-missing",
    label: "primaryType not in types",
    payload: JSON.stringify(
      {
        domain,
        types: { EIP712Domain: [{ name: "name", type: "string" }] },
        primaryType: "Nonexistent",
        message: {},
      },
      null,
      2,
    ),
  },
  {
    key: "type-mismatch",
    label: "Field value / type mismatch",
    payload: JSON.stringify(
      {
        domain,
        types: { Mail: [{ name: "amount", type: "uint256" }] },
        primaryType: "Mail",
        message: { amount: "not-a-number" },
      },
      null,
      2,
    ),
  },
];

/**
 * Test Case — calls `eth_signTypedData_v4` with an invalid payload to verify
 * the wallet/SDK surfaces a clean error rather than crashing. Fires the raw
 * RPC method through the wallet provider (params: [address, payloadString]),
 * so it exercises the SDK's `JSON.parse` + viem `signTypedData` path. The
 * button is never gated, so requests can be stacked.
 */
export function SignTypedDataInvalidTest() {
  const { address, connector } = useAccount();
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const [text, setText] = useState(PRESETS[0].payload);
  const [counter, setCounter] = useState(0);
  const [runs, setRuns] = useState<TestRun[]>([]);

  const updateRun = (id: number, patch: Partial<TestRun>) =>
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );

  const handlePresetChange = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[0];
    setPresetKey(key);
    setText(preset.payload);
  };

  const handleSign = () => {
    const id = counter + 1;
    setCounter(id);
    setRuns((prev) => [{ id, preset: presetKey, status: "pending" }, ...prev]);

    (async () => {
      const provider = (await connector?.getProvider()) as Eip1193 | undefined;
      if (!provider) throw new Error("No wallet provider");
      return provider.request({
        method: "eth_signTypedData_v4",
        params: [address, text],
      });
    })()
      .then((signature) =>
        updateRun(id, { status: "success", signature: String(signature) }),
      )
      .catch((err) =>
        updateRun(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Signing failed",
        }),
      );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sign typed data — invalid payload
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Calls <code>eth_signTypedData_v4</code> with a malformed payload to
            confirm the wallet/SDK surfaces a clean error. Success here would be
            unexpected.
          </p>
        </div>
        {runs.length > 0 && (
          <button
            onClick={() => setRuns([])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Invalid payload
        </label>
        <select
          value={presetKey}
          onChange={(e) => handlePresetChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          )}
        >
          {PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
      </div>

      <button
        onClick={handleSign}
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <FileWarning className="h-4 w-4" />
        Sign typed data
      </button>

      {runs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="shrink-0">
                {run.status === "pending" && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
                {run.status === "success" && (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
                {run.status === "error" && (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
              <span className="shrink-0 text-sm font-medium text-gray-900">
                #{run.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                {run.status === "error"
                  ? run.error
                  : run.status === "success"
                    ? `unexpected success: ${run.signature?.slice(0, 12)}…`
                    : PRESETS.find((p) => p.key === run.preset)?.label}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  run.status === "pending" && "bg-gray-100 text-gray-600",
                  run.status === "success" && "bg-amber-100 text-amber-800",
                  run.status === "error" && "bg-emerald-50 text-emerald-700",
                )}
              >
                {run.status === "error"
                  ? "rejected"
                  : run.status === "success"
                    ? "signed"
                    : "pending"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
