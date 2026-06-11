"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, Loader2, Check, ChevronDown, Code2, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import {
  type Address,
  parseAbi,
  parseEventLogs,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { sepolia } from "wagmi/chains";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";

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

const NFT_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

type MintedNft = {
  blockNumber?: bigint
  imageUrl?: string
  timestamp?: string
  tokenId: string
  txHash?: `0x${string}`
}

function formatShortHash(value: `0x${string}`) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTimestamp(value?: string) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function compareBlockNumbers(a?: bigint, b?: bigint) {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a > b ? -1 : 1;
}

export function SendTransactionTest({
  accountAddress,
  onNftCountChange,
}: {
  accountAddress: Address | null
  onNftCountChange?: (count: number) => void
}) {
  const [error, setError] = useState<string>("");
  const [nftBalance, setNftBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [mintedNfts, setMintedNfts] = useState<MintedNft[]>([]);
  const [confirmingMint, setConfirmingMint] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [nftsOpen, setNftsOpen] = useState(true);
  const lastMintHashRef = useRef<`0x${string}` | undefined>(undefined);

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  const activeAddress = accountAddress ?? address;
  const hasUsableAddress =
    Boolean(activeAddress) && activeAddress?.toLowerCase() !== zeroAddress;
  const publicClient = usePublicClient({chainId: chain?.id});
  const { writeContract, isPending: isMinting, data: mintTxHash, error: mintError } = useWriteContract();

  const nftContractAddress = chain?.id ? NFT_CONTRACTS[chain.id] : undefined;
  const explorerBaseUrl = chain?.blockExplorers?.default?.url ?? "https://sepolia.arbiscan.io";
  const galleryNfts = mintedNfts;
  const mintedCount = mintedNfts.length || Number(nftBalance) || 0;
  const mintInProgress = isMinting || confirmingMint;

  // Fetch NFT balance
  const fetchNftBalance = async () => {
    if (!isConnected || !activeAddress || !hasUsableAddress || !nftContractAddress) return;

    setLoadingBalance(true);
    try {
      if (!publicClient) return;
      const balance = await publicClient?.readContract({
        address: nftContractAddress,
        abi: NFT_CONTRACT_ABI,
        functionName: "balanceOf",
        args: [activeAddress],
      });

      const nextBalance = balance.toString();
      setNftBalance(nextBalance);
      onNftCountChange?.(Number(nextBalance));
    } catch (err) {
      console.error("Failed to fetch NFT balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchNftBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, publicClient, activeAddress, nftContractAddress]);

  useEffect(() => {
    const fetchOwnedNfts = async () => {
      if (!publicClient || !activeAddress || !hasUsableAddress || !nftContractAddress) {
        setMintedNfts([]);
        return;
      }

      setLoadingBalance(true);
      try {
        const logs = await publicClient.getLogs({
          address: nftContractAddress,
          event: NFT_TRANSFER_EVENT,
          fromBlock: BigInt(0),
          toBlock: "latest",
        });
        const owned = new Map<string, MintedNft>();
        const normalizedOwner = activeAddress.toLowerCase();

        for (const log of logs) {
          const from = log.args.from?.toLowerCase();
          const to = log.args.to?.toLowerCase();
          const tokenId = log.args.tokenId?.toString();
          if (!tokenId) continue;

          if (from === normalizedOwner) {
            owned.delete(tokenId);
          }
          if (to === normalizedOwner) {
            owned.set(tokenId, {
              blockNumber: log.blockNumber,
              imageUrl: `https://picsum.photos/seed/${tokenId}/800/600`,
              tokenId,
              txHash: log.transactionHash,
            });
          }
        }

        const blockTimestamps = new Map<bigint, string>();
        await Promise.all(
          Array.from(
            new Set(
              Array.from(owned.values())
                .map((nft) => nft.blockNumber)
                .filter((blockNumber): blockNumber is bigint => Boolean(blockNumber)),
            ),
          ).map(async (blockNumber) => {
            const block = await publicClient.getBlock({ blockNumber });
            blockTimestamps.set(
              blockNumber,
              new Date(Number(block.timestamp) * 1000).toISOString(),
            );
          }),
        );

        const nextNfts = Array.from(owned.values())
          .map((nft) => ({
            ...nft,
            timestamp: nft.blockNumber ? blockTimestamps.get(nft.blockNumber) : undefined,
          }))
          .sort((a, b) => compareBlockNumbers(a.blockNumber, b.blockNumber));
        setMintedNfts(nextNfts);
        onNftCountChange?.(nextNfts.length);
      } catch (err) {
        console.error("Failed to fetch owned NFTs:", err);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchOwnedNfts();
  }, [publicClient, activeAddress, hasUsableAddress, nftContractAddress, onNftCountChange]);

  useEffect(() => {
    if (!activeAddress || !nftContractAddress) {
      setMintedNfts([]);
      return;
    }
  }, [activeAddress, nftContractAddress]);

  const handleMintNft = async () => {
    if (!isConnected || !activeAddress || !hasUsableAddress) {
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
        args: [activeAddress],
      });

      // Refresh NFT balance after successful mint
      setTimeout(() => fetchNftBalance(), 3000);
    } catch (err) {
      console.error("Mint error:", err);
      setError("Mint failed");
    }
  };

  // Watch for transaction success and derive the minted NFT from Transfer logs.
  useEffect(() => {
    if (!mintTxHash || lastMintHashRef.current === mintTxHash) {
      return;
    }

    lastMintHashRef.current = mintTxHash;
    setError("");

    const loadMintReceipt = async () => {
      if (!publicClient || !activeAddress) return;

      setConfirmingMint(true);
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: mintTxHash,
        });
        const transferLogs = parseEventLogs({
          abi: NFT_CONTRACT_ABI,
          eventName: "Transfer",
          logs: receipt.logs,
        });
        const mintedTransfer = transferLogs.find((log) => {
          const { from, to } = log.args;
          return (
            from.toLowerCase() === zeroAddress &&
            to.toLowerCase() === activeAddress.toLowerCase()
          );
        });
        const tokenId = mintedTransfer?.args.tokenId?.toString();

        if (tokenId) {
          const block = await publicClient.getBlock({
            blockNumber: receipt.blockNumber,
          });
          setMintedNfts((current) => {
            if (current.some((item) => item.tokenId === tokenId)) return current;
            return [
              {
                blockNumber: receipt.blockNumber,
                imageUrl: `https://picsum.photos/seed/${tokenId}/800/600`,
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                tokenId,
                txHash: mintTxHash,
              },
              ...current,
            ];
          });
        }

        await fetchNftBalance();
      } catch (err) {
        console.error("Failed to confirm minted NFT:", err);
      } finally {
        setConfirmingMint(false);
      }
    };

    loadMintReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintTxHash, publicClient, activeAddress]);

  return (
    <div className="space-y-5">
      {!nftContractAddress && (
        <div className="flex items-start gap-2 px-4 py-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-sm text-yellow-700">
            NFT minting is not available on {chain?.name}. Switch to Arbitrum Sepolia to mint.
          </p>
        </div>
      )}

	      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <img
            src="https://picsum.photos/800/600"
            alt="Random image"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
        <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Free mint
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-950">
                Demo Collectible
              </h2>
            </div>
            <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-950">
              $0.00
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <CheckoutRow label="Network" value={chain?.name ?? "Current network"} />
            <CheckoutRow label="Gas" value="Sponsored" />
            <CheckoutRow label="Your NFTs" value={loadingBalance ? "Refreshing..." : String(mintedCount)} />
          </div>
          <button
            onClick={handleMintNft}
            disabled={mintInProgress || !activeAddress || !hasUsableAddress || !nftContractAddress}
            className={cn(
              "mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {mintInProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {confirmingMint ? "Confirming mint..." : "Minting NFT..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Mint for free
              </>
            )}
	          </button>
	        </div>
	      </div>

	      {(error || mintError) && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg overflow-hidden">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-900">Transaction Failed</p>
            <p className="text-sm text-red-700 mt-0.5 break-words line-clamp-3">
              {error || (mintError as unknown as { shortMessage?: string })?.shortMessage || mintError?.message}
            </p>
          </div>
        </div>
      )}

      {mintTxHash && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-lg">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              NFT minted into your wallet.
            </span>
          </div>
          <a
            href={`${explorerBaseUrl}/tx/${mintTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg",
              "hover:bg-gray-100 transition-colors group"
            )}
          >
            <span className="text-sm text-gray-700 font-medium">
              Confirm on Arbiscan
            </span>
            <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
          </a>
        </div>
      )}

      {galleryNfts.length > 0 && (
        <div id="minted-nfts" className="scroll-mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setNftsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
            aria-expanded={nftsOpen}
          >
            <span className="block text-sm font-semibold text-gray-950">
              My NFTs
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                nftsOpen && "rotate-180",
              )}
            />
          </button>
          {nftsOpen && (
            <div className="flex snap-x gap-3 overflow-x-auto border-t border-gray-200 p-4">
              {galleryNfts.map((nft) => (
                <div
                  key={`${nft.txHash ?? "owned"}-${nft.tokenId}`}
                  className="w-[260px] shrink-0 snap-start overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                >
                  <img
                    src={nft.imageUrl ?? `https://picsum.photos/seed/${nft.tokenId}/800/600`}
                    alt={`Minted NFT #${nft.tokenId}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="space-y-2 bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        Token ID
                      </span>
                      <span className="truncate font-mono text-sm font-semibold text-gray-950">
                        #{nft.tokenId}
                      </span>
                    </div>
                    {nft.txHash && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-gray-500">
                          Receipt
                        </span>
                        <span className="truncate font-mono text-xs font-medium text-gray-600">
                          {formatShortHash(nft.txHash)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        Minted
                      </span>
                      <span className="truncate text-xs font-medium text-gray-600">
                        {formatTimestamp(nft.timestamp)}
                      </span>
                    </div>
                    <a
                      href={nft.imageUrl ?? `https://picsum.photos/seed/${nft.tokenId}/800/600`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900"
                    >
                      Image link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {nft.txHash && (
                      <a
                        href={`${explorerBaseUrl}/tx/${nft.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
	                        className="flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100"
	                      >
	                        View receipt
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setCodeOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 bg-gray-950 px-4 py-3 text-left text-white transition-colors hover:bg-gray-900 cursor-pointer"
          aria-expanded={codeOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Code2 className="h-4 w-4 text-gray-300" />
            Code
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-300 transition-transform",
              codeOpen && "rotate-180",
            )}
          />
        </button>
        {codeOpen && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <a
                href="https://docs.zerodev.app/wallets"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
              >
                Wallet docs
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/zerodevapp/zerodev-wallet-sdk/blob/main/apps/zerodev-signer-demo/src/app/components/SendTransactionTest.tsx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
              >
                View source
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <CodeSnippet label="Signing the mint">
                <span className="text-purple-300">import</span>{" "}
                <span className="text-gray-100">{"{ useWriteContract }"}</span>{" "}
                <span className="text-purple-300">from</span>{" "}
                <span className="text-green-300">'wagmi'</span>
                {"\n\n"}
                <span className="text-purple-300">const</span>{" "}
                <span className="text-gray-100">{"{ writeContract }"}</span>{" "}
                <span className="text-purple-300">=</span>{" "}
                <span className="text-blue-300">useWriteContract</span>
                <span className="text-gray-100">()</span>
                {"\n\n"}
                <span className="text-blue-300">writeContract</span>
                <span className="text-gray-100">({"{"}</span>
                {"\n  "}
                <span className="text-cyan-200">address</span>
                <span className="text-gray-100">: nftContractAddress,</span>
                {"\n  "}
                <span className="text-cyan-200">abi</span>
                <span className="text-gray-100">: NFT_CONTRACT_ABI,</span>
                {"\n  "}
                <span className="text-cyan-200">functionName</span>
                <span className="text-gray-100">: </span>
                <span className="text-green-300">'mint'</span>
                <span className="text-gray-100">,</span>
                {"\n  "}
                <span className="text-cyan-200">args</span>
                <span className="text-gray-100">: [activeAddress],</span>
                {"\n"}
                <span className="text-gray-100">{"})"}</span>
              </CodeSnippet>
              <CodeSnippet label="Wallet setup">
                <span className="text-purple-300">export const</span>{" "}
                <span className="text-gray-100">config </span>
                <span className="text-purple-300">=</span>{" "}
                <span className="text-blue-300">createConfig</span>
                <span className="text-gray-100">({"{"}</span>
                {"\n  "}
                <span className="text-cyan-200">chains</span>
                <span className="text-gray-100">: [arbitrumSepolia, sepolia],</span>
                {"\n  "}
                <span className="text-cyan-200">connectors</span>
                <span className="text-gray-100">: [</span>
                {"\n    "}
                <span className="text-blue-300">zeroDevWallet</span>
                <span className="text-gray-100">({"{"}</span>
                {"\n      "}
                <span className="text-cyan-200">projectId</span>
                <span className="text-gray-100">,</span>
                {"\n      "}
                <span className="text-cyan-200">proxyBaseUrl</span>
                <span className="text-gray-100">,</span>
                {"\n      "}
                <span className="text-cyan-200">chains</span>
                <span className="text-gray-100">: [arbitrumSepolia, sepolia],</span>
                {"\n    "}
                <span className="text-gray-100">{"}),"}</span>
                {"\n  "}
                <span className="text-gray-100">],</span>
                {"\n"}
                <span className="text-gray-100">{"})"}</span>
              </CodeSnippet>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-gray-50 px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-950">{value}</span>
    </div>
  );
}

function CodeSnippet({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-gray-300">
        {label}
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-gray-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}
