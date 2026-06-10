/* eslint-disable @next/next/no-img-element */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticators } from "@zerodev/wallet-react";
import { SignatureRequest } from "@zerodev/wallet-react-kit";
import {
  Check,
  Copy,
  FileSignature,
  Key,
  Loader2,
  Send,
  Upload,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Address, formatEther, isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ExportPrivateKeyModal } from "../components/ExportPrivateKeyModal";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { SendTransactionTest } from "../components/SendTransactionTest";
import { SigningTest } from "../components/SigningTest";
import { submitToHubSpot } from "../lib/hubspot";
import { cn } from "../lib/utils";

export const dynamic = 'force-dynamic';

type ActiveTab = "signing" | "transaction";

const tabs = [
  { id: "signing" as const, name: "Sign Message", icon: FileSignature },
  { id: "transaction" as const, name: "Send Transaction", icon: Send },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("transaction");
  const [balance, setBalance] = useState<string>("0");
  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportPrivateKeyModal, setShowExportPrivateKeyModal] = useState(false);
  // Toggle for whether SignatureRequest is mounted. When mounted, the kit
  // gates signing calls on user confirmation; when not, calls go through
  // silently (background mode). Default off; persisted in localStorage.
  const [confirmationEnabled, setConfirmationEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("zd:signingConfirmation") === "true";
  });

  useEffect(() => {
    localStorage.setItem(
      "zd:signingConfirmation",
      String(confirmationEnabled),
    );
  }, [confirmationEnabled]);

  // Wagmi hooks
  const { address, status, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { data: authenticatorData, isLoading: isAuthenticatorDataLoading } = useAuthenticators({})

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
        } catch (err) {
          console.error("Dashboard: Failed to load balance:", err);
          setBalance("0");
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
      router.push("/?session_expired=true");
    }
  }, [status, hasConnected, router]);

  // Show loading while connecting or reconnecting
  if (status === 'connecting' || status === 'reconnecting' || status === 'disconnected' || !address) {
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
      <ExportPrivateKeyModal isOpen={showExportPrivateKeyModal} onClose={() => setShowExportPrivateKeyModal(false)} />
      {confirmationEnabled && (
        <SignatureRequest className='fixed inset-0 z-50 sm:absolute sm:inset-auto sm:right-2 sm:top-18 sm:w-[400px] sm:h-[600px]' />
      )}
      <div className="min-h-screen bg-white">
        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Wallet Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-gray-700" />
                <h1 className="text-lg font-semibold text-gray-900">Default Wallet</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    "border border-gray-200 text-gray-700 hover:bg-gray-50",
                    "flex items-center gap-2"
                  )}
                  title="Export Seed Phrase"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Seed Phrase</span>
                </button>
                <button
                  onClick={() => setShowExportPrivateKeyModal(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    "border border-gray-200 text-gray-700 hover:bg-gray-50",
                    "flex items-center gap-2"
                  )}
                  title="Export Private Key"
                >
                  <Key className="h-4 w-4" />
                  <span className="hidden sm:inline">Private Key</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <span className="font-mono text-xs sm:text-sm break-all">{address}</span>
              <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{parseFloat(balance).toFixed(4)}</span>
              <span className="text-lg text-gray-500 font-medium">ETH</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{chain?.name} Testnet</p>
            <label className="mt-3 flex items-center gap-2 cursor-pointer text-sm leading-none">
              <input
                type="checkbox"
                checked={confirmationEnabled}
                onChange={(e) => setConfirmationEnabled(e.target.checked)}
                className="h-3 w-3 m-0"
              />
              <span className="text-gray-700">Show transaction review</span>
            </label>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer",
                        isActive
                          ? "text-gray-900 underline decoration-2 decoration-blue-600 underline-offset-8"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              {activeTab === "signing" && <SigningTest />}
              {activeTab === "transaction" && <SendTransactionTest />}
            </div>
          </div>
        </div>

        {/* GitHub Footer */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 text-center">
          <a
            href="https://github.com/zerodevapp/zerodev-wallet-sdk/tree/main/apps/zerodev-signer-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            View source on GitHub
          </a>
        </div>
      </div>
    </>
  );
}
