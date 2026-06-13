"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, Loader2, Check, ChevronDown, Code2, ExternalLink, Trash2 } from "lucide-react";
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

const BURN_UNAVAILABLE_MESSAGE =
  "Burn is not enabled in this demo. The current gas policy sponsors the free mint flow, but not ERC-721 transferFrom calls.";

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

function getMintErrorMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }
  if (error instanceof Error) {
    if (
      error.message.toLowerCase().includes("unknown rpc error") ||
      error.message.toLowerCase().includes("user rejected")
    ) {
      return "Transaction confirmation was not completed.";
    }
    return error.message;
  }
  return "Mint did not complete. Try again.";
}

function SeamlessImage({
  alt,
  className,
  src,
}: {
  alt: string
  className?: string
  src: string
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
      <div
        className={cn(
          "absolute inset-0 bg-[linear-gradient(110deg,#f3f4f6_0%,#ffffff_45%,#f3f4f6_90%)] opacity-100 transition-opacity duration-300",
          loaded && "opacity-0",
        )}
      />
      <img
        key={src}
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 ease-out motion-reduce:transition-none",
          loaded && "opacity-100",
          className,
        )}
      />
    </div>
  );
}

export function SendTransactionTest({
  accountAddress,
  refreshKey = 0,
  nftFocusRequest = 0,
  onNftCountChange,
}: {
  accountAddress: Address | null
  refreshKey?: number
  nftFocusRequest?: number
  onNftCountChange?: (count: number) => void
}) {
  const [error, setError] = useState<string>("");
  const [nftBalance, setNftBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [mintedNfts, setMintedNfts] = useState<MintedNft[]>([]);
  const [confirmingMint, setConfirmingMint] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [nftsOpen, setNftsOpen] = useState(true);
  const [checkoutSeed, setCheckoutSeed] = useState("demo-collectible");
  const [checkoutImageVisible, setCheckoutImageVisible] = useState(true);
  const [renderMintToast, setRenderMintToast] = useState(false);
  const [mintToastVisible, setMintToastVisible] = useState(false);
  const [renderMintError, setRenderMintError] = useState(false);
  const [mintErrorVisible, setMintErrorVisible] = useState(false);
  const [mintErrorMessage, setMintErrorMessage] = useState("");
  const [mintErrorScope, setMintErrorScope] = useState<"mint" | "burn">("mint");
  const [mintCtaHighlighted, setMintCtaHighlighted] = useState(false);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [latestMintedTokenId, setLatestMintedTokenId] = useState<string | null>(null);
  const mintedImageByTokenIdRef = useRef<Record<string, string>>({});
  const pendingMintImageUrlRef = useRef<string>("https://picsum.photos/seed/demo-collectible/800/600");

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  const activeAddress = accountAddress ?? address;
  const hasUsableAddress =
    Boolean(activeAddress) && activeAddress?.toLowerCase() !== zeroAddress;
  const publicClient = usePublicClient({chainId: chain?.id});
  const { writeContractAsync, isPending: isMinting, error: mintError } = useWriteContract();

  const nftContractAddress = chain?.id ? NFT_CONTRACTS[chain.id] : undefined;
  const explorerBaseUrl = chain?.blockExplorers?.default?.url ?? "https://sepolia.arbiscan.io";
  const galleryNfts = mintedNfts;
  const mintedCount = mintedNfts.length || Number(nftBalance) || 0;
  const mintInProgress = isMinting || confirmingMint;
  const checkoutImageUrl = `https://picsum.photos/seed/${checkoutSeed}/800/600`;

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
  }, [isConnected, publicClient, activeAddress, nftContractAddress, refreshKey]);

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
              imageUrl:
                mintedImageByTokenIdRef.current[tokenId] ??
                `https://picsum.photos/seed/${tokenId}/800/600`,
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
  }, [publicClient, activeAddress, hasUsableAddress, nftContractAddress, onNftCountChange, refreshKey]);

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
    setRenderMintError(false);
    setMintErrorVisible(false);
    setMintErrorMessage("");
    setMintErrorScope("mint");
    setMintTxHash(undefined);
    pendingMintImageUrlRef.current = checkoutImageUrl;

    try {
      const txHash = await writeContractAsync({
        address: nftContractAddress,
        abi: NFT_CONTRACT_ABI,
        functionName: "mint",
        args: [activeAddress],
      });

      setConfirmingMint(true);
      setMintTxHash(txHash);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
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
          const mintedImageUrl = pendingMintImageUrlRef.current;
          mintedImageByTokenIdRef.current[tokenId] = mintedImageUrl;
          setLatestMintedTokenId(tokenId);
          setCheckoutImageVisible(false);
          window.setTimeout(() => {
            setCheckoutSeed(`demo-collectible-next-${tokenId}`);
            setCheckoutImageVisible(true);
          }, 180);
          setMintedNfts((current) => {
            if (current.some((item) => item.tokenId === tokenId)) {
              return current.map((item) =>
                item.tokenId === tokenId
                  ? { ...item, imageUrl: mintedImageUrl, txHash }
                  : item,
              );
            }
            return [
              {
                blockNumber: receipt.blockNumber,
                imageUrl: mintedImageUrl,
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                tokenId,
                txHash,
              },
              ...current,
            ];
          });
        }
      }

      await fetchNftBalance();
    } catch (err) {
      console.error("Mint error:", err);
      setMintErrorScope("mint");
      setError(getMintErrorMessage(err) || "Mint failed");
    } finally {
      setConfirmingMint(false);
    }
  };

  const handleBurnNft = async (tokenId: string) => {
    void tokenId;

    setMintErrorScope("burn");
    setMintErrorMessage(BURN_UNAVAILABLE_MESSAGE);
    setRenderMintError(true);
    setMintErrorVisible(true);
    window.setTimeout(() => {
      setMintErrorVisible(false);
    }, 7600);
    window.setTimeout(() => {
      setRenderMintError(false);
    }, 8000);
  };

  useEffect(() => {
    if (!mintTxHash) return;

    setRenderMintToast(true);
    const showFrame = window.requestAnimationFrame(() => {
      setMintToastVisible(true);
    });
    const hideTimeout = window.setTimeout(() => {
      setMintToastVisible(false);
    }, 7600);
    const unmountTimeout = window.setTimeout(() => {
      setRenderMintToast(false);
    }, 8000);

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(unmountTimeout);
    };
  }, [mintTxHash]);

  useEffect(() => {
    if (mintTxHash || mintedCount > 0 || !mintError) return;

    setMintErrorScope("mint");
    setMintErrorMessage(getMintErrorMessage(mintError));
    setRenderMintError(true);
    const showFrame = window.requestAnimationFrame(() => {
      setMintErrorVisible(true);
    });
    const hideTimeout = window.setTimeout(() => {
      setMintErrorVisible(false);
    }, 7600);
    const unmountTimeout = window.setTimeout(() => {
      setRenderMintError(false);
    }, 8000);

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(unmountTimeout);
    };
  }, [mintError, mintTxHash, mintedCount]);

  useEffect(() => {
    if (!error || (mintedCount > 0 && mintErrorScope !== "burn")) return;

    setMintErrorMessage(error);
    setRenderMintError(true);
    const showFrame = window.requestAnimationFrame(() => {
      setMintErrorVisible(true);
    });
    const hideTimeout = window.setTimeout(() => {
      setMintErrorVisible(false);
    }, 7600);
    const unmountTimeout = window.setTimeout(() => {
      setRenderMintError(false);
    }, 8000);

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(unmountTimeout);
    };
  }, [error, mintedCount, mintErrorScope]);

  useEffect(() => {
    if (mintedCount === 0 || mintErrorScope === "burn") return;

    setError("");
    setRenderMintError(false);
    setMintErrorVisible(false);
    setMintErrorMessage("");
  }, [mintedCount, mintErrorScope]);

  useEffect(() => {
    if (!nftFocusRequest) return;

    if (galleryNfts.length > 0) {
      setNftsOpen(true);
      requestAnimationFrame(() => {
        document
          .getElementById("minted-nfts")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    setMintCtaHighlighted(true);
    requestAnimationFrame(() => {
      document
        .getElementById("mint-nft-cta")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => {
      setMintCtaHighlighted(false);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [nftFocusRequest, galleryNfts.length]);

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
          <SeamlessImage
            src={checkoutImageUrl}
            alt="Random image"
            className={cn(
              "transition duration-300 ease-out motion-reduce:transition-none",
              checkoutImageVisible ? "scale-100 opacity-100" : "scale-[0.985] opacity-0",
            )}
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
            {latestMintedTokenId && (
              <CheckoutRow label="Last minted" value={`#${latestMintedTokenId}`} />
            )}
          </div>
          <button
            id="mint-nft-cta"
            onClick={handleMintNft}
            disabled={mintInProgress || !activeAddress || !hasUsableAddress || !nftContractAddress}
            className={cn(
              "mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-800 cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-50",
              mintCtaHighlighted && "ring-4 ring-blue-200",
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
                {mintedCount > 0 ? "Mint another" : "Mint for free"}
              </>
            )}
	          </button>
	        </div>
	      </div>

	      {(mintErrorScope === "burn" || mintedCount === 0) && renderMintError && mintErrorMessage && (
        <div
          className={cn(
            "flex items-start gap-2 overflow-hidden rounded-lg border border-red-100 bg-red-50 px-4 py-3 transition duration-300 ease-out motion-reduce:transition-none",
            mintErrorVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          )}
        >
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-900">
              {mintErrorScope === "burn" ? "Burn Failed" : "Transaction Failed"}
            </p>
            <p className="text-sm text-red-700 mt-0.5 break-words line-clamp-3">
              {mintErrorMessage}
            </p>
          </div>
        </div>
      )}

      {mintTxHash && renderMintToast && (
        <a
          href={`${explorerBaseUrl}/tx/${mintTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-between gap-4 rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition duration-300 ease-out hover:bg-green-100 motion-reduce:transition-none",
            mintToastVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="truncate text-sm font-medium text-green-700">
              NFT {latestMintedTokenId ? `#${latestMintedTokenId} ` : ""}minted. View tx {formatShortHash(mintTxHash)} on Arbiscan.
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-green-600" />
        </a>
      )}

      {galleryNfts.length > 0 && (
        <div id="minted-nfts" className="scroll-mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setNftsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
            aria-expanded={nftsOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-950">
              My NFTs
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                {galleryNfts.length}
              </span>
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
                  <SeamlessImage
                    src={nft.imageUrl ?? `https://picsum.photos/seed/${nft.tokenId}/800/600`}
                    alt={`Minted NFT #${nft.tokenId}`}
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
                        <a
                          href={`${explorerBaseUrl}/tx/${nft.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-xs font-medium text-gray-600 underline-offset-2 transition-colors hover:text-gray-950 hover:underline"
                        >
                          {formatShortHash(nft.txHash)}
                        </a>
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
                    <button
                      type="button"
                      onClick={() => handleBurnNft(nft.tokenId)}
                      className={cn(
                        "flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Burn unavailable
                    </button>
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
