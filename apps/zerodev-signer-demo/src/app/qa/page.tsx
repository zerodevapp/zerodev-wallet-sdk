"use client";

import { useAuthenticators } from "@zerodev/wallet-react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  LogOut,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Address, formatEther, formatUnits, isAddress, parseAbi } from "viem";
import { useAccount, useDisconnect, usePublicClient } from "wagmi";
import { AppHeader } from "../components/AppHeader";
import { ChainSelector } from "../components/ChainSelector";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { TestingLab } from "../components/testing-lab/TestingLab";
import { cn } from "../lib/utils";

export const dynamic = "force-dynamic";

type WalletAsset = "ETH" | "USDC";

const USDC_CONTRACTS: Record<number, `0x${string}`> = {
  [11155111]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [421614]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

function formatAuthMethod(
  authenticators: Awaited<ReturnType<typeof useAuthenticators>>["data"],
) {
  const oauthProvider = authenticators?.oauths?.[0]?.provider;
  if (oauthProvider) {
    return oauthProvider.toLowerCase() === "google"
      ? "Google"
      : oauthProvider.charAt(0).toUpperCase() + oauthProvider.slice(1);
  }
  if (authenticators?.emailContacts?.[0]?.email) return "Email";
  if (authenticators?.passkeys?.length) return "Passkey";
  return "Connected";
}

function EthIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path fill="#627EEA" d="M12 2 5.75 12.35 12 16.05l6.25-3.7L12 2Z" />
      <path fill="#536DD5" d="M12 2v14.05l6.25-3.7L12 2Z" />
      <path fill="#8FA2FF" d="m5.75 13.55 6.25 8.8 6.25-8.8L12 17.25l-6.25-3.7Z" />
      <path fill="#627EEA" d="M12 22.35v-5.1l6.25-3.7-6.25 8.8Z" />
    </svg>
  );
}

function UsdcIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
    >
      <path d="M48 95C73.9574 95 95 73.9574 95 48C95 22.0426 73.9574 1 48 1C22.0426 1 1 22.0426 1 48C1 73.9574 22.0426 95 48 95Z" fill="#0B53BF" />
      <path d="M56.4609 13.7778V19.8291C68.5341 23.4716 77.3759 34.6928 77.3759 47.9997C77.3759 61.3066 68.5341 72.5278 56.4609 76.1703V82.2216C71.8534 78.4616 83.2509 64.5672 83.2509 47.9997C83.2509 31.4322 71.8534 17.5378 56.4609 13.7778Z" fill="white" />
      <path d="M18.625 47.9997C18.625 34.6928 27.4669 23.4716 39.54 19.8291V13.7778C24.1475 17.5378 12.75 31.4322 12.75 47.9997C12.75 64.5672 24.1475 78.4616 39.54 82.2216V76.1703C27.4669 72.5572 18.625 61.3066 18.625 47.9997Z" fill="white" />
      <path d="M60.6319 54.5506C60.6319 42.5362 41.8025 47.4713 41.8025 40.8325C41.8025 38.4531 43.7119 36.9256 47.3544 36.9256C51.7019 36.9256 53.2 39.0406 53.67 41.89H59.6625C59.1279 36.5426 56.0588 33.1662 50.9382 32.1604V27.4375H45.0632V31.9918C39.4534 32.7062 35.9275 35.973 35.9275 40.8325C35.9275 52.9056 54.7863 48.3819 54.7863 54.9031C54.7863 57.3706 52.4069 59.0156 48.3825 59.0156C43.1244 59.0156 41.3913 56.695 40.745 53.4931H34.8994C35.2781 59.3502 38.8897 63.0159 45.0632 63.9307V68.5625H50.9382V63.9923C56.9633 63.2139 60.6319 59.7089 60.6319 54.5506Z" fill="white" />
    </svg>
  );
}

/**
 * QA Lab route — a focused surface for stress-testing the SDK's request queue
 * and characterizing provider behavior. Reuses the dashboard's "Your Smart
 * Wallet" card so balances are visible next to the test cases, and renders the
 * Testing Lab below it.
 */
export default function QaPage() {
  const router = useRouter();
  const [selectedAsset, setSelectedAsset] = useState<WalletAsset>("ETH");
  const [balance, setBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBalanceRefreshing, setIsBalanceRefreshing] = useState(false);

  const { address, status, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { disconnectAsync: logout } = useDisconnect();
  const { data: authenticatorData } = useAuthenticators({});
  const authMethodLabel = formatAuthMethod(authenticatorData);
  const walletExplorerUrl =
    address && chain?.blockExplorers?.default?.url
      ? `${chain.blockExplorers.default.url}/address/${address}`
      : undefined;

  useEffect(() => {
    if (localStorage.getItem("zd:loggedOut") === "true") {
      window.location.replace("/");
    }
  }, [router]);

  const loadBalances = useCallback(async () => {
    if (!address || !isAddress(address) || !publicClient) return;

    setIsBalanceRefreshing(true);
    try {
      const balanceWei = await publicClient.getBalance({
        address: address as Address,
      });
      setBalance(formatEther(balanceWei));
      const usdcContractAddress = chain?.id
        ? USDC_CONTRACTS[chain.id]
        : undefined;
      if (usdcContractAddress) {
        const tokenBalance = await publicClient.readContract({
          address: usdcContractAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [address as Address],
        });
        setUsdcBalance(formatUnits(tokenBalance, 6));
      } else {
        setUsdcBalance("0");
      }
    } catch (err) {
      console.error("QA: Failed to load balance:", err);
      setBalance("0");
      setUsdcBalance("0");
    } finally {
      setIsBalanceRefreshing(false);
    }
  }, [address, chain, publicClient]);

  useEffect(() => {
    loadBalances();
    const interval = window.setInterval(() => {
      loadBalances();
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [loadBalances]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      localStorage.setItem("zd:loggedOut", "true");
      window.location.assign("/");
    }
  };

  // Redirect to login if disconnected (session expired), mirroring the
  // dashboard so a signed-out user can't sit on the QA page.
  const [hasConnected, setHasConnected] = useState(false);
  useEffect(() => {
    if (status === "connected") setHasConnected(true);
  }, [status]);
  useEffect(() => {
    if (status === "disconnected" && hasConnected) {
      const loggedOut = localStorage.getItem("zd:loggedOut") === "true";
      router.replace(loggedOut ? "/" : "/?session_expired=true");
    }
  }, [status, hasConnected, router]);

  if (
    isLoggingOut ||
    status === "disconnected" ||
    status === "connecting" ||
    status === "reconnecting" ||
    !address
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#9c958c]" />
          <span className="text-sm text-[var(--muted)]">
            {status === "reconnecting" ? "Reconnecting..." : "Loading wallet..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ExportWalletModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      <div className="min-h-screen">
        <AppHeader />

        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Disclaimer */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 sm:mb-6">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm leading-6">
              <span className="font-semibold">
                Tx signing (the review popup) isn&apos;t released yet.
              </span>{" "}
              It&apos;s disabled here, so every QA-lab call runs in{" "}
              <span className="font-semibold">background mode</span>. The
              underlying methods still execute against the wallet, but these test
              cases are meant for verifying the confirmation UI once tx signing
              actually ships — until then, the UI behaviour can&apos;t be
              verified.
            </p>
          </div>

          {/* Wallet Card */}
          <div className="mb-4 rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:mb-6 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[var(--ink)]" />
                <h1 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">
                  Your Smart Wallet
                </h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Created with {authMethodLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ChainSelector className="h-9 rounded-full px-3 text-xs" />
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
                  title="Export keys"
                >
                  <Key className="h-3.5 w-3.5" />
                  Export keys
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--border-warm)] pt-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-warm)] bg-white shadow-sm">
                    {selectedAsset === "ETH" ? <EthIcon /> : <UsdcIcon />}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-[var(--font-dm-sans)] text-3xl font-bold leading-none text-[var(--ink)]">
                      {selectedAsset === "ETH"
                        ? parseFloat(balance).toFixed(4)
                        : parseFloat(usdcBalance).toFixed(2)}
                    </span>
                    <span className="text-lg font-medium text-[var(--muted)]">
                      {selectedAsset}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={loadBalances}
                    disabled={isBalanceRefreshing}
                    className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-warm)] bg-white text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                    title="Refresh balances"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", isBalanceRefreshing && "animate-spin")}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--border-warm)] bg-[var(--surface-warm)] p-1">
                  {(["ETH", "USDC"] as const).map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => setSelectedAsset(asset)}
                      className={cn(
                        "h-7 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer",
                        selectedAsset === asset
                          ? "bg-white text-[var(--ink)] shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--ink)]",
                      )}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Gas sponsored
                </div>
              </div>
            </div>

            <div className="mt-4 flex min-w-0 items-center justify-center gap-2">
              <p className="min-w-0 truncate text-center font-mono text-sm font-semibold text-[var(--ink)]">
                {address}
              </p>
              <button
                onClick={handleCopy}
                className="shrink-0 cursor-pointer text-[#423a32] transition-colors hover:text-[var(--ink)]"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              {walletExplorerUrl && (
                <a
                  href={walletExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[#423a32] transition-colors hover:text-[var(--ink)]"
                  title="View wallet on explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Testing Lab */}
          <TestingLab />
        </div>
      </div>
    </>
  );
}
