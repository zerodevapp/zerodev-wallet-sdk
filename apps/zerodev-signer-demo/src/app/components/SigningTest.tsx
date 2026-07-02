"use client";

import { AlertCircle, Check, Copy, FileSignature, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { cn } from "../lib/utils";
import { arbitrumSepolia } from "viem/chains";

type SigningMode = "message" | "typedData";

// type VerificationResult = {
//   isValid: boolean;
// };

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

export function SigningTest() {
  const [mode, setMode] = useState<SigningMode>("message");
  const [payload, setPayload] = useState(message);
  const [error, setError] = useState<string>("");
  const [copiedSignature, setCopiedSignature] = useState(false);

  // Wagmi hooks
  const { address } = useAccount();
  // const publicClient = usePublicClient()
  const { signMessage, data: messageSignature, isPending: isSigningMessage, isSuccess: isMessageSuccess, error: signError, reset: resetSignMessage } = useSignMessage();
  const { signTypedData, data: typedDataSignature, isPending: isSigningTypedData, isSuccess: isTypedDataSuccess, error: typedDataError, reset: resetSignTypedData } = useSignTypedData();
  console.log("messageSignature", messageSignature);
  console.log("isMessageSuccess", isMessageSuccess);
  console.log("typedDataSignature", typedDataSignature);
  console.log("isTypedDataSuccess", isTypedDataSuccess);

  const loading = isSigningMessage || isSigningTypedData;
  const result = messageSignature || typedDataSignature;
  const samplePayload = mode === "message" ? message : JSON.stringify(typedData, null, 2);
  const hasModifiedPayload = payload !== samplePayload;

  const shortSignature = result
    ? `${result.slice(0, 10)}...${result.slice(-8)}`
    : "";
  const signingError = error || signError?.message || typedDataError?.message;

  const handleCopySignature = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopiedSignature(true);
    setTimeout(() => setCopiedSignature(false), 2000);
  };

  const handleSign = async () => {
    setError("");
    resetSignMessage();
    resetSignTypedData();

    if (!address) {
      setError("Please authenticate first");
      return;
    }

    try {
      if (mode === "message") {
        signMessage({ message: payload });
      } else {
        const parsedTypedData = JSON.parse(payload);
        signTypedData(parsedTypedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed");
    }
  };


  const loadSample = () => {
    setPayload(samplePayload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sign Anything</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sign messages and typed data with your wallet
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <button
          onClick={() => {
            setMode("message");
            setPayload("Hello World");
            setError("");
            resetSignMessage();
            resetSignTypedData();
          }}
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
          onClick={() => {
            setMode("typedData");
            setPayload(JSON.stringify(typedData, null, 2));
            setError("");
            resetSignMessage();
            resetSignTypedData();
          }}
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

      {/* Sign Button */}
      <button
        onClick={handleSign}
        disabled={loading || !payload.trim() || !address}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing...
          </>
        ) : (
          <>
            <FileSignature className="h-4 w-4" />
            Sign Anything
          </>
        )}
      </button>

      {/* Error */}
      {signingError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Signing Failed</p>
            <p className="text-sm text-red-700 mt-0.5">{signingError}</p>
          </div>
        </div>
      )}

      {/* Success Result */}
      {!signingError && (isMessageSuccess || isTypedDataSuccess) && result && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="shrink-0 text-sm font-semibold text-gray-950">
                Message signed successfully
              </p>
              <span className="font-mono text-xs text-gray-500">
                {shortSignature}
              </span>
            </div>
          </div>
          <button
            onClick={handleCopySignature}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            {copiedSignature ? "Copied" : "Copy signature"}
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
