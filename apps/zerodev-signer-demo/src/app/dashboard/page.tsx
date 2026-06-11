/* eslint-disable @next/next/no-img-element */
"use client";

import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from "@zerodev/wallet-react";
import { SignatureRequest } from "@zerodev/wallet-react-kit";
import {
  ArrowRight,
  AlertTriangle,
  Check,
  Copy,
  Coins,
  Component,
  ChevronDown,
  ExternalLink,
  Fuel,
  ImageIcon,
  Key,
  Loader2,
  LogOut,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Address, formatEther, formatUnits, isAddress, zeroAddress } from "viem";
import { useAccount, useConfig, useDisconnect, usePublicClient } from "wagmi";
import { ChainSelector } from "../components/ChainSelector";
import { ExportPrivateKeyModal } from "../components/ExportPrivateKeyModal";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { LogoutOverlay } from "../components/LogoutOverlay";
import { SendTransactionTest } from "../components/SendTransactionTest";
import { SigningTest } from "../components/SigningTest";
import { cn } from "../lib/utils";

export const dynamic = 'force-dynamic';

type ExperienceId =
  | "transact"
  | "stables"
  | "sign"
  | "export"
  | "customize";

const experiences = [
  {
    id: "transact" as const,
    title: "Mint without gas",
    description: "Mint an NFT even when the wallet holds no native ETH.",
    icon: Fuel,
  },
  {
    id: "stables" as const,
    title: "Use stables without gas",
    description: "Let users operate with stablecoins instead of requiring native gas.",
    icon: Coins,
  },
  {
    id: "sign" as const,
    title: "Sign anything",
    description: "Review and sign messages, typed data, and app requests.",
    icon: ShieldCheck,
  },
  {
    id: "export" as const,
    title: "Own and export keys",
    description: "Show that the wallet is non-custodial and user-owned.",
    icon: Key,
  },
  {
    id: "customize" as const,
    title: "Customize the flow",
    description: "Start with prebuilt UI, then progressively replace every surface.",
    icon: Component,
  },
];

const usdcContracts: Record<number, Address> = {
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

const tokenMetadata = {
  eth: {
    name: "ETH",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  },
  usdc: {
    name: "USDC",
    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
    faucet: "https://faucet.circle.com/",
  },
};

const ethFaucets: Record<number, string> = {
  421614: "https://faucet.triangleplatform.com/arbitrum/sepolia",
  11155111: "https://faucet.triangleplatform.com/ethereum/sepolia",
};

function isUsableAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value) && value.toLowerCase() !== zeroAddress)
}

function formatShortAddress(value: string) {
  if (!isAddress(value)) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function deleteZeroDevIndexedDbState() {
  if (typeof indexedDB === "undefined") return;

  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  const databases = await indexedDbWithDatabases.databases?.();
  if (!databases) return;

  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => {
        if (!name) return false;
        const normalized = name.toLowerCase();
        return normalized.includes("turnkey") || normalized.includes("zerodev");
      })
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
  );
}

async function clearWalletBrowserState() {
  if (typeof window === "undefined") return;

  const storedSessionKeys = JSON.parse(
    localStorage.getItem("@zerodev/sessions") || "[]",
  ) as unknown;

  const keysToRemove = [
    "zerodev-wallet",
    "zerodev:auth:otpSession",
    "@zerodev/active_session",
    "@zerodev/sessions",
    "wagmi.store",
    "wagmi.recentConnectorId",
    "wagmi.connected",
  ];

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  if (Array.isArray(storedSessionKeys)) {
    for (const key of storedSessionKeys) {
      if (typeof key === "string") localStorage.removeItem(key);
    }
  }

  await deleteZeroDevIndexedDbState();
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeExperience, setActiveExperience] =
    useState<ExperienceId>("transact");
  const [balance, setBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [nftCount, setNftCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showExportPrivateKeyModal, setShowExportPrivateKeyModal] = useState(false);
  const [walletLookupDebug, setWalletLookupDebug] = useState<string | null>(null);
  const [confirmationEnabled, setConfirmationEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("zd:signingConfirmation") === "true";
  });

  // Wagmi hooks
  const { address, status, chain } = useAccount();
  const wagmiConfig = useConfig();
  const { disconnectAsync } = useDisconnect();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const safeAddress = isUsableAddress(address) ? address : null;

  useEffect(() => {
    localStorage.setItem(
      "zd:signingConfirmation",
      String(confirmationEnabled),
    );
  }, [confirmationEnabled]);

  useEffect(() => {
    const loadBalance = async () => {
      if (!safeAddress || !publicClient) {
        setBalance("0");
        return;
      }

      try {
        const balanceWei = await publicClient.getBalance({ address: safeAddress });
        setBalance(formatEther(balanceWei));
      } catch (err) {
        console.error("Dashboard: Failed to load balance:", err);
        setBalance("0");
      }
    };
    loadBalance();
  }, [safeAddress, chain, publicClient]);

  useEffect(() => {
    if (status !== "connected" || safeAddress) {
      setWalletLookupDebug(null);
      return;
    }

    let cancelled = false;

    const inspectWalletLookup = async () => {
      try {
        const connector = getZeroDevConnector(wagmiConfig);
        const store = await getZeroDevStore(connector);
        const wallet = getZeroDevWallet(store);
        const session = await wallet.getSession();

        if (!session) {
          if (!cancelled) setWalletLookupDebug("No active ZeroDev session found.");
          return;
        }

        const response = await wallet.client.getUserWallet({
          organizationId: session.organizationId,
          projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
          token: session.token,
        });

        if (!cancelled) {
          setWalletLookupDebug(
            `user-wallet returned: ${response.walletAddresses.join(", ") || "no wallet addresses"}`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setWalletLookupDebug(
            err instanceof Error ? err.message : "Unable to inspect user-wallet lookup.",
          );
        }
      }
    };

    inspectWalletLookup();

    return () => {
      cancelled = true;
    };
  }, [safeAddress, status, wagmiConfig]);

  useEffect(() => {
    const loadUsdcBalance = async () => {
      if (!safeAddress || !publicClient || !chain?.id) {
        setUsdcBalance("0");
        return;
      }

      const usdcAddress = usdcContracts[chain.id];
      if (!usdcAddress) {
        setUsdcBalance("0");
        return;
      }

      try {
        const rawBalance = await publicClient.readContract({
          address: usdcAddress,
          abi: erc20BalanceAbi,
          functionName: "balanceOf",
          args: [safeAddress],
        });
        setUsdcBalance(formatUnits(rawBalance, 6));
      } catch (err) {
        console.error("Dashboard: Failed to load USDC balance:", err);
        setUsdcBalance("0");
      }
    };

    loadUsdcBalance();
  }, [safeAddress, chain, publicClient]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    localStorage.setItem('zd:loggedOut', 'true');
    try {
      await disconnectAsync();
    } catch {
      setLoggingOut(false);
      return;
    }
    router.push('/?logged_out=true');
  };

  const handleHardReset = async () => {
    setLoggingOut(true);
    localStorage.setItem("zd:loggedOut", "true");
    try {
      await disconnectAsync();
    } catch {
      // Still clear local SDK state if wagmi disconnect cannot complete.
    }
    await clearWalletBrowserState();
    window.location.assign("/?logged_out=true");
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
      if (localStorage.getItem('zd:loggedOut') === 'true') {
        router.push("/?logged_out=true");
        return;
      }
      router.push("/?session_expired=true");
    }
  }, [status, hasConnected, router]);

  // Show loading while connecting or reconnecting
  if (
    status === 'connecting' ||
    status === 'reconnecting' ||
    status === 'disconnected'
  ) {
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

  const serviceIssue =
    address && !safeAddress
      ? walletLookupDebug ?? "Wallet lookup is temporarily unavailable."
      : null;

  return (
    <>
      <LogoutOverlay visible={loggingOut}/>
      <ExportWalletModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <ExportPrivateKeyModal isOpen={showExportPrivateKeyModal} onClose={() => setShowExportPrivateKeyModal(false)} />
      {confirmationEnabled && (
        <SignatureRequest className="fixed inset-0 z-50 sm:absolute sm:inset-auto sm:right-2 sm:top-18 sm:h-[600px] sm:w-[400px]" />
      )}
      <div className="min-h-screen bg-white animate-[dashboard-enter_360ms_ease-out_both]">
        {serviceIssue && (
          <div className="border-b border-red-200 bg-red-50 text-red-950">
            <div className="mx-auto flex min-h-10 max-w-7xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <p className="min-w-0 text-sm font-medium">
                  Service outage: live wallet data is unavailable. Mock values
                  are shown for now; come back later to try the full experience.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-red-300 bg-white px-2.5 text-xs font-semibold text-red-950 transition-colors hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <TryItExperience
            address={safeAddress}
            safeAddress={safeAddress}
            activeExperience={activeExperience}
            balance={balance}
            chainId={chain?.id}
            copied={copied}
            isAddressLoading={false}
            loggingOut={loggingOut}
            confirmationEnabled={confirmationEnabled}
            serviceIssue={serviceIssue}
            nftCount={nftCount}
            usdcBalance={usdcBalance}
            onCopyAddress={handleCopy}
            onSelect={setActiveExperience}
            onExportPrivateKey={() => setShowExportPrivateKeyModal(true)}
            onExportWallet={() => setShowExportModal(true)}
            onLogout={handleLogout}
            onNftCountChange={setNftCount}
            onToggleConfirmation={setConfirmationEnabled}
          />
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

function TryItExperience({
  address,
  safeAddress,
  activeExperience,
  balance,
  chainId,
  copied,
  confirmationEnabled,
  isAddressLoading,
  loggingOut,
  onCopyAddress,
  onSelect,
  onExportPrivateKey,
  onExportWallet,
  onLogout,
  onNftCountChange,
  onToggleConfirmation,
  serviceIssue,
  nftCount,
  usdcBalance,
}: {
  address: Address | null
  safeAddress: Address | null
  activeExperience: ExperienceId
  balance: string
  chainId?: number
  copied: boolean
  confirmationEnabled: boolean
  isAddressLoading: boolean
  loggingOut: boolean
  onCopyAddress: () => void
  onSelect: (id: ExperienceId) => void
  onExportPrivateKey: () => void
  onExportWallet: () => void
  onLogout: () => void
  onNftCountChange: (count: number) => void
  onToggleConfirmation: (enabled: boolean) => void
  serviceIssue: string | null
  nftCount: number
  usdcBalance: string
}) {
  const [walletActionsOpen, setWalletActionsOpen] = useState(false)
  const [walletSettingsOpen, setWalletSettingsOpen] = useState(false)
  const liveWalletAvailable = Boolean(safeAddress)
  const ethAmount = liveWalletAvailable ? parseFloat(balance).toFixed(4) : "0.0000"
  const usdcAmount = liveWalletAvailable ? Number(usdcBalance).toFixed(2) : "0.00"
  const ethFaucet = chainId ? ethFaucets[chainId] : undefined
  const displayAddress =
    address ??
    (serviceIssue
      ? zeroAddress
      : isAddressLoading
        ? "Resolving account..."
        : "Address unavailable")
  const visibleAddress = formatShortAddress(displayAddress)
  const explorerAddress = address ?? (serviceIssue ? zeroAddress : null)

  return (
    <div>
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-5 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
              Wallet playground
            </h2>
            <div className="relative rounded-lg border border-gray-200 bg-gray-50/80 p-1.5">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="shrink-0">
                    <ChainSelector />
                  </div>
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 lg:max-w-[360px]">
                    <span className="text-xs font-medium text-gray-500">Address</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-gray-950">
                      {visibleAddress}
                    </span>
                    {explorerAddress && (
                      <button
                        onClick={() => {
                          if (address) {
                            onCopyAddress()
                            return
                          }
                          navigator.clipboard.writeText(displayAddress).catch(() => {})
                        }}
                        className="shrink-0 text-gray-400 transition-colors hover:text-gray-700 cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {explorerAddress && (
                      <a
                        href={`https://sepolia.arbiscan.io/address/${explorerAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                        title="View on Arbiscan"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setWalletActionsOpen((open) => !open)
                        setWalletSettingsOpen(false)
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
                      aria-expanded={walletActionsOpen}
                    >
                      Actions
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          walletActionsOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {walletActionsOpen && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                        <p className="text-xs font-medium text-gray-500">Wallet actions</p>
                        <div className="mt-2 grid gap-2">
                          <button
                            type="button"
                            onClick={onExportWallet}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
                          >
                            <Key className="h-4 w-4" />
                            Export keys
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelect("transact")}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
                          >
                            <Upload className="h-4 w-4 rotate-90" />
                            Withdraw
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setWalletSettingsOpen((open) => !open)
                        setWalletActionsOpen(false)
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
                      aria-expanded={walletSettingsOpen}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          walletSettingsOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {walletSettingsOpen && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-3">
                          <span>
                            <span className="block text-sm font-semibold text-gray-950">
                              Transaction confirmation
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-gray-500">
                              Show the review UI when wallet operations require signatures.
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={confirmationEnabled}
                            onChange={(event) => onToggleConfirmation(event.target.checked)}
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onLogout}
                    disabled={loggingOut}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 cursor-pointer",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
              <div className="mt-2 flex min-w-0 flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center">
                <span className="shrink-0 text-xs font-medium text-gray-500">
                  Assets
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-2">
                  <CompactWalletMetric
                    faucet={ethFaucet ?? ethFaucets[421614]}
                    icon={tokenMetadata.eth.icon}
                    label="ETH"
                    value={ethAmount}
                    walletAddress={explorerAddress}
                  />
                  <CompactWalletMetric
                    faucet={tokenMetadata.usdc.faucet}
                    icon={tokenMetadata.usdc.icon}
                    label="USDC"
                    value={`$${usdcAmount}`}
                    walletAddress={explorerAddress}
                  />
                  <CompactWalletMetric
                    icon={null}
                    label="NFTs"
                    onClick={() => {
                      onSelect("transact")
                      requestAnimationFrame(() => {
                        document
                          .getElementById("minted-nfts")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      })
	                    }}
	                    value={String(nftCount)}
	                    walletAddress={explorerAddress}
	                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-b-lg lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-gray-200 bg-gray-50 p-3 lg:border-b-0 lg:border-r">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {experiences.map((item) => {
                const Icon = item.icon
                const isActive = activeExperience === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex min-w-[230px] items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200 cursor-pointer lg:min-w-0",
                      isActive
                        ? "translate-x-0 bg-white text-gray-950 shadow-sm ring-1 ring-gray-200 lg:translate-x-1"
                        : "text-gray-600 hover:bg-white hover:text-gray-950",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-semibold leading-6">
                      {item.title}
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="min-h-[560px] p-4 transition-[min-height] duration-300 sm:p-6 lg:p-8">
            <div
              key={activeExperience}
              className="animate-[scenario-panel-enter_260ms_cubic-bezier(0.22,1,0.36,1)_both]"
            >
              <div className="mb-5">
                <p className="max-w-2xl text-base leading-7 text-gray-600">
                  {getScenarioCopy(activeExperience)}
                </p>
              </div>

              <ScenarioPanel
                accountAddress={safeAddress}
                experience={activeExperience}
                onNftCountChange={onNftCountChange}
                onExportPrivateKey={onExportPrivateKey}
                onExportWallet={onExportWallet}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function getScenarioCopy(experience: ExperienceId) {
  switch (experience) {
    case "transact":
      return "A user signs in, receives a smart wallet, and mints an NFT even if the wallet has no native ETH for gas.";
    case "stables":
      return "A user holds a stablecoin and can still complete an onchain action without first learning how to acquire native gas.";
    case "sign":
      return "A developer can use familiar wagmi signing hooks while the kit provides a review layer for messages and typed data.";
    case "export":
      return "The app can prove the wallet is user-owned by letting the user export the seed phrase or account private key.";
    case "customize":
      return "Teams can ship the prebuilt wallet UI first, then progressively replace auth and signing surfaces for enterprise flows.";
  }
}

function CompactWalletMetric({
  faucet,
  icon,
  label,
  onClick,
  value,
  walletAddress,
}: {
  faucet?: string
  icon: string | null
  label: string
  onClick?: () => void
  value: string
  walletAddress: Address | null
}) {
  const content = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-50">
        {icon ? (
          <img alt="" className="h-4 w-4" src={icon} />
        ) : (
          <ImageIcon className="h-4 w-4 text-gray-500" />
        )}
      </span>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="whitespace-nowrap text-sm font-semibold text-gray-950">
        {value}
      </span>
      {faucet && (
        <a
          href={faucet}
          onClick={() => {
            if (walletAddress) {
              navigator.clipboard.writeText(walletAddress).catch(() => {})
            }
          }}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title={`${label} faucet`}
        >
          Faucet
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-gray-100 cursor-pointer"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {content}
    </div>
  )
}

function ScenarioPanel({
  accountAddress,
  experience,
  onNftCountChange,
  onExportPrivateKey,
  onExportWallet,
}: {
  accountAddress: Address | null
  experience: ExperienceId
  onNftCountChange: (count: number) => void
  onExportPrivateKey: () => void
  onExportWallet: () => void
}) {
  if (experience === "transact") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <SendTransactionTest
          accountAddress={accountAddress}
          onNftCountChange={onNftCountChange}
        />
      </div>
    )
  }

  if (experience === "sign") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <SigningTest accountAddress={accountAddress} />
      </div>
    )
  }

  if (experience === "export") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-950">
          Let users prove ownership
        </p>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Export is a trust moment: the wallet is embedded and easy to use,
          but the user can still take their keys with them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportWallet}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Export seed phrase
          </button>
          <button
            type="button"
            onClick={onExportPrivateKey}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            <Key className="h-4 w-4" />
            Export private key
          </button>
        </div>
      </div>
    )
  }

  if (experience === "customize") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-950">
              Custom checkout auth
            </p>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
              White-label
            </span>
          </div>
          <div className="space-y-3">
            <div className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              user@company.com
            </div>
            <button className="flex h-10 w-full items-center justify-center rounded-lg bg-gray-950 text-sm font-semibold text-white">
              Continue with smart wallet
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          The user experience can look native to the app while the wallet
          stack stays integrated underneath.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-950">
            Stablecoin checkout preview
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <MockRow label="User balance" value="25.00 USDC" />
            <MockRow label="Native gas" value="0.0000 ETH" />
            <MockRow label="User pays" value="12.00 USDC" />
            <MockRow label="Gas experience" value="No ETH required" />
          </div>
          <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white">
            Complete mock payment
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          Mock scenario: wire this to a configured ERC-20 paymaster policy when
          the stablecoin route is ready.
        </p>
      </div>
    </div>
  )
}

function MockRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-gray-50 px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-950">{value}</span>
    </div>
  )
}
