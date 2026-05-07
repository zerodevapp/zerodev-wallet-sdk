"use client";

import { AlertCircle, FileSignature, Loader2, Sparkles } from "lucide-react";
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

  // Wagmi hooks
  const { address } = useAccount();
  // const publicClient = usePublicClient()
  const { signMessage, data: messageSignature, isPending: isSigningMessage, isSuccess: isMessageSuccess, error: signError } = useSignMessage();
  const { signTypedData, data: typedDataSignature, isPending: isSigningTypedData, isSuccess: isTypedDataSuccess, error: typedDataError } = useSignTypedData();
  console.log("messageSignature", messageSignature);
  console.log("isMessageSuccess", isMessageSuccess);
  console.log("typedDataSignature", typedDataSignature);
  console.log("isTypedDataSuccess", isTypedDataSuccess);

  const loading = isSigningMessage || isSigningTypedData;
  // const result = messageSignature || typedDataSignature;

  const handleSign = async () => {
    if (!address) {
      setError("Please authenticate first");
      return;
    }

    setError("");

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
    if (mode === "message") {
      setPayload(message);
    } else {
      setPayload(JSON.stringify(typedData, null, 2));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Sign Message</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sign messages and typed data with your wallet
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => { setMode("message"); setPayload("Hello World"); }}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
            mode === "message" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          Message
        </button>
        <button
          onClick={() => { setMode("typedData"); setPayload(JSON.stringify(typedData, null, 2)); }}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
            mode === "typedData" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
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
          <button
            onClick={loadSample}
            className="text-sm text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load Sample
          </button>
        </div>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={mode === "message" ? 3 : 10}
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
        style={{
          background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
        }}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border-2 border-transparent text-blue-500",
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
            Sign {mode === "message" ? "Message" : "Typed Data"}
          </>
        )}
      </button>

      {/* Error */}
      {(error || signError || typedDataError) && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Signing Failed</p>
            <p className="text-sm text-red-700 mt-0.5">{error || signError?.message || typedDataError?.message}</p>
          </div>
        </div>
      )}

      {/* Success Result */}
      {(isMessageSuccess || isTypedDataSuccess) && (messageSignature || typedDataSignature) && (
        <div className="space-y-3">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-2">Signature</p>
            <p className="text-xs text-gray-700 font-mono break-all">{mode === "message" ? messageSignature : typedDataSignature}</p>
          </div>
        </div>
      )}
    </div>
  );
}
