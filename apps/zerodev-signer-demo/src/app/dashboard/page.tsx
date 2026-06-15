/* eslint-disable @next/next/no-img-element */
"use client";

import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from "@zerodev/wallet-react";
import { SignatureRequest } from "@zerodev/wallet-react-kit";
import {
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
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Address,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  zeroAddress,
} from "viem";
import { useAccount, useConfig, useDisconnect, usePublicClient } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
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
  // Circle USDC on Arbitrum Sepolia.
  // Source: https://developers.circle.com/stablecoins/usdc-contract-addresses
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  // Circle USDC on Ethereum Sepolia.
  // Source: https://developers.circle.com/stablecoins/usdc-contract-addresses
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

// Arbitrum Sepolia chain id from Arbitrum/Uniswap deployment references.
// Source: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-arbitrum-deployments
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

// Uniswap v3 SwapRouter02 on Arbitrum Sepolia.
// Source: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-arbitrum-deployments
const ARBITRUM_SEPOLIA_SWAP_ROUTER: Address = "0x101F443B4d1b059569D643917553c771E1b9663E";

// WETH9 on Arbitrum Sepolia, used because Uniswap swaps ERC-20s; native ETH
// requires a follow-up WETH.withdraw(...) unwrap.
// Source: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-arbitrum-deployments
const ARBITRUM_SEPOLIA_WETH: Address = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

// Circle's USDC/WETH 0.3% fee tier currently has liquidity on Arbitrum Sepolia.
// Maintenance: if this route fails, re-check getPool(USDC, WETH, fee) on the
// UniswapV3Factory and verify the returned pool has nonzero liquidity.
// Factory source: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-arbitrum-deployments
const ARBITRUM_SEPOLIA_USDC_WETH_FEE = 3000;

const usdcSwapAbi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const wethAbi = parseAbi([
  "function withdraw(uint256 amount) external",
]);

const swapRouterAbi = parseAbi([
  // SwapRouter02 uses IV3SwapRouter.ExactInputSingleParams, which does not
  // include the legacy V3 SwapRouter `deadline` field.
  // Source: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  // Used to keep swap + unwrap atomic: swap WETH into the router, then unwrap
  // and forward native ETH to the wallet inside the same router call.
  // Source: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IMulticallExtended.sol
  "function multicall(bytes[] data) payable returns (bytes[] results)",
  // Source: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IPeripheryPaymentsWithFeeExtended.sol
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
]);

const tokenMetadata = {
  eth: {
    name: "ETH",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
  },
  uni: {
    name: "Uniswap",
    icon: "https://cryptologos.cc/logos/uniswap-uni-logo.svg",
  },
  usdc: {
    name: "USDC",
    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
    // Public Circle testnet faucet. No URL params are relied on here because
    // the faucet UI does not document stable address/network prefill support.
    // Source: https://faucet.circle.com/
    faucet: "https://faucet.circle.com/",
  },
};

const ethFaucets: Record<number, string> = {
  // Paste-address native ETH faucet used for Arbitrum Sepolia test ETH.
  // Maintenance: this intentionally uses Alchemy because Triangle was unreliable
  // and QuickNode/Chainlink require wallet/social steps. Alchemy documents a
  // wallet-address flow with no auth, but still applies eligibility checks.
  // Source: https://www.alchemy.com/faucets/arbitrum-sepolia
  421614: "https://www.alchemy.com/faucets/arbitrum-sepolia",
  // Paste-address native ETH faucet used for Ethereum Sepolia test ETH.
  // Source: https://www.alchemy.com/faucets/ethereum-sepolia
  11155111: "https://www.alchemy.com/faucets/ethereum-sepolia",
};

function isUsableAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value) && value.toLowerCase() !== zeroAddress)
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
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);
  const [nftFocusRequest, setNftFocusRequest] = useState(0);
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

  const loadNativeBalance = useCallback(async () => {
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

  const loadUsdcBalance = useCallback(async () => {
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
  }, [safeAddress, chain, publicClient]);

  const refreshAssets = useCallback(async () => {
    setIsRefreshingAssets(true);
    setAssetsRefreshKey((key) => key + 1);
    try {
      await Promise.all([loadNativeBalance(), loadUsdcBalance()]);
    } finally {
      setIsRefreshingAssets(false);
    }
  }, [loadNativeBalance, loadUsdcBalance]);

  useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshAssets();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [refreshAssets]);

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
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false);
  const [showLoadingRecovery, setShowLoadingRecovery] = useState(false);
  useEffect(() => {
    if (status === 'connected') {
      setHasConnected(true);
      setReconnectTimedOut(false);
      setShowLoadingRecovery(false);
    }
  }, [status]);
  useEffect(() => {
    if (status !== 'disconnected') return;

    const timeout = window.setTimeout(() => {
      if (localStorage.getItem('zd:loggedOut') === 'true') {
        router.push("/?logged_out=true");
        return;
      }
      router.push(hasConnected ? "/?session_expired=true" : "/");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [status, hasConnected, router]);

  useEffect(() => {
    if (status !== 'reconnecting' && status !== 'connecting') {
      setReconnectTimedOut(false);
      setShowLoadingRecovery(false);
      return;
    }

    const recoveryTimeout = window.setTimeout(() => {
      setShowLoadingRecovery(true);
    }, 3500);
    const timeout = window.setTimeout(() => {
      setReconnectTimedOut(true);
    }, 8000);

    return () => {
      window.clearTimeout(recoveryTimeout);
      window.clearTimeout(timeout);
    };
  }, [status]);

  if (reconnectTimedOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-950">
            Wallet session needs a refresh
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            The wallet did not finish reconnecting. Reset the session and sign in again.
          </p>
          <button
            type="button"
            onClick={handleHardReset}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Reset session
          </button>
        </div>
      </div>
    );
  }

  // Show loading while connecting or reconnecting
  if (
    status === 'connecting' ||
    status === 'reconnecting' ||
    status === 'disconnected'
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-3 px-4 text-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="text-sm text-gray-600">
              {status === 'reconnecting' ? 'Reconnecting...' : 'Loading wallet...'}
            </span>
          </div>
          {showLoadingRecovery && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-950">
                Taking longer than expected?
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                Reset the local wallet session and sign in again.
              </p>
              <button
                type="button"
                onClick={handleHardReset}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-gray-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
              >
                Reset session
              </button>
            </div>
          )}
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
        <SignatureRequestOverlay />
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
            assetsRefreshKey={assetsRefreshKey}
            isRefreshingAssets={isRefreshingAssets}
            nftFocusRequest={nftFocusRequest}
            nftCount={nftCount}
            usdcBalance={usdcBalance}
            onCopyAddress={handleCopy}
            onSelect={setActiveExperience}
            onExportPrivateKey={() => setShowExportPrivateKeyModal(true)}
            onExportWallet={() => setShowExportModal(true)}
            onLogout={handleLogout}
            onNftCountChange={setNftCount}
            onRefreshAssets={refreshAssets}
            onRequestNftFocus={() => setNftFocusRequest((request) => request + 1)}
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

function SignatureRequestOverlay() {
  return (
    <SignatureRequest>
      {({ pendingRequest, confirm, reject }) => {
        if (!pendingRequest) return null;

        return (
          <SignatureRequestModal>
            <SignatureRequest
              request={pendingRequest}
              onConfirm={confirm}
              onReject={reject}
              className="h-[min(720px,calc(100vh-48px))] w-full max-w-[430px] overflow-hidden rounded-[2rem] shadow-2xl"
            />
          </SignatureRequestModal>
        );
      }}
    </SignatureRequest>
  );
}

function SignatureRequestModal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-gray-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 flex w-full justify-center">
        {children}
      </div>
    </div>
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
  assetsRefreshKey,
  isRefreshingAssets,
  loggingOut,
  nftFocusRequest,
  onCopyAddress,
  onSelect,
  onExportPrivateKey,
  onExportWallet,
  onLogout,
  onNftCountChange,
  onRefreshAssets,
  onRequestNftFocus,
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
  assetsRefreshKey: number
  isRefreshingAssets: boolean
  loggingOut: boolean
  nftFocusRequest: number
  onCopyAddress: () => void
  onSelect: (id: ExperienceId) => void
  onExportPrivateKey: () => void
  onExportWallet: () => void
  onLogout: () => void
  onNftCountChange: (count: number) => void
  onRefreshAssets: () => void
  onRequestNftFocus: () => void
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
  const explorerAddress = address ?? (serviceIssue ? zeroAddress : null)

  return (
    <div>
      <section className="overflow-hidden rounded-xl border border-white/70 bg-white/75 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="bg-white/55 px-4 pt-5 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
              Wallet playground
            </h2>
            <div className="relative bg-gray-50/80 p-1.5">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="shrink-0">
                    <ChainSelector />
                  </div>
	                  <div className="flex h-10 w-fit max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3">
	                    <span className="text-xs font-medium text-gray-500">Address</span>
	                    <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-gray-950">
	                      {displayAddress}
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
              <div className="mt-2 flex min-w-0 flex-col gap-2 px-1 pb-1 md:flex-row md:items-center">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    Assets
                  </span>
                  <div className="group/refresh relative">
                    <button
                      type="button"
                      onClick={onRefreshAssets}
                      disabled={isRefreshingAssets}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Refresh balances"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          isRefreshingAssets && "animate-spin",
                        )}
                      />
                    </button>
                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm group-hover/refresh:block group-focus-within/refresh:block">
                      Refresh balances
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2">
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
                      onRequestNftFocus()
	                    }}
	                    value={String(nftCount)}
	                    walletAddress={explorerAddress}
	                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid overflow-hidden bg-white/35 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="bg-gray-50/60 p-3 lg:bg-transparent lg:p-0">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
              {experiences.map((item) => {
                const Icon = item.icon
                const isActive = activeExperience === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex min-w-[230px] items-center gap-3 rounded-xl px-4 py-3 text-left transition-[background-color,box-shadow,color] duration-150 cursor-pointer lg:min-w-0 lg:min-h-16",
                      isActive
                        ? "liquid-use-case-tab text-gray-950 lg:-mr-3 lg:rounded-l-none lg:rounded-r-none lg:px-6"
                        : "text-gray-600 hover:bg-white/55 hover:text-gray-950 lg:rounded-none lg:px-6",
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

          <div className="liquid-content-pane min-h-[560px] rounded-tl-xl p-4 transition-[min-height] duration-300 sm:p-6 lg:px-8 lg:pb-8 lg:pt-0">
            <div
              key={activeExperience}
              className="transition-opacity duration-150"
            >
              <div className="mb-5 flex min-h-16 items-center">
                <p className="max-w-2xl text-base leading-7 text-gray-600">
                  {getScenarioCopy(activeExperience)}
                </p>
              </div>

            <ScenarioPanel
              accountAddress={safeAddress}
              assetsRefreshKey={assetsRefreshKey}
              chainId={chainId}
              experience={activeExperience}
              nftFocusRequest={nftFocusRequest}
              onNftCountChange={onNftCountChange}
              onRefreshAssets={onRefreshAssets}
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
        className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white cursor-pointer"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-1.5 py-1">
      {content}
    </div>
  )
}

function formatShortTx(value: `0x${string}`) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function isTransactionHash(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

function toTransactionHash(value: unknown): `0x${string}` | null {
  return typeof value === "string" && isTransactionHash(value) ? value : null
}

function getSwapErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unable to complete the USDC to native ETH flow."

  if (
    message.includes("UserOperation reverted") ||
    message.includes("paymaster") ||
    message.includes("during simulation")
  ) {
    return "This batch was rejected during sponsorship simulation. The wallet can batch approval + swap, but the current gas policy needs to allow the Uniswap router and WETH unwrap calls."
  }

  if (message.toLowerCase().includes("insufficient")) {
    return "You do not have enough USDC for this conversion."
  }

  if (message.toLowerCase().includes("user rejected")) {
    return "Transaction confirmation was rejected."
  }

  return message
}

type StableGasReceipt = {
  hash?: `0x${string}`
  id?: string
  label: string
  simulatedStep?: boolean
}

type StableGasMode = "batch" | "manual"

type StableGasStep = {
  detail: string
  label: string
  token: "eth" | "swap" | "usdc"
  threshold: number
}

const stableGasModes: Array<{
  badge: string
  label: string
  mode: StableGasMode
}> = [
  { mode: "batch", label: "ZeroDev wallet", badge: "Recommended" },
  { mode: "manual", label: "EOA wallet", badge: "Traditional" },
]

const eoaStableGasSteps: StableGasStep[] = [
  { label: "Fund gas", detail: "native ETH required", threshold: 25, token: "eth" },
  { label: "Approve USDC", detail: "allow Uniswap to spend USDC", threshold: 50, token: "usdc" },
  { label: "Swap to WETH", detail: "USDC -> WETH on Uniswap", threshold: 75, token: "swap" },
  { label: "Unwrap to ETH", detail: "WETH -> native wallet ETH", threshold: 100, token: "eth" },
]

const zeroDevStableGasSteps: StableGasStep[] = [
  { label: "Approve USDC", detail: "gas sponsored", threshold: 34, token: "usdc" },
  { label: "Swap to WETH", detail: "gas sponsored on Uniswap", threshold: 67, token: "swap" },
  { label: "Unwrap to ETH", detail: "gas sponsored", threshold: 100, token: "eth" },
]

function StableGasSwapTest({
  accountAddress,
  chainId,
  onRefreshAssets,
}: {
  accountAddress: Address | null
  chainId?: number
  onRefreshAssets: () => void
}) {
  const [amount, setAmount] = useState("1")
  const [executionMode, setExecutionMode] = useState<StableGasMode>("batch")
  const [status, setStatus] = useState<"idle" | "checking" | "swapping" | "complete">("idle")
  const [error, setError] = useState("")
  const [txs, setTxs] = useState<StableGasReceipt[]>([])
  const [availableUsdc, setAvailableUsdc] = useState("0")
  const [receivedEth, setReceivedEth] = useState<string | null>(null)
  const [batchDurationMs, setBatchDurationMs] = useState<number | null>(null)
  const [wethToUnwrap, setWethToUnwrap] = useState<bigint>(BigInt(0))
  const [progressMessage, setProgressMessage] = useState("Ready")
  const [activeCallIndex, setActiveCallIndex] = useState<number | null>(null)
  const runVersionRef = useRef(0)
  const publicClient = usePublicClient({ chainId })
  const wagmiConfig = useConfig()

  const isArbitrumSepolia = chainId === ARBITRUM_SEPOLIA_CHAIN_ID
  const usdcAddress = usdcContracts[ARBITRUM_SEPOLIA_CHAIN_ID]
  let amountIn = BigInt(0)
  try {
    amountIn = amount.trim() ? parseUnits(amount, 6) : BigInt(0)
  } catch {
    amountIn = BigInt(0)
  }
  const isRunning = status !== "idle" && status !== "complete"
  const explorerBaseUrl = "https://sepolia.arbiscan.io"
  const availableUsdcNumber = Math.max(0, Number(availableUsdc) || 0)
  const maxUsdc = Math.max(1, Math.floor(availableUsdcNumber))

  useEffect(() => {
    if (!accountAddress || !publicClient || !isArbitrumSepolia) return

    let cancelled = false
    const loadAvailableUsdc = async () => {
      try {
        const balance = await publicClient.readContract({
          address: usdcAddress,
          abi: erc20BalanceAbi,
          functionName: "balanceOf",
          args: [accountAddress],
        })
        if (!cancelled) setAvailableUsdc(formatUnits(balance, 6))
      } catch {
        if (!cancelled) setAvailableUsdc("0")
      }
    }

    loadAvailableUsdc()
    return () => {
      cancelled = true
    }
  }, [accountAddress, isArbitrumSepolia, publicClient, usdcAddress])

  const updateAmount = (value: string) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      setAmount("1")
      return
    }
    const clamped = Math.min(Math.max(numeric, 1), maxUsdc)
    setAmount(String(clamped))
  }

  const getKernelClient = async () => {
    const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig))
    const kernelClient = store
      .getState()
      .kernelClients.get(ARBITRUM_SEPOLIA_CHAIN_ID)
    if (!kernelClient) {
      throw new Error("Smart account client is not ready for Arbitrum Sepolia. Switch networks and try again.")
    }
    return kernelClient
  }

  const getRawEoaWalletClient = async () => {
    const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig))
    const eoaAccount = store.getState().eoaAccount
    if (!eoaAccount) {
      throw new Error("Raw EOA signer is not ready. Reconnect the wallet and try again.")
    }
    return createWalletClient({
      account: eoaAccount,
      chain: arbitrumSepolia,
      transport: http(process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL),
    })
  }

  const resetStableGasRun = () => {
    runVersionRef.current += 1
    setError("")
    setTxs([])
    setReceivedEth(null)
    setBatchDurationMs(null)
    setWethToUnwrap(BigInt(0))
    setProgressMessage("Ready")
    setStatus("idle")
    setActiveCallIndex(null)
  }

  const completeGasCheckStep = async (runVersion: number) => {
    if (!accountAddress || !publicClient) return
    setProgressMessage("Checking native ETH")
    const nativeBalance = await publicClient.getBalance({ address: accountAddress })
    if (runVersionRef.current !== runVersion) return
    if (nativeBalance <= BigInt(0)) {
      throw new Error("Run the one-click sponsored route first to add native ETH, then retry the EOA steps.")
    }
    setTxs((current) => [
      ...current,
      {
        id: "eoa-gas-ready",
        label: "Native gas ready",
        simulatedStep: true,
      },
    ])
    setProgressMessage("Native gas ready")
  }

  const sendRawEoaTransaction = async ({
    data,
    label,
    to,
  }: {
    data: `0x${string}`
    label: string
    to: Address
  }) => {
    if (!publicClient) throw new Error("RPC client is not ready.")
    const walletClient = await getRawEoaWalletClient()
    const hash = toTransactionHash(
      await walletClient.sendTransaction({
        data,
        to,
        value: BigInt(0),
      }),
    )
    if (!hash) throw new Error(`${label} did not return a transaction hash.`)
    setTxs((current) => [...current, { label, hash }])
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  const handleEoaStep = async (index: number) => {
    if (!accountAddress || !publicClient) return

    const runVersion = runVersionRef.current + 1
    runVersionRef.current = runVersion
    setError("")
    setStatus("swapping")
    setActiveCallIndex(index)

    try {
      if (index === 0) {
        await completeGasCheckStep(runVersion)
      }

      if (index === 1) {
        if (amountIn <= BigInt(0)) throw new Error("Choose at least 1 USDC.")
        setProgressMessage("Sending EOA approval")
        await sendRawEoaTransaction({
          label: "USDC approval",
          to: usdcAddress,
          data: encodeFunctionData({
            abi: usdcSwapAbi,
            functionName: "approve",
            args: [ARBITRUM_SEPOLIA_SWAP_ROUTER, amountIn],
          }),
        })
        if (runVersionRef.current !== runVersion) return
        setProgressMessage("USDC approved")
      }

      if (index === 2) {
        if (amountIn <= BigInt(0)) throw new Error("Choose at least 1 USDC.")
        setProgressMessage("Swapping USDC to WETH")
        const wethBefore = await publicClient.readContract({
          address: ARBITRUM_SEPOLIA_WETH,
          abi: erc20BalanceAbi,
          functionName: "balanceOf",
          args: [accountAddress],
        })
        await sendRawEoaTransaction({
          label: "USDC to WETH swap",
          to: ARBITRUM_SEPOLIA_SWAP_ROUTER,
          data: encodeFunctionData({
            abi: swapRouterAbi,
            functionName: "exactInputSingle",
            args: [
              {
                tokenIn: usdcAddress,
                tokenOut: ARBITRUM_SEPOLIA_WETH,
                fee: ARBITRUM_SEPOLIA_USDC_WETH_FEE,
                recipient: accountAddress,
                amountIn,
                amountOutMinimum: BigInt(1),
                sqrtPriceLimitX96: BigInt(0),
              },
            ],
          }),
        })
        if (runVersionRef.current !== runVersion) return
        const wethAfter = await publicClient.readContract({
          address: ARBITRUM_SEPOLIA_WETH,
          abi: erc20BalanceAbi,
          functionName: "balanceOf",
          args: [accountAddress],
        })
        const receivedWeth = wethAfter > wethBefore ? wethAfter - wethBefore : wethAfter
        setWethToUnwrap(receivedWeth)
        setProgressMessage("WETH received")
      }

      if (index === 3) {
        const unwrapAmount =
          wethToUnwrap > BigInt(0)
            ? wethToUnwrap
            : await publicClient.readContract({
                address: ARBITRUM_SEPOLIA_WETH,
                abi: erc20BalanceAbi,
                functionName: "balanceOf",
                args: [accountAddress],
              })
        if (unwrapAmount <= BigInt(0)) {
          throw new Error("No WETH is available to unwrap. Complete the swap step first.")
        }
        setProgressMessage("Unwrapping WETH to native ETH")
        const ethBefore = await publicClient.getBalance({ address: accountAddress })
        await sendRawEoaTransaction({
          label: "WETH unwrap",
          to: ARBITRUM_SEPOLIA_WETH,
          data: encodeFunctionData({
            abi: wethAbi,
            functionName: "withdraw",
            args: [unwrapAmount],
          }),
        })
        if (runVersionRef.current !== runVersion) return
        const ethAfter = await publicClient.getBalance({ address: accountAddress })
        if (ethAfter > ethBefore) setReceivedEth(formatEther(ethAfter - ethBefore))
        setStatus("complete")
        setProgressMessage("Native ETH received")
        setActiveCallIndex(null)
        onRefreshAssets()
        return
      }

      setStatus("idle")
      setActiveCallIndex(null)
      onRefreshAssets()
    } catch (err) {
      if (runVersionRef.current !== runVersion) return
      setError(getSwapErrorMessage(err))
      setProgressMessage("Ready")
      setStatus("idle")
      setActiveCallIndex(null)
    }
  }

  const handleSwapToNativeEth = async () => {
    if (!accountAddress || !publicClient || amountIn <= BigInt(0)) return

    const runVersion = runVersionRef.current + 1
    runVersionRef.current = runVersion
    setError("")
    setTxs([])
    setReceivedEth(null)
    setBatchDurationMs(null)
    setWethToUnwrap(BigInt(0))
    setProgressMessage("Checking USDC balance and allowance")
    setStatus("checking")
    setActiveCallIndex(0)

    try {
      const usdcBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [accountAddress],
      })
      if (runVersionRef.current !== runVersion) return
      if (usdcBalance < amountIn) {
        throw new Error(`You only have ${formatUnits(usdcBalance, 6)} USDC available.`)
      }
      setAvailableUsdc(formatUnits(usdcBalance, 6))

      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: usdcSwapAbi,
        functionName: "allowance",
        args: [accountAddress, ARBITRUM_SEPOLIA_SWAP_ROUTER],
      })
      if (runVersionRef.current !== runVersion) return
      const ethBefore = await publicClient.getBalance({ address: accountAddress })
      if (runVersionRef.current !== runVersion) return

      setStatus("swapping")
      setProgressMessage("Submitting sponsored smart-account batch")
      setActiveCallIndex(1)
      const calls: Array<{ to: Address; data: `0x${string}` }> = []
      if (allowance < amountIn) {
        calls.push({
          to: usdcAddress,
          data: encodeFunctionData({
            abi: usdcSwapAbi,
            functionName: "approve",
            args: [ARBITRUM_SEPOLIA_SWAP_ROUTER, amountIn],
          }),
        })
      }
      const swapToRouterData = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: usdcAddress,
            tokenOut: ARBITRUM_SEPOLIA_WETH,
            fee: ARBITRUM_SEPOLIA_USDC_WETH_FEE,
            recipient: ARBITRUM_SEPOLIA_SWAP_ROUTER,
            amountIn,
            amountOutMinimum: BigInt(1),
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      })
      const unwrapToWalletData = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "unwrapWETH9",
        args: [BigInt(1), accountAddress],
      })
      calls.push({
        to: ARBITRUM_SEPOLIA_SWAP_ROUTER,
        data: encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "multicall",
          args: [[swapToRouterData, unwrapToWalletData]],
        }),
      })

      const kernelClient = await getKernelClient()
      if (runVersionRef.current !== runVersion) return
      const submittedAt = performance.now()
      const batchHash = toTransactionHash(
        await kernelClient.sendTransaction({
          calls: calls.map((call) => ({
            ...call,
            value: BigInt(0),
          })),
        }),
      )
      if (runVersionRef.current !== runVersion) return
      if (!batchHash) {
        throw new Error("The smart account did not return a transaction hash for the batched call.")
      }
      setTxs([
        {
          label: allowance < amountIn
            ? "Atomic approval + swap + unwrap"
            : "Atomic swap + unwrap",
          hash: batchHash,
        },
      ])
      setProgressMessage("Waiting for Arbiscan confirmation")
      setActiveCallIndex(2)
      await publicClient.waitForTransactionReceipt({ hash: batchHash })
      if (runVersionRef.current !== runVersion) return
      setBatchDurationMs(Math.max(0, Math.round(performance.now() - submittedAt)))
      const ethAfter = await publicClient.getBalance({ address: accountAddress })
      if (runVersionRef.current !== runVersion) return
      if (ethAfter > ethBefore) {
        setReceivedEth(formatEther(ethAfter - ethBefore))
      }

      setStatus("complete")
      setProgressMessage("Native ETH received")
      setActiveCallIndex(null)
      onRefreshAssets()
    } catch (err) {
      setError(getSwapErrorMessage(err))
      setProgressMessage("Ready")
      setStatus("idle")
      setActiveCallIndex(null)
    }
  }

  const zeroDevProgress =
    status === "complete" ? 100 : status === "swapping" ? 78 : status === "checking" ? 34 : 0
  const visualProgress =
    executionMode === "batch"
      ? zeroDevProgress
      : status === "complete"
        ? 100
        : activeCallIndex !== null
          ? Math.min(92, activeCallIndex * 25 + 14)
          : Math.min(100, txs.length * 25)
  const activeStableGasSteps =
    executionMode === "batch" ? zeroDevStableGasSteps : eoaStableGasSteps
  const manualStepHandlers = [
    () => handleEoaStep(0),
    () => handleEoaStep(1),
    () => handleEoaStep(2),
    () => handleEoaStep(3),
  ]
  const flowLocked =
    isRunning ||
    (executionMode === "manual" &&
      status !== "complete" &&
      txs.length > 0)
  const canResetStableGasRun = isRunning || txs.length > 0 || Boolean(error) || status === "complete"
  const receivedEthDisplay = receivedEth
    ? Number(receivedEth).toLocaleString(undefined, {
        maximumSignificantDigits: 6,
      })
    : null
  const batchDurationDisplay = batchDurationMs
    ? `${(batchDurationMs / 1000).toFixed(batchDurationMs < 10000 ? 1 : 0)}s`
    : null
  const successReceiptHash = txs.find((tx) => tx.hash)?.hash
  const getStepReceipt = (index: number) => {
    if (executionMode === "batch") {
      return txs[0] && (status === "complete" || index <= 2) ? txs[0] : undefined
    }
    return txs[index]
  }
  const getStepDetail = (index: number) => {
    if (executionMode === "batch") {
      if (index === 0) return `Approve ${amount} USDC with sponsored gas.`
      if (index === 1) return `Swap ${amount} USDC through the USDC/WETH 0.3% pool with sponsored gas.`
      return "Unwrap WETH into native ETH with sponsored gas."
    }
    if (index === 0) return "EOA wallets need native ETH before the first transaction."
    if (index === 1) return `Approve ${amount} USDC for the Uniswap router.`
    if (index === 2) return `Swap ${amount} USDC through the USDC/WETH 0.3% pool.`
    return "Unwrap WETH into native ETH in the wallet."
  }
  const renderAmountSlider = (disabled: boolean) => (
    <div className="min-w-0 flex-1">
      <input
        type="range"
        min="1"
        max={maxUsdc}
        step="1"
        value={Math.min(Math.max(Number(amount) || 1, 1), maxUsdc)}
        onChange={(event) => updateAmount(event.target.value)}
        disabled={disabled}
        className="w-full accent-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="mt-1 flex items-center justify-between text-xs font-medium text-gray-500">
        <span>1 USDC min</span>
        <span>{disabled ? "amount locked" : `${maxUsdc} USDC max`}</span>
      </div>
    </div>
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm leading-6 text-gray-600">
          Convert USDC to native ETH for gas. ZeroDev can sponsor and batch the
          route behind one signature.
        </p>
        <div className="flex min-w-full flex-wrap items-center justify-end gap-2 sm:min-w-fit">
          <button
            type="button"
            onClick={resetStableGasRun}
            disabled={!canResetStableGasRun}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
          <div className="grid min-w-full grid-cols-2 rounded-lg bg-gray-100 p-1 sm:min-w-[360px]">
            {stableGasModes.map(({ badge, label, mode }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  if (flowLocked) return
                  resetStableGasRun()
                  setExecutionMode(mode)
                }}
                disabled={flowLocked}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors",
                  executionMode === mode && mode === "batch"
                    ? "bg-green-50 text-green-800 shadow-sm ring-1 ring-green-200"
                    : executionMode === mode
                      ? "bg-white text-gray-950 shadow-sm"
                      : "text-gray-500 hover:text-gray-800",
                  flowLocked && "cursor-not-allowed opacity-60",
                )}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    "mt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    mode === "batch" ? "text-green-600" : "text-gray-400",
                  )}
                >
                  {badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <label className="text-xs font-semibold uppercase text-gray-500">
          {executionMode === "batch" ? "Convert" : "Route"}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-[130px] items-baseline justify-between gap-4 rounded-lg bg-white px-3 py-2">
            <span className="text-2xl font-semibold tracking-tight text-gray-950">
              {amount}
            </span>
            <span className="text-sm font-semibold text-gray-500">USDC</span>
          </div>
          {executionMode === "batch" ? renderAmountSlider(flowLocked) : (
            <div className="mt-1 text-xs font-medium text-gray-500">
              Pick the amount inside the approval and swap steps.
            </div>
          )}
        </div>
        <div className="mt-2 text-xs font-medium text-gray-500">
          Route: {amount} USDC -&gt; WETH -&gt; ETH, 0.3% pool
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-green-700">
            {executionMode === "batch"
              ? "ZeroDev smart wallet"
              : "EOA embedded wallet"}
          </p>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">
            {executionMode === "batch" ? "1 signature" : "4 steps"}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
              {activeStableGasSteps.map((step, index) => {
                  const isDone =
                    executionMode === "batch"
                      ? zeroDevProgress >= step.threshold
                      : txs.length > index || (status === "complete" && index === 3)
                  const currentStep = activeStableGasSteps.find(
                    (item) => visualProgress < item.threshold,
                  )
                  const canRunManualStep =
                    executionMode === "manual" &&
                    !isRunning &&
                    !isDone &&
                    txs.length === index
                  const isNextManualStep =
                    executionMode === "manual" &&
                    status === "idle" &&
                    txs.length === index
                  const isCurrent =
                    status !== "idle" &&
                    status !== "complete" &&
                    (executionMode === "batch"
                      ? currentStep?.label === step.label
                      : activeCallIndex === index)
                  const isOpen = isCurrent || isDone || isNextManualStep
                  const stepReceipt = getStepReceipt(index)
                  const showStepAmountPicker =
                    executionMode === "manual" &&
                    (index === 1 || index === 2) &&
                    (isNextManualStep || isCurrent)
                  const isStepAmountLocked =
                    isRunning ||
                    status === "complete" ||
                    (executionMode === "manual" && txs.length > 1)

                  return (
                    <div
                      key={step.label}
                      className={cn(
                        "rounded-lg border border-gray-200 bg-white px-3 py-3 transition-all duration-500",
                        isDone && "border-green-200 bg-green-50",
                        isCurrent && "border-blue-200 bg-blue-50 shadow-sm",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "relative flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500",
                              isDone && "bg-green-100 text-green-700",
                              isCurrent && "bg-blue-100 text-blue-700",
                            )}
                          >
                            {step.token === "usdc" ? (
                              <img alt="" className="h-5 w-5" src={tokenMetadata.usdc.icon} />
                            ) : step.token === "swap" ? (
                              <img alt="" className="h-5 w-5" src={tokenMetadata.uni.icon} />
                            ) : (
                              <img alt="" className="h-5 w-5" src={tokenMetadata.eth.icon} />
                            )}
                            {(isCurrent || isDone) && (
                              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm">
                                {isCurrent ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-700" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-700" />
                                )}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-950">
                            {step.label}
                            {executionMode === "batch" && (
                              <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                                Gas sponsored
                              </span>
                            )}
                          </p>
                            <p className="truncate text-xs text-gray-500">
                              {step.detail}
                            </p>
                          </div>
                        </div>
                        {executionMode === "manual" && (
                          <button
                            type="button"
                            onClick={manualStepHandlers[index]}
                            disabled={
                              !accountAddress ||
                              !isArbitrumSepolia ||
                              (index !== 0 && availableUsdcNumber < 1) ||
                              (index !== 0 && amountIn <= BigInt(0)) ||
                              !canRunManualStep
                            }
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-gray-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCurrent
                              ? index === 0
                                ? "Checking..."
                                : "Signing..."
                              : index === 0
                                ? "Check gas"
                                : `Sign ${step.label}`}
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {showStepAmountPicker && (
                            <div className="mb-3 rounded-md bg-white px-3 py-2">
                              <div className="mb-2 flex items-baseline justify-between gap-3">
                                <span className="text-xs font-semibold uppercase text-gray-500">
                                  Amount
                                </span>
                                <span className="text-sm font-semibold text-gray-950">
                                  {amount} USDC
                                </span>
                              </div>
                              {renderAmountSlider(isStepAmountLocked)}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{getStepDetail(index)}</span>
                            {stepReceipt?.hash ? (
                              <a
                                href={`${explorerBaseUrl}/tx/${stepReceipt.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-gray-500 transition-colors hover:text-gray-950"
                              >
                                {formatShortTx(stepReceipt.hash)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : stepReceipt?.simulatedStep ? (
                              <span className="rounded-full bg-white px-2 py-1 font-semibold text-green-700">
                                complete
                              </span>
                            ) : isCurrent ? (
                              <span className="font-semibold text-blue-700">
                                {progressMessage}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  )
              })}
            </div>
          </div>

          {status === "complete" && receivedEth && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-900">
                    ETH received
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    {receivedEthDisplay} ETH added to this wallet
                    {batchDurationDisplay ? ` in ${batchDurationDisplay}` : ""}.
                  </p>
                  {successReceiptHash && (
                    <a
                      href={`${explorerBaseUrl}/tx/${successReceiptHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-semibold text-green-800 transition-colors hover:text-green-950"
                    >
                      View tx {formatShortTx(successReceiptHash)} on Arbiscan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              {executionMode === "manual" && (
                <button
                  type="button"
                  onClick={() => {
                    resetStableGasRun()
                    setExecutionMode("batch")
                  }}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-green-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-green-800"
                >
                  Try the one-click ZeroDev flow
                </button>
              )}
            </div>
          )}
          {availableUsdcNumber < 1 && (
            <a
              href={tokenMetadata.usdc.faucet}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              Get test USDC
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!isArbitrumSepolia && (
            <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Switch to Arbitrum Sepolia to use this route.
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {executionMode === "batch" && (
            <button
              type="button"
              onClick={handleSwapToNativeEth}
              disabled={
                !accountAddress ||
                !isArbitrumSepolia ||
                amountIn <= BigInt(0) ||
                availableUsdcNumber < 1 ||
                isRunning
              }
              className={cn(
                "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status === "checking" && "Checking USDC..."}
                  {status === "swapping" && "Swapping and unwrapping..."}
                </>
              ) : status === "complete" ? (
                <>
                  <Check className="h-4 w-4" />
                  Atomic route complete
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" />
                  Run sponsored batch
                </>
              )}
            </button>
          )}
    </div>
  )
}

function ScenarioPanel({
  accountAddress,
  assetsRefreshKey,
  chainId,
  experience,
  nftFocusRequest,
  onNftCountChange,
  onRefreshAssets,
  onExportPrivateKey,
  onExportWallet,
}: {
  accountAddress: Address | null
  assetsRefreshKey: number
  chainId?: number
  experience: ExperienceId
  nftFocusRequest: number
  onNftCountChange: (count: number) => void
  onRefreshAssets: () => void
  onExportPrivateKey: () => void
  onExportWallet: () => void
}) {
  if (experience === "transact") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <SendTransactionTest
          accountAddress={accountAddress}
          refreshKey={assetsRefreshKey}
          nftFocusRequest={nftFocusRequest}
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

  if (experience === "stables") {
    return (
      <StableGasSwapTest
        accountAddress={accountAddress}
        chainId={chainId}
        onRefreshAssets={onRefreshAssets}
      />
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

  return null
}
