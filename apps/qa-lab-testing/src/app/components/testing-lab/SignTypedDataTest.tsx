"use client";

import { AlertCircle, Check, FileSignature, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { cn } from "../../lib/utils";
import { ClearRunsButton } from "./txRuns";

type RunStatus = "pending" | "success" | "error";

interface TypedDataRun {
  id: number;
  status: RunStatus;
  signature?: string;
  error?: string;
}

const shortHex = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`;

/**
 * A valid EIP-712 payload. `chainId` follows the connected chain — a domain
 * naming a chain the project doesn't allow is rejected by the backend, which
 * would look like a signing failure rather than a config mismatch.
 */
const buildPayload = (chainId: number) =>
  JSON.stringify(
    {
      domain: {
        name: "Ether Mail",
        version: "1",
        chainId,
        verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      },
      types: {
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
        Mail: [
          { name: "from", type: "Person" },
          { name: "to", type: "Person" },
          { name: "contents", type: "string" },
        ],
      },
      primaryType: "Mail",
      message: {
        from: {
          name: "Cow",
          wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
        },
        to: {
          name: "Bob",
          wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
        },
        contents: "Hello, Bob!",
      },
    },
    null,
    2,
  );

/**
 * Test Case — `eth_signTypedData_v4` with a well-formed payload. The
 * counterpart to `SignTypedDataInvalidTest`: this one is expected to succeed,
 * so it's what proves typed-data signing works at all.
 */
export function SignTypedDataTest() {
  const { chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const chainId = chain?.id;
  const preset = useMemo(() => buildPayload(chainId ?? 0), [chainId]);
  const [text, setText] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const [runs, setRuns] = useState<TypedDataRun[]>([]);

  // Null until edited, so the payload keeps tracking the connected chain.
  const payload = text ?? preset;

  const updateRun = (id: number, patch: Partial<TypedDataRun>) =>
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );

  const handleSign = () => {
    const id = counter + 1;
    setCounter(id);
    setRuns((prev) => [{ id, status: "pending" }, ...prev]);

    let parsed: Parameters<typeof signTypedDataAsync>[0];
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      updateRun(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Invalid JSON",
      });
      return;
    }

    signTypedDataAsync(parsed)
      .then((signature) => updateRun(id, { status: "success", signature }))
      .catch((err) =>
        updateRun(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Signing failed",
        }),
      );
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-sign-typed-data"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sign typed data (EIP-712)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            A well-formed <code>eth_signTypedData_v4</code> payload, pre-filled
            for the connected chain. Expected to succeed.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={() => setRuns([])} />}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Payload</label>
          {text !== null && (
            <button
              onClick={() => setText(null)}
              className="text-sm font-medium text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
        <textarea
          value={payload}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          data-testid="sign-typed-data-payload"
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
      </div>

      <div aria-hidden className="grow" />
      <button
        onClick={handleSign}
        data-testid="sign-typed-data-submit"
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <FileSignature className="h-4 w-4" />
        Sign typed data #{counter + 1}
      </button>

      {runs.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="typed-data-runs">
          {runs.map((run) => (
            <li
              key={run.id}
              data-testid={`typed-data-run-${run.id}`}
              data-status={run.status}
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
                {run.status === "error" ? run.error : "signed"}
              </span>
              {run.signature && (
                <span
                  className="shrink-0 font-mono text-[11px] text-gray-400"
                  title={run.signature}
                >
                  {shortHex(run.signature)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
