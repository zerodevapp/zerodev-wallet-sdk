"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles, AlertCircle, Loader2, Check, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import {
  type Address,
  parseEther,
  parseAbi,
  zeroAddress,
  isAddress,
} from "viem";
import { sepolia } from "wagmi/chains";
import { useAccount, useSendTransaction, useWriteContract, usePublicClient } from "wagmi";

type TransactionMode = "send-eth" | "mint-nft";

// Per-chain NFT contract addresses
const NFT_CONTRACTS: Record<number, `0x${string}`> = {
  [sepolia.id]: "0x34bE7f35132E97915633BC1fc020364EA5134863",
  [421614]: "0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808", // Arbitrum Sepolia
};

const NFT_CONTRACT_ABI = parseAbi([
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

export function SendTransactionTest() {
  const [mode, setMode] = useState<TransactionMode>("mint-nft");
  const [recipient, setRecipient] = useState<string>(zeroAddress);
  const [amount, setAmount] = useState<string>("0");
  const [error, setError] = useState<string>("");
  const [nftBalance, setNftBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient({chainId: chain?.id});
  const { sendTransaction, isPending: isSendingTx, data: sendTxHash, error: sendError, reset: resetSendTx } = useSendTransaction();
  const { writeContract, isPending: isMinting, data: mintTxHash, error: mintError, reset: resetMint } = useWriteContract();

  const loading = isSendingTx || isMinting;
  const nftContractAddress = chain?.id ? NFT_CONTRACTS[chain.id] : undefined;

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

  const handleSendEth = async () => {
    if (!isConnected || !address || !recipient) {
      setError("Please authenticate and enter recipient address");
      return;
    }

    setError("");

    if (!isAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Invalid amount");
      return;
    }

    try {
      // Use Wagmi's useSendTransaction - provider handles gasless via EIP-7702
      await sendTransaction({
        to: recipient as Address,
        value: parseEther(amount || "0"),
      });
    } catch (err) {
      console.error("Transaction error:", err);
      setError("Transaction failed");
    }
  };

  const handleMintNft = async () => {
    console.log("handleMintNft", isConnected, address);
    if (!isConnected || !address) {
      setError("Please authenticate first");
      return;
    }
    if (!nftContractAddress) {
      setError("NFT minting is not available on this chain");
      return;
    }

    setError("");

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
  }, [sendTxHash, mintTxHash]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Send Transaction</h2>
        <p className="text-sm text-gray-500 mt-1">
          Send ETH or mint NFTs on {chain?.name}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => { setMode("mint-nft"); setError(""); resetSendTx(); }}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
            mode === "mint-nft" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          Mint NFT
        </button>
        <button
          onClick={() => { setMode("send-eth"); setError(""); resetMint(); }}
          className={cn(
            "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all cursor-pointer",
            mode === "send-eth" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          )}
        >
          Send ETH
        </button>
      </div>

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
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div>
            <p className="text-xs font-medium text-blue-500 mb-1">Your NFT Balance</p>
            <p className="text-2xl font-bold text-blue-900">{nftBalance}</p>
          </div>
          <button
            onClick={fetchNftBalance}
            disabled={loadingBalance}
            className="p-2 text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            title="Refresh balance"
          >
            <RefreshCw className={cn("h-4 w-4", loadingBalance && "animate-spin")} />
          </button>
        </div>
      )}

      {/* Gasless Info */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-blue-900">Gasless transactions are active</p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {mode === "send-eth" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-gray-200 font-mono text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Amount (ETH)
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.001"
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  "text-gray-900 placeholder:text-gray-400"
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={() => mode === "send-eth" ? handleSendEth() : handleMintNft()}
        disabled={loading || (mode === "send-eth" && !recipient) || (mode === "mint-nft" && !nftContractAddress)}
        style={{
          background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
        }}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border-2 border-transparent text-blue-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === "send-eth" ? "Sending..." : "Minting..."}
          </>
        ) : (
          <>
            {mode === "send-eth" ? (
              <>
                <Send className="h-4 w-4" />
                Send ETH
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Mint NFT
              </>
            )}
          </>
        )}
      </button>

      {/* Error */}
      {(error || mintError || sendError) && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg overflow-hidden">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-900">Transaction Failed</p>
            <p className="text-sm text-red-700 mt-0.5 break-words line-clamp-3">{error || (mintError as unknown as { shortMessage?: string })?.shortMessage || (sendError as unknown as { shortMessage?: string })?.shortMessage || mintError?.message || sendError?.message}</p>
          </div>
        </div>
      )}

      {/* Success Result - Send ETH */}
      {mode === "send-eth" && sendTxHash && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-lg">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">ETH sent successfully</span>
          </div>
          <a
            href={`${chain?.blockExplorers?.default?.url}/tx/${sendTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg",
              "hover:bg-gray-100 transition-colors group"
            )}
          >
            <span className="text-sm text-gray-700 font-medium">View on Explorer</span>
            <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
          </a>
        </div>
      )}

      {/* Success Result - Mint NFT */}
      {mode === "mint-nft" && mintTxHash && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-lg">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">NFT minted successfully!</span>
          </div>
          <a
            href={`${chain?.blockExplorers?.default?.url}/tx/${mintTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg",
              "hover:bg-gray-100 transition-colors group"
            )}
          >
            <span className="text-sm text-gray-700 font-medium">View on Explorer</span>
            <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
          </a>
          <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">
              NFT minted to your wallet!
            </p>
            <p className="text-xs text-blue-500 mt-1">Balance will update in a few seconds...</p>
          </div>
        </div>
      )}
    </div>
  );
}
