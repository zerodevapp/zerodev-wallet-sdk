"use client";

import { useSolanaWallet } from "@zerodev/wallet-react-ui";
import { AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { errorMessage } from "./txRuns";

type MethodKey = "signMessage" | "signTransaction" | "signAndSendTransaction";

interface Method {
  key: MethodKey;
  label: string;
  /** The Wallet Standard feature the handle method is built from. */
  feature: string;
  /** What the call returns, so a run row says what its hex actually is. */
  output: string;
}

const METHODS: Method[] = [
  {
    key: "signMessage",
    label: "Sign message (Solana)",
    feature: "solana:signMessage",
    output: "signature",
  },
  {
    key: "signTransaction",
    label: "Sign transaction",
    feature: "solana:signTransaction",
    output: "signed tx",
  },
  {
    key: "signAndSendTransaction",
    label: "Sign & send",
    feature: "solana:signAndSendTransaction",
    output: "tx signature",
  },
];

type RunStatus = "pending" | "success" | "error";

interface SignRun {
  id: number;
  method: MethodKey;
  status: RunStatus;
  /** Hex without `0x`: Solana returns raw bytes, not EVM words. */
  output?: string;
  /** Set only when the wallet signed bytes other than the ones sent. */
  walletSigned?: string;
  error?: string;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (input: string): Uint8Array => {
  const hex = input.trim().replace(/^0x/, "").replace(/\s+/g, "");
  if (hex.length === 0) throw new Error("No transaction bytes given");
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new Error("Transaction bytes must be hex");
  }
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
};

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

const shortHex = (hex: string) =>
  hex.length > 24 ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : hex;

/**
 * Relays signing requests to the connected Solana wallet.
 */
export function SolanaSigningTest() {
  const handle = useSolanaWallet();
  const [message, setMessage] = useState("Solana QA lab message");
  const [transactionHex, setTransactionHex] = useState("");
  const [runs, setRuns] = useState<SignRun[]>([]);
  const [counter, setCounter] = useState(0);

  const update = (id: number, patch: Partial<SignRun>) =>
    setRuns((prev) =>
      prev.map((run) => (run.id === id ? { ...run, ...patch } : run)),
    );

  const call = async (
    method: MethodKey,
  ): Promise<Pick<SignRun, "output" | "walletSigned">> => {
    if (!handle) throw new Error("No Solana wallet connected");

    if (method === "signMessage") {
      const sign = handle.signMessage;
      if (!sign) throw new Error("The account exposes no solana:signMessage");
      const sent = new TextEncoder().encode(message);
      const { signature, signedMessage } = await sign(sent);
      return {
        output: toHex(signature),
        ...(sameBytes(sent, signedMessage)
          ? {}
          : { walletSigned: toHex(signedMessage) }),
      };
    }

    // Raw bytes rather than a transaction built here: the lab has no Solana
    // RPC to fetch a blockhash from, and what these two prove is the relay.
    const transaction = fromHex(transactionHex);

    if (method === "signTransaction") {
      const sign = handle.signTransaction;
      if (!sign) {
        throw new Error("The account exposes no solana:signTransaction");
      }
      return { output: toHex(await sign(transaction)) };
    }

    const send = handle.signAndSendTransaction;
    if (!send) {
      throw new Error("The account exposes no solana:signAndSendTransaction");
    }
    return { output: toHex(await send(transaction)) };
  };

  const fire = (method: MethodKey) => {
    const id = counter + 1;
    setCounter(id);
    setRuns((prev) => [{ id, method, status: "pending" }, ...prev]);

    call(method)
      .then((result) => update(id, { status: "success", ...result }))
      .catch((err) => update(id, { status: "error", error: errorMessage(err) }));
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-solana-signing"
      data-connected={String(handle !== null)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Sign with the Solana wallet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Each method is relayed to the wallet&apos;s own Wallet Standard
            feature. A method reads <code>null</code> unless the wallet and the
            connected account both declare it.
          </p>
        </div>
        {runs.length > 0 && (
          <button
            onClick={() => setRuns([])}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {handle === null && (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="solana-signing-disconnected"
        >
          Connect a Solana wallet to use these.
        </p>
      )}

      <div className="mt-4">
        <label
          htmlFor="solana-message"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Message to sign
        </label>
        <textarea
          id="solana-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          spellCheck={false}
          data-testid="solana-message-input"
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="solana-transaction"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Transaction bytes (hex)
        </label>
        <input
          id="solana-transaction"
          value={transactionHex}
          onChange={(event) => setTransactionHex(event.target.value)}
          spellCheck={false}
          placeholder="01000103…"
          data-testid="solana-transaction-input"
          className={cn(
            "w-full rounded-lg border border-gray-200 px-4 py-2.5 font-mono text-sm",
            "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500",
            "text-gray-900 placeholder:text-gray-400",
          )}
        />
      </div>

      <ul className="mt-4 space-y-2" data-testid="solana-handles">
        {METHODS.map((method) => {
          const available = Boolean(handle?.[method.key]);
          return (
            <li
              key={method.key}
              data-testid={`solana-handle-${method.key}`}
              data-available={String(available)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <code className="min-w-0 flex-1 truncate text-xs text-gray-500">
                  {method.feature}
                </code>
                <span
                  data-testid={`solana-handle-${method.key}-state`}
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    available
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-200 text-gray-600",
                  )}
                >
                  {available ? "available" : "null"}
                </span>
                <button
                  onClick={() => fire(method.key)}
                  disabled={!available}
                  data-testid={`solana-fire-${method.key}`}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    available
                      ? "cursor-pointer border border-gray-950 bg-gray-950 text-white hover:bg-black"
                      : "cursor-not-allowed border border-gray-200 bg-white text-gray-400",
                  )}
                >
                  {method.label}
                </button>
              </div>
              {!available && (
                <p className="mt-1 text-xs text-gray-400">
                  The account exposes no {method.feature}.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div aria-hidden className="grow" />

      {runs.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="solana-sign-runs">
          {runs.map((run) => (
            <li
              key={run.id}
              data-testid={`solana-sign-run-${run.id}`}
              data-method={run.method}
              data-status={run.status}
              data-output={run.output}
              data-wallet-signed={run.walletSigned}
              data-error={run.error}
              className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
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
                  {run.status === "error" ? run.error : run.method}
                </span>
              </div>
              {run.output && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-[26px] font-mono text-[11px] text-gray-400">
                  <span title={run.output}>
                    {METHODS.find((method) => method.key === run.method)?.output}{" "}
                    {shortHex(run.output)}
                  </span>
                </div>
              )}
              {run.walletSigned && (
                <p
                  className="pl-[26px] font-mono text-[11px] text-amber-700"
                  title={run.walletSigned}
                >
                  wallet signed: {shortHex(run.walletSigned)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
