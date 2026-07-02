"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticators } from "@zerodev/wallet-react";
import {
  Check,
  Copy,
  FileSignature,
  Key,
  Loader2,
  LogOut,
  Send,
  Sparkles,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Address, formatEther, formatUnits, isAddress, parseAbi } from "viem";
import { useAccount, useDisconnect, usePublicClient } from "wagmi";
import { ChainSelector } from "../components/ChainSelector";
import { AppHeader } from "../components/AppHeader";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { SendTransactionTest } from "../components/SendTransactionTest";
import { SigningTest } from "../components/SigningTest";
import { submitToHubSpot } from "../lib/hubspot";
import { cn } from "../lib/utils";

export const dynamic = 'force-dynamic';

type ActiveTab = "signing" | "mint" | "send";
type BatchAsset = "ETH" | "USDC";

const tabs = [
  { id: "mint" as const, name: "Gas-free Mint", icon: Sparkles },
  { id: "signing" as const, name: "Sign Anything", icon: FileSignature },
  { id: "send" as const, name: "Batch Transactions", icon: Send },
];

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
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
    >
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
      width="96"
      height="96"
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

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("mint");
  const [selectedAsset, setSelectedAsset] = useState<BatchAsset>("ETH");
  const [balance, setBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [gaslessTxCount, setGaslessTxCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Wagmi hooks
  const { address, status, chain, } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { disconnectAsync: logout } = useDisconnect();
  const { data: authenticatorData, isLoading: isAuthenticatorDataLoading } = useAuthenticators({})
  const authMethodLabel = formatAuthMethod(authenticatorData);

  useEffect(() => {
    if (localStorage.getItem("zd:loggedOut") === "true") {
      setIsLoggingOut(true);
      router.replace("/");
    }
  }, [router]);

  useQuery(
    {
      queryKey: ["submitMarketingConsent", authenticatorData?.emailContacts?.[0]?.email],
      queryFn: async () => {
        const email = authenticatorData?.emailContacts?.[0]?.email
        if (!email) {
          return null;
        }

        await submitToHubSpot(email, true)
        return true
      },
      enabled: !!authenticatorData?.emailContacts?.[0]?.email && !isAuthenticatorDataLoading,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    }
  )

  useEffect(() => {
    const loadBalance = async () => {
      if (address && isAddress(address)) {
        try {
          if (!publicClient) return;
          const balanceWei = await publicClient.getBalance({ address: address as Address });
          setBalance(formatEther(balanceWei));
          const usdcContractAddress = chain?.id ? USDC_CONTRACTS[chain.id] : undefined;
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
          console.error("Dashboard: Failed to load balance:", err);
          setBalance("0");
          setUsdcBalance("0");
        }
      }
    };
    loadBalance();
  }, [address, chain, publicClient]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    localStorage.setItem("zd:loggedOut", "true");
    router.replace("/");
    await logout();
  };

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Redirect to login if disconnected (session expired)
  // Use a delay to avoid redirecting during initial reconnection
  const [hasConnected, setHasConnected] = useState(false);
  useEffect(() => {
    if (status === 'connected') {
      setHasConnected(true);
    }
  }, [status]);
  useEffect(() => {
    if (status === 'disconnected' && hasConnected) {
      const loggedOut = localStorage.getItem("zd:loggedOut") === "true";
      router.replace(loggedOut ? "/" : "/?session_expired=true");
    }
  }, [status, hasConnected, router]);

  // Show loading while connecting or reconnecting
  if (isLoggingOut || status === 'disconnected') {
    return null;
  }

  if (status === 'connecting' || status === 'reconnecting' || !address) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-600">
            {status === 'reconnecting' ? 'Reconnecting...' : 'Loading wallet...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ExportWalletModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <div className="min-h-screen bg-white">
        <AppHeader />

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Wallet Card */}
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 sm:mb-6 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-gray-700" />
                <h1 className="text-lg font-semibold text-gray-900">Your Smart Wallet</h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Created with {authMethodLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ChainSelector className="h-9 rounded-full px-3 text-xs" />
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer"
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

            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white shadow-sm">
                    {selectedAsset === "ETH" ? <EthIcon /> : <UsdcIcon />}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold leading-none text-gray-900">
                      {selectedAsset === "ETH" ? parseFloat(balance).toFixed(4) : parseFloat(usdcBalance).toFixed(2)}
                    </span>
                    <span className="text-lg text-gray-500 font-medium">{selectedAsset}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-full border border-gray-200 bg-gray-100 p-1">
                  {(["ETH", "USDC"] as const).map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => setSelectedAsset(asset)}
                      className={cn(
                        "h-7 rounded-full px-3 text-xs font-semibold transition-colors cursor-pointer",
                        selectedAsset === asset
                          ? "bg-white text-gray-950 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  {gaslessTxCount} gasless {gaslessTxCount === 1 ? "tx" : "txs"} this session
                </div>
              </div>
            </div>

            <div className="mt-4 flex min-w-0 items-center justify-center gap-2">
                  <p className="min-w-0 truncate text-center font-mono text-sm font-semibold text-gray-900">
                    {address}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 text-gray-700 transition-colors hover:text-gray-950 cursor-pointer"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50">
              <nav className="grid grid-cols-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex h-14 items-center justify-center gap-1.5 border-b-2 px-2 text-xs font-semibold transition-all duration-200 cursor-pointer sm:gap-2 sm:px-4 sm:text-sm",
                        isActive
                          ? "border-gray-950 bg-white text-gray-950"
                          : "border-transparent text-gray-500 hover:bg-white hover:text-gray-800"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="min-h-[360px] p-4 sm:min-h-[420px] sm:p-6 lg:p-8">
              <div
                key={activeTab}
                className="motion-safe:animate-[tab-panel-enter_180ms_ease-out]"
              >
              {activeTab === "signing" && <SigningTest />}
              {activeTab === "mint" && (
                <SendTransactionTest
                  mode="mint-nft"
                  onGaslessTransaction={() => setGaslessTxCount((count) => count + 1)}
                />
              )}
              {activeTab === "send" && (
                <SendTransactionTest
                  mode="send-eth"
                  batchAsset={selectedAsset}
                  onBatchAssetChange={setSelectedAsset}
                  onGaslessTransaction={() => setGaslessTxCount((count) => count + 1)}
                />
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
