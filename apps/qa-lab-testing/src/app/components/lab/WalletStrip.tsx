"use client";

import { useAuthenticators } from "@zerodev/wallet-react";
import {
  Check,
  Copy,
  ExternalLink,
  Key,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type Address, formatEther, formatUnits, isAddress, parseAbi } from "viem";
import { useAccount, useDisconnect, usePublicClient } from "wagmi";
import { useConfigHref } from "../../lib/use-wallet-config";
import { cn } from "../../lib/utils";
import { ChainSelector } from "../ChainSelector";
import { ExportWalletModal } from "../ExportWalletModal";

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

/**
 * Shared wallet context for every feature in the lab — address, balances,
 * chain, export and logout.
 *
 * Lives in the shell rather than inside a feature because all of them need it,
 * and it's a strip rather than the old full-height card so the first test case
 * is visible without scrolling.
 */
export function WalletStrip({ onLogout }: { onLogout: () => void }) {
  const [selectedAsset, setSelectedAsset] = useState<WalletAsset>("ETH");
  const [balance, setBalance] = useState("0");
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [copied, setCopied] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isBalanceRefreshing, setIsBalanceRefreshing] = useState(false);

  const configHref = useConfigHref();
  const { address, chain } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const { disconnectAsync: logout } = useDisconnect();
  const { data: authenticatorData } = useAuthenticators({});
  const authMethodLabel = formatAuthMethod(authenticatorData);

  const walletExplorerUrl =
    address && chain?.blockExplorers?.default?.url
      ? `${chain.blockExplorers.default.url}/address/${address}`
      : undefined;

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
    const interval = window.setInterval(loadBalances, 10_000);
    return () => window.clearInterval(interval);
  }, [loadBalances]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keeps the active config across the logout reload — landing on a bare "/"
  // would silently drop any URL overrides and log you back into a different
  // setup than the one you were testing.
  const handleLogout = async () => {
    onLogout();
    try {
      await logout();
    } finally {
      window.location.assign(configHref("/"));
    }
  };

  const shown =
    selectedAsset === "ETH"
      ? parseFloat(balance).toFixed(4)
      : parseFloat(usdcBalance).toFixed(2);

  return (
    <>
      <ExportWalletModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--border-warm)] bg-white px-4 py-3 sm:px-6"
        data-testid="wallet-strip"
      >
        <div className="flex min-w-0 items-center gap-2">
          <p
            className="min-w-0 truncate font-mono text-sm font-semibold text-[var(--ink)]"
            data-testid="wallet-address"
          >
            {address}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 cursor-pointer text-[#423a32] transition-colors hover:text-[var(--ink)]"
            title="Copy address"
            data-testid="wallet-copy-address"
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
              data-testid="wallet-explorer-link"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span
            className="hidden shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 lg:inline"
            data-testid="wallet-auth-method"
          >
            {authMethodLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="font-[var(--font-dm-sans)] text-lg font-bold leading-none text-[var(--ink)]"
            data-testid="wallet-balance"
          >
            {shown}
          </span>
          <div className="flex gap-0.5 rounded-full border border-[var(--border-warm)] bg-[var(--surface-warm)] p-0.5">
            {(["ETH", "USDC"] as const).map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                data-testid={`wallet-asset-${asset}`}
                data-selected={String(selectedAsset === asset)}
                className={cn(
                  "h-6 cursor-pointer rounded-full px-2 text-[11px] font-semibold transition-colors",
                  selectedAsset === asset
                    ? "bg-white text-[var(--ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                {asset}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadBalances}
            disabled={isBalanceRefreshing}
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border-warm)] bg-white text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] disabled:cursor-not-allowed disabled:opacity-60"
            title="Refresh balances"
            data-testid="wallet-refresh-balance"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isBalanceRefreshing && "animate-spin")}
            />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ChainSelector className="h-8 rounded-full px-3 text-xs" />
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            title="Export keys"
            aria-label="Export keys"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-2.5 text-xs font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] sm:px-3"
            data-testid="wallet-export-keys"
          >
            <Key className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 sm:px-3"
            data-testid="wallet-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
