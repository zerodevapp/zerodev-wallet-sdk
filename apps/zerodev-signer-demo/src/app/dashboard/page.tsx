"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthenticators } from "@zerodev/wallet-react";
import {
  ConnectWallet,
  SignUp,
  TxHistory,
  useAuth,
  detachEvmConnection,
  isCancellationError,
  sameWalletName,
  useSolanaAccount,
  useSolanaAutoReconnect,
  useSolanaWallets,
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
  Unplug,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Address, formatEther, formatUnits, isAddress, parseAbi } from "viem";
import { useAccount, useConfig, useConnect, useDisconnect, usePublicClient, useReconnect } from "wagmi";
import { ChainSelector } from "../components/ChainSelector";
import { AppHeader } from "../components/AppHeader";
import { ExportWalletModal } from "../components/ExportWalletModal";
import { SendTransactionTest } from "../components/SendTransactionTest";
import { SigningTest } from "../components/SigningTest";
import { WalletPill } from "../components/WalletPill";
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
  const { address, status, chain, connector } = useAccount();
  const wagmiConfig = useConfig();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { disconnectAsync: logout } = useDisconnect();
  // Solana PoC: one Logout clears both namespaces, and a connected Solana
  // wallet keeps the dashboard open with a Solana-only view when the EVM side
  // is signed out.
  const solana = useSolanaAccount();
  const { disconnect: disconnectSolana } = solana;
  const solanaConnected = solana.isConnected;
  useSolanaAutoReconnect();
  // EVM-first session: let the user add a Solana wallet from the wallet card.
  // Connecting Solana first already offers the reverse ("Connect an EVM
  // wallet" below), so both orders end with both namespaces connected.
  const solanaWallets = useSolanaWallets();
  const [solanaConnecting, setSolanaConnecting] = useState<string | null>(null);
  const [solanaConnectError, setSolanaConnectError] = useState<string | null>(null);
  const connectSolanaWallet = async (wallet: (typeof solanaWallets)[number]) => {
    setSolanaConnecting(wallet.name);
    setSolanaConnectError(null);
    try {
      await solana.connect(wallet);
    } catch (err) {
      // A declined prompt is the user's choice, not an error to show.
      if (!isCancellationError(err)) {
        setSolanaConnectError(
          (err instanceof Error && err.message) || `Couldn't connect to ${wallet.name}.`,
        );
      }
    } finally {
      setSolanaConnecting(null);
    }
  };
  // Solana-only state: let the user add an EVM wallet from the dashboard. The
  // kit connector's connect() opens the sign-up flow (passkey, Google, email,
  // installed EVM wallets); an external wallet picked there connects through
  // wagmi and the full dashboard takes over.
  const { connect: connectEvm, connectAsync: connectEvmAsync, connectors } = useConnect();
  const { reconnectAsync } = useReconnect();
  const { step: authStep } = useAuth();
  const [evmConnectRequested, setEvmConnectRequested] = useState(false);
  const openEvmConnect = () => {
    const kitConnector = connectors.find((c) => c.id === "zerodev-wallet");
    if (!kitConnector) return;
    setEvmConnectRequested(true);
    connectEvm({ connector: kitConnector });
  };
  // Installed EVM wallets, as wagmi discovered them through EIP-6963. Same
  // rule as the kit's sign-up list: only a 6963 announcement proves a live
  // extension, so the generic `injected` connector is left out.
  const evmWallets = connectors.filter(
    (c) => c.type === "injected" && c.id !== "injected" && c.id !== "zerodev-wallet",
  );
  const [evmConnecting, setEvmConnecting] = useState<string | null>(null);
  const [evmConnectError, setEvmConnectError] = useState<string | null>(null);
  const connectEvmWallet = async (connector: (typeof evmWallets)[number]) => {
    setEvmConnecting(connector.uid);
    setEvmConnectError(null);
    try {
      // A multichain wallet (MetaMask) that already authorised this site on
      // the Solana side also holds EVM accounts for it. wagmi's explicit
      // connect always asks the wallet for permissions again, which MetaMask
      // shows as a prompt; its reconnect path reads the authorised accounts
      // silently, like the Solana side does. Prompt only when that is empty.
      await wagmiConfig.storage?.removeItem(`${connector.id}.disconnected`);
      const silent = await reconnectAsync({ connectors: [connector] });
      if (silent.length === 0) await connectEvmAsync({ connector });
    } catch (err) {
      if (!isCancellationError(err)) {
        setEvmConnectError(
          (err instanceof Error && err.message) || `Couldn't connect to ${connector.name}.`,
        );
      }
    } finally {
      setEvmConnecting(null);
    }
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

  // Disconnect one namespace, keeping the other. Dropping the last connected
  // wallet is a deliberate logout, so flag it before the redirect effects
  // below run: they would otherwise show the "session expired" notice.
  const [disconnecting, setDisconnecting] = useState<"evm" | "solana" | null>(null);
  // The same multichain wallet (MetaMask) can serve both sides. wagmi's
  // disconnect asks the wallet to revoke the site permission, and MetaMask
  // revokes the whole site, Solana included; so in that case the EVM side is
  // detached at wagmi's level only, leaving the wallet's permission alone.
  const sharesSolanaWallet =
    !!connector && !!solana.walletName && sameWalletName(connector.name, solana.walletName);
  const handleDisconnect = async (network: "evm" | "solana") => {
    const isLast = network === "evm" ? !solanaConnected : !address;
    if (isLast) localStorage.setItem("zd:loggedOut", "true");
    setDisconnecting(network);
    try {
      if (network === "evm") {
        if (sharesSolanaWallet && solanaConnected && connector) {
          await detachEvmConnection(wagmiConfig, connector.uid);
        } else {
          await logout();
        }
      } else {
        await disconnectSolana();
      }
    } finally {
      setDisconnecting(null);
    }
  };
  // The embedded wallet (passkey, Google, email) is a session, not a wallet
  // connection, so its control reads as a sign-out.
  const evmIsEmbedded = connector?.id === "zerodev-wallet";

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

  // On a reload wagmi settles to `disconnected` before the Solana slot has
  // had a chance to restore silently (the wallet registers, then answers a
  // silent connect), so hold the redirect while that restore is in flight
  // and give it a wider window than wagmi's own reconnect needs.
  const solanaRestoring = solana.status === "connecting";
  useEffect(() => {
    if (status !== 'disconnected' || isLoggingOut || solanaConnected || solanaRestoring) return;

    const timeout = window.setTimeout(() => {
      const loggedOut = localStorage.getItem("zd:loggedOut") === "true";
      window.location.replace(loggedOut ? "/" : "/?session_expired=true");
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [status, isLoggingOut, solanaConnected, solanaRestoring]);

  // Shared by both dashboard states so an EVM-first and a Solana-first
  // session look the same: one labelled address row per connected
  // namespace, plus a small "add the other side" row while one is missing.
  // One address per connected network. A multichain wallet (MetaMask,
  // Phantom) can authorise the EVM and Solana sides in one prompt, so both
  // can show here; a row is hidden while its slot is disconnected.
  const walletAddresses = (
    <div className="mt-4 flex flex-col items-center gap-2">
      {[
        {
          network: "evm" as const,
          label: chain?.name ?? "EVM",
          value: address,
          explorerUrl: walletExplorerUrl,
          badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
          disconnectTitle: evmIsEmbedded ? "Sign out of EVM" : "Disconnect EVM wallet",
        },
        {
          network: "solana" as const,
          label: "Solana",
          value: solanaConnected ? solana.address : undefined,
          explorerUrl: solana.address
            ? `https://explorer.solana.com/address/${solana.address}`
            : undefined,
          badgeClass: "border-[#cdeedb] bg-[#e9f7ef] text-[#1f7a4d]",
          disconnectTitle: "Disconnect Solana wallet",
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
            <button
              type="button"
              onClick={() => handleDisconnect(row.network)}
              disabled={disconnecting !== null}
              data-testid={`disconnect-${row.network}`}
              className="shrink-0 cursor-pointer text-[#423a32] transition-colors hover:text-red-700 disabled:cursor-default disabled:opacity-60"
              title={row.disconnectTitle}
            >
              {disconnecting === row.network ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      {!solanaConnected && solanaWallets.length > 0 && (
        <div
          data-testid="connect-solana"
          className="mt-1 flex flex-wrap items-center justify-center gap-2"
        >
          <span className="text-xs text-[var(--muted)]">Add a Solana wallet:</span>
          {solanaWallets.map((wallet) => (
            <WalletPill
              key={wallet.name}
              label={wallet.name}
              icon={wallet.icon}
              pending={solanaConnecting === wallet.name}
              disabled={solanaConnecting !== null}
              title={`Connect ${wallet.name} on Solana`}
              testId={`connect-solana-${wallet.name}`}
              onClick={() => connectSolanaWallet(wallet)}
            />
          ))}
          {solanaConnectError && (
            <span className="basis-full text-center text-xs text-red-600">{solanaConnectError}</span>
          )}
        </div>
      )}
      {!address && solanaConnected && (
        <div
          data-testid="connect-evm"
          className="mt-1 flex flex-wrap items-center justify-center gap-2"
        >
          <span className="text-xs text-[var(--muted)]">Add an EVM wallet:</span>
          {evmWallets.map((connector) => (
            <WalletPill
              key={connector.uid}
              label={connector.name}
              icon={connector.icon}
              pending={evmConnecting === connector.uid}
              disabled={evmConnecting !== null}
              title={`Connect ${connector.name} on EVM`}
              testId={`connect-evm-${connector.name}`}
              onClick={() => connectEvmWallet(connector)}
            />
          ))}
          <WalletPill
            dashed
            label={evmWallets.length > 0 ? "More options" : "Connect"}
            disabled={evmConnecting !== null}
            title="Passkey, Google, email or another EVM wallet"
            testId="connect-evm-button"
            onClick={openEvmConnect}
          />
          {evmConnectError && (
            <span className="basis-full text-center text-xs text-red-600">{evmConnectError}</span>
          )}
        </div>
      )}
    </div>
  );

  // The EVM side is ready once wagmi reports an address; a connected Solana
  // wallet keeps the dashboard open on its own, with the EVM-only parts
  // (balances, chain selector, export keys, the tx demos) hidden until an
  // EVM wallet is added. Both sides show their address rows below.
  const evmReady = !!address && status === "connected";
  if (isLoggingOut || (!evmReady && !solanaConnected)) {
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
      {/* The terminal `authenticated` step renders nothing inside ConnectWallet
          (passkey, Google or email from "More options"), so the overlay must
          not outlive it, or it would sit over the dashboard. */}
      {evmConnectRequested &&
        authStep !== null &&
        authStep !== "authenticated" && (
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
      <div className="min-h-screen">
        <AppHeader />

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Wallet Card */}
          <div className="mb-4 rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:mb-6 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[var(--ink)]" />
                <h1 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">
                  {evmReady ? "Your Smart Wallet" : "Your Wallet"}
                </h1>
                {evmReady ? (
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Created with {authMethodLabel}
                  </span>
                ) : (
                  <span className="rounded-full border border-[#cdeedb] bg-[#e9f7ef] px-2.5 py-1 text-xs font-semibold text-[#1f7a4d]">
                    Signed in with {solana.walletName ?? "a Solana wallet"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {evmReady && <ChainSelector className="h-9 rounded-full px-3 text-xs" />}
                {evmReady && HISTORY_ENABLED && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
                    title="Transaction history"
                  >
                    <History className="h-3.5 w-3.5" />
                    History
                  </button>
                )}
                {evmReady && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)]"
                    title="Export keys"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Export keys
                  </button>
                )}
                <button
                  data-testid="logout-button"
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>

            {!evmReady && (
              <p className="mt-3 text-center text-sm leading-6 text-[var(--muted)]">
                Balances, gas sponsorship and batching need an EVM smart account.
                Add an EVM wallet to unlock them; both stay connected side by side.
              </p>
            )}
            {evmReady && (
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
            )}

            {walletAddresses}
          </div>

          {/* Without an EVM account only the signing demo applies; the EVM
              button inside it stays disabled until one is added. */}
          {!evmReady && (
            <div className="rounded-lg border border-[var(--border-warm)] bg-white p-4 sm:p-5 lg:p-6">
              <SigningTest />
            </div>
          )}
          {/* Tabs */}
          {evmReady && (
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
          )}
        </div>
      </div>
    </>
  );
}
