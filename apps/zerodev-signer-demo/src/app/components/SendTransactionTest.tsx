"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, AlertCircle, Loader2, Check, ExternalLink, RefreshCw, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import {
  type Address,
  formatEther,
  formatUnits,
  parseEther,
  parseAbi,
  parseEventLogs,
  parseUnits,
  zeroAddress,
  isAddress,
} from "viem";
import { sepolia } from "wagmi/chains";
import { useAccount, useSendTransaction, useWriteContract, usePublicClient } from "wagmi";

type TransactionMode = "send-eth" | "mint-nft";
type BatchAsset = "ETH" | "USDC";
type BatchRecipient = {
  id: number
  address: string
  percent: number
};

// Per-chain NFT contract addresses
const NFT_CONTRACTS: Record<number, `0x${string}`> = {
  [sepolia.id]: "0x34bE7f35132E97915633BC1fc020364EA5134863",
  [421614]: "0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808", // Arbitrum Sepolia
};

const NFT_CONTRACT_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

const USDC_CONTRACTS: Record<number, `0x${string}`> = {
  [sepolia.id]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [421614]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

const defaultBatchRecipients: BatchRecipient[] = [
  { id: 1, address: "0x1111111111111111111111111111111111111111", percent: 50 },
  { id: 2, address: "0x2222222222222222222222222222222222222222", percent: 50 },
];

const defaultRecipientAddresses = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
];

export function SendTransactionTest({
  mode: fixedMode,
  batchAsset: controlledBatchAsset,
  onBatchAssetChange,
  onGaslessTransaction,
}: {
  mode?: TransactionMode
  batchAsset?: BatchAsset
  onBatchAssetChange?: (asset: BatchAsset) => void
  onGaslessTransaction?: () => void
}) {
  const [internalMode, setInternalMode] = useState<TransactionMode>("mint-nft");
  const mode = fixedMode ?? internalMode;
  const [internalBatchAsset, setInternalBatchAsset] = useState<BatchAsset>("ETH");
  const batchAsset = controlledBatchAsset ?? internalBatchAsset;
  const [amount, setAmount] = useState<string>("0");
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [batchRecipients, setBatchRecipients] = useState<BatchRecipient[]>(defaultBatchRecipients);
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0));
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [batchTxHashes, setBatchTxHashes] = useState<`0x${string}`[]>([]);
  const [showFaucetCopiedHint, setShowFaucetCopiedHint] = useState(false);
  const [error, setError] = useState<string>("");
  const [nftBalance, setNftBalance] = useState<string>("0");
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient({chainId: chain?.id});
  const { sendTransactionAsync, isPending: isSendingTx, data: sendTxHash, error: sendError, reset: resetSendTx } = useSendTransaction();
  const { writeContract, isPending: isMinting, data: mintTxHash, error: mintError, reset: resetMint } = useWriteContract();
  const { writeContractAsync: writeTokenTransferAsync, isPending: isSendingToken, error: tokenTransferError, reset: resetTokenTransfer } = useWriteContract();

  const loading = isSendingTx || isMinting || isSendingToken;
  const nftContractAddress = chain?.id ? NFT_CONTRACTS[chain.id] : undefined;
  const usdcContractAddress = chain?.id ? USDC_CONTRACTS[chain.id] : undefined;
  const countedTxHashes = useRef(new Set<string>());
  const successTxHash = mode === "send-eth" ? (batchTxHashes[0] ?? sendTxHash) : mintTxHash;
  const explorerUrl = successTxHash
    ? `${chain?.blockExplorers?.default?.url}/tx/${successTxHash}`
    : undefined;
  const explorerBaseUrl = chain?.blockExplorers?.default?.url;
  const shortTxHash = successTxHash
    ? `${successTxHash.slice(0, 8)}...${successTxHash.slice(-6)}`
    : "";
  const transactionError = error || (mintError as unknown as { shortMessage?: string })?.shortMessage || (sendError as unknown as { shortMessage?: string })?.shortMessage || (tokenTransferError as unknown as { shortMessage?: string })?.shortMessage || mintError?.message || sendError?.message || tokenTransferError?.message;
  const totalSplitUnits = (() => {
    try {
      if (!amount || isNaN(Number(amount))) return BigInt(0);
      return batchAsset === "ETH" ? parseEther(amount || "0") : parseUnits(amount || "0", 6);
    } catch {
      return BigInt(0);
    }
  })();
  const totalPercent = batchRecipients.reduce((sum, item) => sum + item.percent, 0);
  const walletBalanceLabel = Number(formatEther(walletBalance)).toFixed(4);
  const usdcBalanceLabel = Number(formatUnits(usdcBalance, 6)).toFixed(2);
  const selectedBalance = batchAsset === "ETH" ? walletBalance : usdcBalance;
  const selectedBalanceLabel = batchAsset === "ETH" ? walletBalanceLabel : usdcBalanceLabel;
  const hasSelectedBalance = selectedBalance > BigInt(0);
  const showFundingHint = mode === "send-eth" && !hasSelectedBalance;

  const getSplitValue = (percent: number) => totalSplitUnits * BigInt(percent) / BigInt(100);

  const formatSplitValue = (percent: number) => {
    const value = batchAsset === "ETH"
      ? formatEther(getSplitValue(percent))
      : formatUnits(getSplitValue(percent), 6);
    return batchAsset === "ETH" ? Number(value).toFixed(4) : Number(value).toFixed(2);
  };

  const normalizePercents = (recipients: BatchRecipient[]) => {
    const total = recipients.reduce((sum, item) => sum + item.percent, 0);
    if (total === 100 || recipients.length === 0) return recipients;

    const diff = 100 - total;
    const index = recipients.findIndex((item) => item.percent + diff >= 0 && item.percent + diff <= 100);
    if (index === -1) return recipients;

    return recipients.map((item, itemIndex) => (
      itemIndex === index ? { ...item, percent: item.percent + diff } : item
    ));
  };

  const updateBatchPercent = (recipientId: number, nextPercent: number) => {
    setBatchRecipients((current) => {
      const clampedPercent = Math.max(0, Math.min(100, nextPercent));
      const target = current.find((item) => item.id === recipientId);
      if (!target) return current;

      const delta = clampedPercent - target.percent;
      const others = current.filter((item) => item.id !== recipientId);
      const othersTotal = others.reduce((sum, item) => sum + item.percent, 0);

      let remainingDelta = delta;
      const next = current.map((item) => {
        if (item.id === recipientId) return { ...item, percent: clampedPercent };
        if (othersTotal === 0 || remainingDelta === 0) return item;

        const share = Math.round(delta * (item.percent / othersTotal));
        const nextValue = Math.max(0, Math.min(100, item.percent - share));
        remainingDelta -= item.percent - nextValue;
        return { ...item, percent: nextValue };
      });

      if (remainingDelta === 0) return normalizePercents(next);

      return normalizePercents(next.map((item) => {
        if (item.id === recipientId) return item;
        if (remainingDelta > 0 && item.percent > 0) {
          const adjustment = Math.min(item.percent, remainingDelta);
          remainingDelta -= adjustment;
          return { ...item, percent: item.percent - adjustment };
        }
        if (remainingDelta < 0 && item.percent < 100) {
          const adjustment = Math.min(100 - item.percent, Math.abs(remainingDelta));
          remainingDelta += adjustment;
          return { ...item, percent: item.percent + adjustment };
        }
        return item;
      }));
    });
  };

  const updateBatchAddress = (recipientId: number, nextAddress: string) => {
    setBatchRecipients((current) => current.map((item) => (
      item.id === recipientId ? { ...item, address: nextAddress } : item
    )));
  };

  const addBatchRecipient = () => {
    if (batchRecipients.length >= 4) return;
    setBatchRecipients((current) => [
      ...current,
      { id: Date.now(), address: defaultRecipientAddresses[current.length] ?? defaultRecipientAddresses[0], percent: 0 },
    ]);
  };

  const removeBatchRecipient = (recipientId: number) => {
    setBatchRecipients((current) => {
      if (current.length <= 1) return current;
      const removed = current.find((item) => item.id === recipientId);
      const remaining = current.filter((item) => item.id !== recipientId);
      if (!removed || removed.percent === 0) return normalizePercents(remaining);

      const first = remaining[0];
      return normalizePercents(remaining.map((item) => (
        item.id === first.id ? { ...item, percent: item.percent + removed.percent } : item
      )));
    });
  };

  const handleAmountChange = (nextAmount: string) => {
    setHasEditedAmount(true);
    if (!/^\d*\.?\d*$/.test(nextAmount)) return;
    setAmount(nextAmount);
  };

  const handleBatchAssetChange = (asset: BatchAsset) => {
    onBatchAssetChange?.(asset);
    setInternalBatchAsset(asset);
    setHasEditedAmount(false);
    setBatchTxHashes([]);
    setError("");
    resetSendTx();
    resetTokenTransfer();
  };

  const handleOpenFaucet = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
    }
    setShowFaucetCopiedHint(true);
    window.setTimeout(() => {
      window.open("https://faucet.circle.com/", "_blank", "noopener,noreferrer");
      setShowFaucetCopiedHint(false);
    }, 1200);
  };

  const refreshBalances = async () => {
    if (!address || !publicClient) return;
    try {
      const balance = await publicClient.getBalance({ address });
      setWalletBalance(balance);
      if (usdcContractAddress) {
        const tokenBalance = await publicClient.readContract({
          address: usdcContractAddress,
          abi: ERC20_TRANSFER_ABI,
          functionName: "balanceOf",
          args: [address],
        });
        setUsdcBalance(tokenBalance);
      } else {
        setUsdcBalance(BigInt(0));
      }
    } catch (err) {
      console.error("Failed to refresh balances:", err);
    }
  };

  // Fetch NFT balance
  const fetchNftBalance = async () => {
    if (!isConnected || !address || !nftContractAddress) return;

    setLoadingBalance(true);
    try {
      if (!publicClient) return;
      const balance = await publicClient?.readContract({
        address: nftContractAddress,
        abi: NFT_CONTRACT_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      setNftBalance(balance.toString());
    } catch (err) {
      console.error("Failed to fetch NFT balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Fetch balance when switching to NFT mode or chain changes
  useEffect(() => {
    if (mode === "mint-nft" && isConnected) {
      fetchNftBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isConnected, publicClient]);

  useEffect(() => {
    const fetchWalletBalance = async () => {
      await refreshBalances();
    };

    void fetchWalletBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chain, publicClient, usdcContractAddress]);

  useEffect(() => {
    if (mode !== "send-eth" || hasEditedAmount) return;
    setAmount(batchAsset === "ETH" ? formatEther(walletBalance) : formatUnits(usdcBalance, 6));
  }, [batchAsset, hasEditedAmount, mode, usdcBalance, walletBalance]);

  const handleSendEth = async () => {
    setError("");
    resetSendTx();
    resetMint();
    resetTokenTransfer();
    setBatchTxHashes([]);

    if (!isConnected || !address) {
      setError("Please authenticate first");
      return;
    }

    if (batchRecipients.some((item) => !isAddress(item.address))) {
      setError("Enter a valid address for every recipient");
      return;
    }

    if (batchAsset === "USDC" && !usdcContractAddress) {
      setError("USDC is not available on this chain");
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0 || totalSplitUnits <= BigInt(0)) {
      setError("Invalid amount");
      return;
    }

    if (totalSplitUnits > selectedBalance) {
      setError(`Batch amount exceeds your ${batchAsset} balance`);
      return;
    }

    if (totalPercent !== 100) {
      setError("Recipient percentages must add up to 100%");
      return;
    }

    try {
      const hashes: `0x${string}`[] = [];
      for (const item of batchRecipients) {
        const value = getSplitValue(item.percent);
        if (value === BigInt(0)) continue;

        const hash = batchAsset === "ETH"
          ? await sendTransactionAsync({
              to: item.address as Address,
              value,
            })
          : await writeTokenTransferAsync({
              address: usdcContractAddress as Address,
              abi: ERC20_TRANSFER_ABI,
              functionName: "transfer",
              args: [item.address as Address, value],
            });
        hashes.push(hash);
        if (!countedTxHashes.current.has(hash)) {
          countedTxHashes.current.add(hash);
          onGaslessTransaction?.();
        }
      }
      setBatchTxHashes(hashes);
      await refreshBalances();
      window.setTimeout(() => {
        void refreshBalances();
      }, 3000);
    } catch (err) {
      console.error("Transaction error:", err);
      setError("Batch transaction failed");
    }
  };

  const handleMintNft = async () => {
    setError("");
    resetSendTx();
    resetMint();
    setMintedTokenId(null);

    if (!isConnected || !address) {
      setError("Please authenticate first");
      return;
    }
    if (!nftContractAddress) {
      setError("NFT minting is not available on this chain");
      return;
    }

    try {
      // Use Wagmi's useWriteContract - provider handles gasless via EIP-7702
      await writeContract({
        address: nftContractAddress,
        abi: NFT_CONTRACT_ABI,
        functionName: "mint",
        args: [address],
      });

      // Refresh NFT balance after successful mint
      setTimeout(() => fetchNftBalance(), 3000);
    } catch (err) {
      console.error("Mint error:", err);
      setError("Mint failed");
    }
  };

  // Watch for transaction success
  useEffect(() => {
    if (sendTxHash || mintTxHash) {
      setError("");
    }
    const txHash = sendTxHash ?? mintTxHash;
    if (!txHash || countedTxHashes.current.has(txHash)) return;
    countedTxHashes.current.add(txHash);
    onGaslessTransaction?.();
  }, [sendTxHash, mintTxHash, onGaslessTransaction]);

  useEffect(() => {
    if (!mintTxHash || !publicClient || !address) return;

    let cancelled = false;
    const loadMintedTokenId = async () => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: mintTxHash,
        });
        if (cancelled) return;

        const transferLogs = parseEventLogs({
          abi: NFT_CONTRACT_ABI,
          eventName: "Transfer",
          logs: receipt.logs,
        });
        const mintedTransfer = transferLogs.find((log) => {
          const { from, to } = log.args;
          return (
            from.toLowerCase() === zeroAddress &&
            to.toLowerCase() === address.toLowerCase()
          );
        });
        const tokenId = mintedTransfer?.args.tokenId?.toString();
        if (tokenId) setMintedTokenId(tokenId);
      } catch (err) {
        console.info("Could not resolve minted token id:", err);
      }
    };

    void loadMintedTokenId();

    return () => {
      cancelled = true;
    };
  }, [address, mintTxHash, publicClient]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {mode === "mint-nft" ? "Mint NFT" : "Batch Transactions"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {mode === "mint-nft"
            ? "The Zerodev Wallet can be configured to sponsor gas with 3 clicks on the dashboard or via our Admin API."
            : `Split ${batchAsset} across multiple recipients on ${chain?.name}`}
        </p>
      </div>

      {/* Mode Selector */}
      {!fixedMode && (
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => { setInternalMode("mint-nft"); setError(""); resetSendTx(); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
              mode === "mint-nft" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Mint NFT
          </button>
          <button
            onClick={() => { setInternalMode("send-eth"); setError(""); resetMint(); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
              mode === "send-eth" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Batch Transactions
          </button>
        </div>
      )}

      {/* No NFT contract for current chain */}
      {mode === "mint-nft" && !nftContractAddress && (
        <div className="flex items-start gap-2 px-4 py-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-sm text-yellow-700">
            NFT minting is not yet available on {chain?.name}. Switch to Sepolia to mint NFTs.
          </p>
        </div>
      )}

      {/* NFT Balance (only show in mint mode when contract exists) */}
      {mode === "mint-nft" && nftContractAddress && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Your NFT Balance</p>
            <p className="text-2xl font-bold text-gray-950">{nftBalance}</p>
          </div>
          <button
            onClick={fetchNftBalance}
            disabled={loadingBalance}
            className="p-2 text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50 cursor-pointer"
            title="Refresh balance"
          >
            <RefreshCw className={cn("h-4 w-4", loadingBalance && "animate-spin")} />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {mode === "send-eth" && (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
              {(["ETH", "USDC"] as const).map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => handleBatchAssetChange(asset)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-all cursor-pointer",
                    batchAsset === asset
                      ? "border-gray-200 bg-white text-gray-950 shadow-sm"
                      : "border-transparent text-gray-500 hover:bg-white hover:text-gray-800"
                  )}
                >
                  {asset}
                </button>
              ))}
            </div>

            {showFundingHint && (
              <div className="flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {showFaucetCopiedHint
                    ? "Address copied. Select Arbitrum Sepolia in the Circle faucet."
                    : batchAsset === "USDC"
                      ? "Need testnet USDC for this split?"
                      : "No ETH detected. Transfer ETH on Arbitrum Sepolia, or try USDC for a faucet."}
                </span>
                {batchAsset === "USDC" && (
                  <button
                    type="button"
                    onClick={handleOpenFaucet}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline"
                  >
                    {showFaucetCopiedHint ? "Opening faucet..." : "Open Circle faucet"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Total {batchAsset} to split
                </label>
                <span className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800">
                  Available: {selectedBalanceLabel} {batchAsset}
                </span>
              </div>
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={!hasSelectedBalance}
                placeholder={batchAsset === "ETH" ? "0.001" : "20"}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-gray-700">
                  Recipients
                </label>
                <button
                  type="button"
                  onClick={addBatchRecipient}
                  disabled={!hasSelectedBalance || batchRecipients.length >= 4}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add recipient
                </button>
              </div>

              <div className="space-y-3">
                {batchRecipients.map((item, index) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-gray-500">
                        Recipient {index + 1}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          {item.percent}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatSplitValue(item.percent) || "0"} {batchAsset}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBatchRecipient(item.id)}
                          disabled={!hasSelectedBalance || batchRecipients.length <= 1}
                          className="text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer"
                          title={batchRecipients.length <= 1 ? "At least one recipient is required" : "Remove recipient"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={item.address}
                      onChange={(e) => updateBatchAddress(item.id, e.target.value)}
                      disabled={!hasSelectedBalance}
                      placeholder="0x..."
                      className={cn(
                        "mt-2 w-full rounded-md border border-gray-200 px-3 py-2 font-mono text-xs",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        "text-gray-900 placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                      )}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={item.percent}
                      onChange={(e) => updateBatchPercent(item.id, Number(e.target.value))}
                      disabled={!hasSelectedBalance}
                      className="mt-3 w-full accent-gray-950 disabled:opacity-40"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <span className="font-medium text-gray-600">Allocation</span>
                <span className={cn(
                  "font-mono font-semibold",
                  totalPercent === 100 ? "text-gray-900" : "text-red-600"
                )}>
                  {totalPercent}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={() => mode === "send-eth" ? handleSendEth() : handleMintNft()}
        disabled={loading || (mode === "send-eth" && (!hasSelectedBalance || batchRecipients.some((item) => !item.address))) || (mode === "mint-nft" && !nftContractAddress)}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === "send-eth" ? "Sending batch..." : "Minting..."}
          </>
        ) : (
          <>
            {mode === "send-eth" ? (
              <>
                <Send className="h-4 w-4" />
                Send Batch
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Mint
              </>
            )}
          </>
        )}
      </button>

      {/* Error */}
      {transactionError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg overflow-hidden">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-900">Transaction Failed</p>
            <p className="text-sm text-red-700 mt-0.5 break-words line-clamp-3">{transactionError}</p>
          </div>
        </div>
      )}

      {!transactionError && successTxHash && explorerUrl && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <p className="shrink-0 text-sm font-semibold text-gray-950">
                {mode === "mint-nft" && mintedTokenId
                  ? `NFT minted: Token #${mintedTokenId}`
                  : mode === "mint-nft"
                    ? "NFT minted successfully"
                    : "Batch sent successfully"}
              </p>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {mode === "mint-nft" && (
                  <span className="text-xs font-semibold text-emerald-700">
                    Gas sponsored
                  </span>
                )}
                {mode === "send-eth" && explorerBaseUrl && batchRecipients.map((item, index) => (
                  <a
                    key={item.id}
                    href={`${explorerBaseUrl}/address/${item.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-gray-700 underline-offset-2 hover:text-gray-950 hover:underline"
                  >
                    Recipient {index + 1}
                  </a>
                ))}
                <span className="font-mono text-xs text-gray-500">
                  {mode === "send-eth" && batchTxHashes.length > 1
                    ? `${batchTxHashes[0].slice(0, 8)}...${batchTxHashes[0].slice(-6)}`
                    : shortTxHash}
                </span>
              </div>
            </div>
          </div>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
          >
            {mode === "send-eth" ? "View transaction" : "View on Explorer"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
