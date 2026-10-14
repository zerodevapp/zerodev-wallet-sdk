"use client";

import { useSolanaAccount, useSolanaWallet } from "@zerodev/wallet-react-ui";
import { AlertCircle, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { cn } from "../lib/utils";
import { arbitrumSepolia } from "viem/chains";

type SigningMode = "message" | "typedData";
type Chain = "evm" | "solana";

type ChainResult = {
  signature: string;
  format: "hex" | "base58";
  walletName: string;
};

const typedData = {
  domain: {
    name: "Ether Mail",
    version: "1",
    chainId: arbitrumSepolia.id,
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
    from: { name: "Cow", wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" },
    to: { name: "Bob", wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" },
    contents: "Hello, Bob!",
  },
};

const message = "Hello World";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 (Solana convention) for display; bytes to text only. */
function toBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const value = (digits[i] ?? 0) * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return (
    "1".repeat(zeros) +
    digits
      .reverse()
      .map((d) => BASE58[d])
      .join("")
  );
}

const shorten = (value: string) =>
  value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;

/**
 * One signing card for both connected wallets. The payload is shared; the
 * EVM button signs through wagmi (message or EIP-712 typed data) and the
 * Solana button relays the message bytes to the wallet's own
 * `solana:signMessage` feature through the kit's `useSolanaWallet()`. The
 * kit signs nothing on the Solana side: the wallet shows its prompt and
 * returns an ed25519 signature. Each chain keeps its own result so both
 * signatures can sit side by side.
 */
export function SigningTest() {
  const [mode, setMode] = useState<SigningMode>("message");
  const [payload, setPayload] = useState(message);
  const [results, setResults] = useState<Partial<Record<Chain, ChainResult>>>({});
  const [error, setError] = useState<{ chain: Chain; message: string } | null>(null);
  const [copied, setCopied] = useState<Chain | null>(null);
  const [isSigningSolana, setIsSigningSolana] = useState(false);

  // EVM side (wagmi)
  const { address, connector } = useAccount();
  const { signMessageAsync, isPending: isSigningMessage } = useSignMessage();
  const { signTypedDataAsync, isPending: isSigningTypedData } = useSignTypedData();
  const isSigningEvm = isSigningMessage || isSigningTypedData;
  const evmWalletName = connector?.name ?? "EVM wallet";

  // Solana side (kit)
  const solana = useSolanaAccount();
  const solanaHandle = useSolanaWallet();
  const solanaWalletName = solana.walletName ?? "Solana wallet";
  const solanaCanSign = solana.isConnected && solanaHandle?.signMessage != null;

  const samplePayload = mode === "message" ? message : JSON.stringify(typedData, null, 2);
  const hasModifiedPayload = payload !== samplePayload;
  const hasPayload = payload.trim().length > 0;

  const evmDisabledReason = !address ? "Connect an EVM wallet" : null;
  const solanaDisabledReason = !solana.isConnected
    ? "Connect a Solana wallet"
    : !solanaCanSign
      ? "Wallet lacks solana:signMessage"
      : mode === "typedData"
        ? "Solana has no typed data"
        : null;

  const switchMode = (next: SigningMode) => {
    setMode(next);
    setPayload(next === "message" ? message : JSON.stringify(typedData, null, 2));
    setError(null);
    // Earlier signatures belong to the other payload kind.
    setResults({});
  };

  const loadSample = () => setPayload(samplePayload);

  const setResult = (chain: Chain, result: ChainResult) =>
    setResults((prev) => ({ ...prev, [chain]: result }));

  const handleSignEvm = async () => {
    setError(null);
    setResults((prev) => ({ ...prev, evm: undefined }));
    try {
      const signature =
        mode === "message"
          ? await signMessageAsync({ message: payload })
          : await signTypedDataAsync(JSON.parse(payload));
      setResult("evm", { signature, format: "hex", walletName: evmWalletName });
    } catch (err) {
      setError({
        chain: "evm",
        message: err instanceof Error ? err.message : "Signing failed",
      });
    }
  };

  const handleSignSolana = async () => {
    if (!solanaHandle?.signMessage) return;
    setError(null);
    setResults((prev) => ({ ...prev, solana: undefined }));
    setIsSigningSolana(true);
    try {
      const { signature } = await solanaHandle.signMessage(
        new TextEncoder().encode(payload),
      );
      setResult("solana", {
        signature: toBase58(signature),
        format: "base58",
        walletName: solanaWalletName,
      });
    } catch (err) {
      setError({
        chain: "solana",
        message: err instanceof Error ? err.message : "Signing failed",
      });
    } finally {
      setIsSigningSolana(false);
    }
  };

  const handleCopy = async (chain: Chain) => {
    const result = results[chain];
    if (!result) return;
    await navigator.clipboard.writeText(result.signature);
    setCopied(chain);
    setTimeout(() => setCopied(null), 2000);
  };

  const chainButtonClass = cn(
    "flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
    "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "flex flex-col items-center justify-center gap-0.5",
  );

  const chainLabel: Record<Chain, string> = { evm: "EVM", solana: "Solana" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sign</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sign the same payload with either connected wallet
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <button
          onClick={() => switchMode("message")}
          className={cn(
            "flex h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-all cursor-pointer",
            mode === "message"
              ? "border-gray-200 bg-white text-gray-950 shadow-sm"
              : "border-transparent text-gray-500 hover:bg-white hover:text-gray-800"
          )}
        >
          Message
        </button>
        <button
          onClick={() => switchMode("typedData")}
          className={cn(
            "flex h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-all cursor-pointer",
            mode === "typedData"
              ? "border-gray-200 bg-white text-gray-950 shadow-sm"
              : "border-transparent text-gray-500 hover:bg-white hover:text-gray-800"
          )}
        >
          Typed Data (EIP-712)
        </button>
      </div>

      {/* Payload Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            {mode === "message" ? "Message" : "Typed Data JSON"}
          </label>
          {hasModifiedPayload && (
            <button
              onClick={loadSample}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Load Sample
            </button>
          )}
        </div>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={3}
          placeholder={mode === "message" ? "Enter message to sign..." : "Enter EIP-712 typed data JSON..."}
          className={cn(
            "w-full px-4 py-3 rounded-lg border border-gray-200 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-gray-900 placeholder:text-gray-400"
          )}
        />
      </div>

      {/* Sign Buttons: one per connected chain */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={handleSignEvm}
          disabled={isSigningEvm || !hasPayload || evmDisabledReason !== null}
          data-testid="sign-evm-button"
          className={chainButtonClass}
        >
          <span className="flex items-center gap-2">
            {isSigningEvm && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSigningEvm ? "Waiting for wallet..." : "Sign with EVM"}
          </span>
          <span className="text-xs font-normal opacity-70">
            {evmDisabledReason ?? evmWalletName}
          </span>
        </button>
        <button
          onClick={handleSignSolana}
          disabled={isSigningSolana || !hasPayload || solanaDisabledReason !== null}
          data-testid="sign-solana-button"
          className={chainButtonClass}
        >
          <span className="flex items-center gap-2">
            {isSigningSolana && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSigningSolana ? "Waiting for wallet..." : "Sign with Solana"}
          </span>
          <span className="text-xs font-normal opacity-70">
            {solanaDisabledReason ?? solanaWalletName}
          </span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">
              {chainLabel[error.chain]} signing failed
            </p>
            <p className="text-sm text-red-700 mt-0.5">{error.message}</p>
          </div>
        </div>
      )}

      {/* Results: one row per chain that has signed */}
      {(["evm", "solana"] as const).map((chain) => {
        const result = results[chain];
        if (!result) return null;
        return (
          <div
            key={chain}
            data-testid={`${chain}-signature`}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Check className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <p className="shrink-0 text-sm font-semibold text-gray-950">
                  <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-gray-600">
                    {chainLabel[chain]}
                  </span>
                  Signed with {result.walletName}
                </p>
                <span className="font-mono text-xs text-gray-500">
                  {shorten(result.signature)}
                  <span className="ml-1 text-gray-400">({result.format})</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => handleCopy(chain)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
            >
              {copied === chain ? "Copied" : "Copy signature"}
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
