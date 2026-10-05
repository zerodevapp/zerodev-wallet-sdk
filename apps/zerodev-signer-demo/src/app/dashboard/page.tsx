"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticators } from "@zerodev/wallet-react";
import {
  ConnectWallet,
  SignUp,
  TxHistory,
  useAuth,
  useSolanaAccount,
  useSolanaAutoReconnect,
} from "@zerodev/wallet-react-ui";
import {
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  History,
  Key,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  Sparkles,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Address, formatEther, formatUnits, isAddress, parseAbi } from "viem";
import { useAccount, useConnect, useDisconnect, usePublicClient } from "wagmi";
import { ChainSelector } from "../components/ChainSelector";
import { AppHeader } from "../components/AppHeader";
import { SolanaAccountStrip } from "../components/SolanaAccountStrip";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { SendTransactionTest } from "../components/SendTransactionTest";
import { SigningTest } from "../components/SigningTest";
import { submitToHubSpot } from "../lib/hubspot";
import { cn } from "../lib/utils";

export const dynamic = 'force-dynamic';

// Transaction history is still under development — only surfaced in local
// dev (`next dev`). NODE_ENV is inlined at build time, so production builds
// drop the button and modal entirely.
const HISTORY_ENABLED = process.env.NODE_ENV === "development";

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
  const [copied, setCopied] = useState<"evm" | "solana" | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [gaslessTxCount, setGaslessTxCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBalanceRefreshing, setIsBalanceRefreshing] = useState(false);

  // Wagmi hooks
  const { address, status, chain, } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { disconnectAsync: logout } = useDisconnect();
  // Solana PoC: one Logout clears both namespaces, and a connected Solana
  // wallet keeps the dashboard open with a Solana-only view when the EVM side
  // is signed out.
  const solana = useSolanaAccount();
  const { disconnect: disconnectSolana } = solana;
  const solanaConnected = solana.isConnected;
  useSolanaAutoReconnect();
  // Solana-only state: let the user add an EVM wallet from the dashboard. The
  // kit connector's connect() opens the sign-up flow (passkey, Google, email,
  // installed EVM wallets); an external wallet picked there connects through
  // wagmi and the full dashboard takes over.
  const { connect: connectEvm, connectors } = useConnect();
  const { step: authStep } = useAuth();
  const [evmConnectRequested, setEvmConnectRequested] = useState(false);
  const openEvmConnect = () => {
    const kitConnector = connectors.find((c) => c.id === "zerodev-wallet");
    if (!kitConnector) return;
    setEvmConnectRequested(true);
    connectEvm({ connector: kitConnector });
  };
  const { data: authenticatorData, isLoading: isAuthenticatorDataLoading } = useAuthenticators({})
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

  const loadBalances = useCallback(async () => {
    if (!address || !isAddress(address) || !publicClient) return;

    setIsBalanceRefreshing(true);
    try {
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

  const handleCopy = async (network: "evm" | "solana", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(network);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await Promise.allSettled([logout(), disconnectSolana()]);
    } finally {
      localStorage.setItem("zd:loggedOut", "true");
      window.location.assign("/");
    }
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
    if (status === 'disconnected' && hasConnected && !solanaConnected) {
      const loggedOut = localStorage.getItem("zd:loggedOut") === "true";
      router.replace(loggedOut ? "/" : "/?session_expired=true");
    }
  }, [status, hasConnected, solanaConnected, router]);

  useEffect(() => {
    if (status !== 'disconnected' || isLoggingOut || solanaConnected) return;

    const timeout = window.setTimeout(() => {
      const loggedOut = localStorage.getItem("zd:loggedOut") === "true";
      window.location.replace(loggedOut ? "/" : "/?session_expired=true");
    }, 750);

    return () => window.clearTimeout(timeout);
  }, [status, isLoggingOut, solanaConnected]);

  // Solana PoC: no EVM session, but a Solana wallet is connected. The EVM
  // features below need an EVM account, so show the Solana side on its own.
  // Stays mounted while an EVM connect is in flight (`connecting`): the
  // sign-up overlay that completes it lives here.
  if (
    !isLoggingOut &&
    !address &&
    solanaConnected &&
    (status === 'disconnected' || status === 'connecting')
  ) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <SolanaAccountStrip showDisconnect={false} />
          </div>
          <div className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[var(--ink)]" />
                <h1 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">
                  Signed in with a Solana wallet
                </h1>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-warm)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-warm)]"
              >
                Logout
              </button>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Your Solana wallet is connected. The gas sponsorship, batching and
              signing demos run on an EVM smart account, so connect an EVM
              wallet to unlock them — both stay connected side by side.
            </p>
            <button
              type="button"
              onClick={openEvmConnect}
              data-testid="connect-evm-button"
              className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2a1c13]"
            >
              Connect an EVM wallet
            </button>
          </div>
          {/* Same signing card as the EVM dashboard: the EVM button stays
              disabled until an EVM wallet is connected. */}
          <div className="mt-4 rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:mt-6 sm:p-5 lg:p-6">
            <SigningTest />
          </div>
        </div>
        {evmConnectRequested && authStep !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <ConnectWallet
              size="md"
              onClose={() => setEvmConnectRequested(false)}
              renderSignUp={() => (
                <SignUp>
                  <SignUp.Passkey />
                  <SignUp.Divider />
                  <SignUp.Google />
                  <SignUp.Email />
                  <SignUp.Divider label="or an EVM wallet" />
                  <SignUp.InstalledWallets />
                  <SignUp.WalletConnect />
                </SignUp>
              )}
            />
          </div>
        )}
      </div>
    );
  }

  if (isLoggingOut || status === 'disconnected' || status === 'connecting' || status === 'reconnecting' || !address) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#9c958c]" />
          <span className="text-sm text-[var(--muted)]">
            {status === 'reconnecting' ? 'Reconnecting...' : 'Loading wallet...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ExportWalletModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      {HISTORY_ENABLED && showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <TxHistory onClose={() => setShowHistory(false)} />
        </div>
      )}
      <div className="min-h-screen">
        <AppHeader />

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Wallet Card */}
          <div className="mb-4 rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:mb-6 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[var(--ink)]" />
                <h1 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">Your Smart Wallet</h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Created with {authMethodLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ChainSelector className="h-9 rounded-full px-3 text-xs" />
                {HISTORY_ENABLED && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
                    title="Transaction history"
                  >
                    <History className="h-3.5 w-3.5" />
                    History
                  </button>
                )}
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
                      {selectedAsset === "ETH" ? parseFloat(balance).toFixed(4) : parseFloat(usdcBalance).toFixed(2)}
                    </span>
                    <span className="text-lg font-medium text-[var(--muted)]">{selectedAsset}</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadBalances}
                    disabled={isBalanceRefreshing}
                    className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-warm)] bg-white text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                    title="Refresh balances"
                  >
                    <RefreshCw className={cn("h-4 w-4", isBalanceRefreshing && "animate-spin")} />
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
                          : "text-[var(--muted)] hover:text-[var(--ink)]"
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

            {/* One address per connected network. A multichain wallet
                (MetaMask, Phantom) can authorise the EVM and Solana sides
                in one prompt, so both can show here; the Solana row is
                hidden while that slot is disconnected. */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {[
                {
                  network: "evm" as const,
                  label: chain?.name ?? "EVM",
                  value: address,
                  explorerUrl: walletExplorerUrl,
                  badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
                },
                {
                  network: "solana" as const,
                  label: "Solana",
                  value: solanaConnected ? solana.address : undefined,
                  explorerUrl: solana.address
                    ? `https://explorer.solana.com/address/${solana.address}`
                    : undefined,
                  badgeClass: "border-[#cdeedb] bg-[#e9f7ef] text-[#1f7a4d]",
                },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div
                    key={row.network}
                    data-testid={`${row.network}-address`}
                    className="flex min-w-0 max-w-full items-center justify-center gap-2"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        row.badgeClass
                      )}
                    >
                      {row.label}
                    </span>
                    <p
                      className="min-w-0 truncate font-mono text-sm font-semibold text-[var(--ink)]"
                      title={row.value}
                    >
                      {row.value}
                    </p>
                    <button
                      onClick={() => row.value && handleCopy(row.network, row.value)}
                      className="shrink-0 cursor-pointer text-[#423a32] transition-colors hover:text-[var(--ink)]"
                      title={`Copy ${row.label} address`}
                    >
                      {copied === row.network ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {row.explorerUrl && (
                      <a
                        href={row.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[#423a32] transition-colors hover:text-[var(--ink)]"
                        title={`View ${row.label} address on explorer`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white">
            <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)]">
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
                          ? "border-[var(--ink)] bg-white text-[var(--ink)]"
                          : "border-transparent text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"
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
