"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileSignature,
  Loader2,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useConfig,
  usePublicClient,
  useSignMessage,
  useSignTypedData,
} from "wagmi";
import {
  type Address,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  parseEther,
  parseUnits,
  zeroAddress,
} from "viem";
import { getZeroDevConnector, getZeroDevStore } from "@zerodev/wallet-react";
import { arbitrumSepolia } from "viem/chains";
import { cn } from "../lib/utils";
import { FaucetLink } from "./FaucetLink";

const USDC_BY_CHAIN: Record<number, Address> = {
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};
const EXPLORER_BY_CHAIN: Record<number, string> = {
  421614: "https://sepolia.arbiscan.io",
  11155111: "https://sepolia.etherscan.io",
};
const USDC_FAUCET_URL = "https://faucet.circle.com/";
const ETH_FAUCET_BY_CHAIN: Record<number, string> = {
  421614: "https://www.alchemy.com/faucets/arbitrum-sepolia",
  11155111: "https://www.alchemy.com/faucets/ethereum-sepolia",
};
const DEFAULT_SEND_TO: Address = "0x1111111111111111111111111111111111111111";

type SendAsset = "usdc" | "eth";
const DEFAULT_AMOUNT: Record<SendAsset, string> = { usdc: "0.01", eth: "0.001" };

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

// Sample EIP-712 typed data (the classic "Ether Mail" example).
const sampleTypedData = {
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
const sampleTypedDataJson = JSON.stringify(sampleTypedData, null, 2);

function formatShort(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getErrorMessage(error: unknown) {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    for (const key of ["shortMessage", "details", "message"]) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SigningTest({
  accountAddress,
  sendFocusRequest = 0,
  sendFocusAsset,
}: {
  accountAddress: Address | null
  sendFocusRequest?: number
  sendFocusAsset?: SendAsset
}) {
  const { address, chain } = useAccount();
  const wagmiConfig = useConfig();
  const publicClient = usePublicClient({ chainId: chain?.id });

  const activeAddress = accountAddress ?? address;
  const hasUsableAddress =
    Boolean(activeAddress) && activeAddress?.toLowerCase() !== zeroAddress;

  const usdcAddress = chain?.id ? USDC_BY_CHAIN[chain.id] : undefined;
  const explorerBaseUrl =
    (chain?.id ? EXPLORER_BY_CHAIN[chain.id] : undefined) ?? "https://sepolia.arbiscan.io";

  // Step 1 — personal sign
  const [message, setMessage] = useState("Hello World");
  const {
    signMessage,
    data: messageSignature,
    isPending: signingMessage,
    error: messageError,
    reset: resetMessage,
  } = useSignMessage();

  // Step 2 — typed data
  const [typedDataJson, setTypedDataJson] = useState(sampleTypedDataJson);
  const {
    signTypedData,
    data: typedDataSignature,
    isPending: signingTypedData,
    error: typedDataError,
    reset: resetTypedData,
  } = useSignTypedData();
  const [typedDataParseError, setTypedDataParseError] = useState("");

  // Step 3 — send assets
  const [asset, setAsset] = useState<SendAsset>("usdc");
  const [sendTo, setSendTo] = useState<string>(DEFAULT_SEND_TO);
  const [sendAmount, setSendAmount] = useState(DEFAULT_AMOUNT.usdc);
  const [sending, setSending] = useState(false);
  const [sendHash, setSendHash] = useState<`0x${string}` | undefined>(undefined);
  const [sentInfo, setSentInfo] = useState<{ amount: string; symbol: string; to: string } | null>(
    null,
  );
  const [sendError, setSendError] = useState("");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [ethBalance, setEthBalance] = useState("0");

  const loadBalance = useCallback(async () => {
    if (!activeAddress || !publicClient) return;
    try {
      const native = await publicClient.getBalance({ address: activeAddress });
      setEthBalance(formatEther(native));
    } catch {
      /* keep last known */
    }
    if (!usdcAddress) {
      setUsdcBalance("0");
      return;
    }
    try {
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [activeAddress],
      });
      setUsdcBalance(formatUnits(balance, 6));
    } catch {
      /* keep last known */
    }
  }, [activeAddress, publicClient, usdcAddress]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const switchAsset = (next: SendAsset) => {
    setAsset(next);
    setSendAmount(DEFAULT_AMOUNT[next]);
    setSendHash(undefined);
    setSendError("");
  };

  // When the user taps an asset in the top navbar, jump to the send step with
  // that asset preselected.
  useEffect(() => {
    if (!sendFocusRequest) return;
    if (sendFocusAsset) {
      setAsset(sendFocusAsset);
      setSendAmount(DEFAULT_AMOUNT[sendFocusAsset]);
    }
    requestAnimationFrame(() => {
      document
        .getElementById("sign-send")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [sendFocusRequest, sendFocusAsset]);

  const handleSignMessage = () => {
    resetMessage();
    if (!hasUsableAddress) return;
    signMessage({ message });
  };

  const handleSignTypedData = () => {
    resetTypedData();
    setTypedDataParseError("");
    if (!hasUsableAddress) return;
    try {
      const parsed = JSON.parse(typedDataJson);
      signTypedData(parsed);
    } catch {
      setTypedDataParseError("That isn't valid JSON. Fix it or load the sample.");
    }
  };

  const handleSend = async () => {
    setSendError("");
    setSendHash(undefined);
    setSentInfo(null);
    if (!hasUsableAddress || !activeAddress) {
      setSendError("Please authenticate first.");
      return;
    }
    if (!chain?.id) {
      setSendError("Wallet network isn't ready.");
      return;
    }
    if (asset === "usdc" && !usdcAddress) {
      setSendError("Sending USDC isn't available on this network.");
      return;
    }
    const to = sendTo.trim();
    if (!isAddress(to)) {
      setSendError("Enter a valid recipient address.");
      return;
    }
    let amountRaw: bigint;
    try {
      amountRaw = asset === "usdc" ? parseUnits(sendAmount || "0", 6) : parseEther(sendAmount || "0");
    } catch {
      amountRaw = BigInt(0);
    }
    if (amountRaw <= BigInt(0)) {
      setSendError("Enter an amount greater than 0.");
      return;
    }

    setSending(true);
    try {
      const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig));
      const kernelClient = store.getState().kernelClients.get(chain.id);
      if (!kernelClient) {
        throw new Error("Smart account client isn't ready. Reconnect and try again.");
      }
      const call =
        asset === "usdc"
          ? {
              to: usdcAddress!,
              value: BigInt(0),
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [getAddress(to), amountRaw],
              }),
            }
          : { to: getAddress(to), value: amountRaw, data: "0x" as const };
      const hash = await kernelClient.sendTransaction({ calls: [call] });
      setSentInfo({
        amount: sendAmount,
        symbol: asset === "usdc" ? "USDC" : "ETH",
        to: getAddress(to),
      });
      setSendHash(hash);
      await loadBalance();
    } catch (err) {
      setSendError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const assetSymbol = asset === "usdc" ? "USDC" : "ETH";
  const balanceNumber = Number(asset === "usdc" ? usdcBalance : ethBalance) || 0;
  const ethFaucetUrl = (chain?.id ? ETH_FAUCET_BY_CHAIN[chain.id] : undefined) ??
    ETH_FAUCET_BY_CHAIN[421614];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">Sign anything</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Your smart wallet signs like any wallet — a plain message, structured typed data, and
          a real asset transfer. Walk through each below.
        </p>
      </div>

      {/* Step 1 — personal sign */}
      <StepCard step={1} title="Sign a plain message">
        <p className="text-sm text-gray-600">
          A <span className="font-mono">personal_sign</span> over any text — edit it to whatever
          you like.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          spellCheck={false}
          placeholder="Type a message to sign..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-950 outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={handleSignMessage}
          disabled={signingMessage || !message.trim() || !hasUsableAddress}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingMessage ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <FileSignature className="h-4 w-4" />
              Sign message
            </>
          )}
        </button>
        {messageError && <ErrorNote message={getErrorMessage(messageError)} />}
        {messageSignature && (
          <SignatureResult label="Signature" value={messageSignature} />
        )}
      </StepCard>

      {/* Step 2 — typed data */}
      <StepCard step={2} title="Sign structured data (EIP-712)">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Human-readable typed data — what dapps use for orders, permits, and logins.
          </p>
          <button
            type="button"
            onClick={() => {
              setTypedDataJson(sampleTypedDataJson);
              setTypedDataParseError("");
            }}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Reset sample
          </button>
        </div>
        <textarea
          value={typedDataJson}
          onChange={(e) => setTypedDataJson(e.target.value)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-950 outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={handleSignTypedData}
          disabled={signingTypedData || !typedDataJson.trim() || !hasUsableAddress}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingTypedData ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <FileSignature className="h-4 w-4" />
              Sign typed data
            </>
          )}
        </button>
        {(typedDataParseError || typedDataError) && (
          <ErrorNote message={typedDataParseError || getErrorMessage(typedDataError)} />
        )}
        {typedDataSignature && (
          <SignatureResult label="Signature" value={typedDataSignature} />
        )}
      </StepCard>

      {/* Step 3 — send assets */}
      <StepCard step={3} title="Sign to send assets" id="sign-send">
        <p className="text-sm text-gray-600">
          Same signature, real money: move USDC or native ETH to any address — gas sponsored.
        </p>

        {/* Asset toggle */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["usdc", "eth"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => switchAsset(a)}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                asset === a
                  ? "bg-white text-gray-950 shadow-sm"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              {a === "usdc" ? "USDC" : "Native ETH"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Wallet className="h-4 w-4 text-gray-500" />
            Your {assetSymbol}
          </span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-gray-950">
              {asset === "usdc" ? balanceNumber.toFixed(2) : balanceNumber.toFixed(5)} {assetSymbol}
            </span>
            <FaucetLink
              href={asset === "usdc" ? USDC_FAUCET_URL : ethFaucetUrl}
              address={activeAddress}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            >
              Faucet
              <ExternalLink className="h-3 w-3" />
            </FaucetLink>
          </span>
        </div>

        {asset === "usdc" && !usdcAddress ? (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              USDC isn&apos;t available on {chain?.name ?? "this network"}. Switch to Arbitrum
              Sepolia or Ethereum Sepolia, or send native ETH instead.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Recipient</span>
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                spellCheck={false}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-950 outline-none focus:border-gray-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">{assetSymbol} amount</span>
              <input
                type="number"
                min="0"
                step={asset === "usdc" ? "0.01" : "0.0001"}
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-950 outline-none focus:border-gray-400"
              />
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (asset === "usdc" && !usdcAddress) || !hasUsableAddress}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send {sendAmount || "0"} {assetSymbol}
            </>
          )}
        </button>
        {sendError && <ErrorNote message={sendError} />}
        {sendHash && (
          <a
            href={`${explorerBaseUrl}/tx/${sendHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 transition-colors hover:bg-emerald-100"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              {sentInfo ? (
                <span className="truncate">
                  Sent {sentInfo.amount} {sentInfo.symbol} to {formatShort(sentInfo.to)}
                </span>
              ) : (
                <span>Sent</span>
              )}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs">
              {formatShort(sendHash)}
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        )}
      </StepCard>
    </div>
  );
}

function StepCard({
  step,
  title,
  children,
  id,
}: {
  step: number
  title: string
  children: ReactNode
  id?: string
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-950 text-xs font-semibold text-white">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <p className="break-words text-sm text-red-700">{message}</p>
    </div>
  );
}

function SignatureResult({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
        <Check className="h-3.5 w-3.5 text-emerald-600" />
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-gray-700">{value}</p>
    </div>
  );
}
