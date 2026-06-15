"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, Loader2, Check, ChevronDown, Code2, ExternalLink, Trash2, Shuffle } from "lucide-react";
import { cn } from "../lib/utils";
import {
  type Address,
  encodeFunctionData,
  parseAbi,
  parseEventLogs,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { getZeroDevConnector, getZeroDevStore } from "@zerodev/wallet-react";
import { sepolia } from "wagmi/chains";
import { useAccount, useConfig, usePublicClient } from "wagmi";

// Per-chain NFT contract addresses
const NFT_CONTRACTS: Record<number, `0x${string}`> = {
  [sepolia.id]: "0x34bE7f35132E97915633BC1fc020364EA5134863",
  [421614]: "0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808", // Arbitrum Sepolia
};

const NFT_CONTRACT_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
  "function ownerOf(uint256 tokenId) external view returns (address owner)",
  "function transferFrom(address from, address to, uint256 tokenId) public",
]);

const NFT_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

type MintedNft = {
  blockNumber?: bigint
  imageUrl?: string
  timestamp?: string
  tokenId: string
  txHash?: `0x${string}`
}

type MintStatus = "idle" | "submitting" | "submitted" | "confirmed" | "syncing";

function getPicsumImageUrl(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
}

function getDeterministicNftImageUrl(tokenId: string) {
  return getPicsumImageUrl(`nft-${tokenId}`);
}

function getNftImageUrl(tokenId: string, imageUrl?: string) {
  return imageUrl && imageUrl.trim().length > 0
    ? imageUrl
    : getDeterministicNftImageUrl(tokenId);
}

function getNftImageCacheKey({
  chainId,
  contractAddress,
  tokenId,
}: {
  chainId?: number
  contractAddress?: Address
  tokenId: string
}) {
  return chainId && contractAddress
    ? `zd:nft-image:${chainId}:${contractAddress.toLowerCase()}:${tokenId}`
    : undefined;
}

function getNftGalleryCacheKey({
  chainId,
  contractAddress,
  ownerAddress,
}: {
  chainId?: number
  contractAddress?: Address
  ownerAddress?: Address
}) {
  return chainId && contractAddress && ownerAddress
    ? `zd:nft-gallery:${chainId}:${contractAddress.toLowerCase()}:${ownerAddress.toLowerCase()}`
    : undefined;
}

function readCachedNftImageUrl(params: {
  chainId?: number
  contractAddress?: Address
  tokenId: string
}) {
  if (typeof window === "undefined") return undefined;
  const key = getNftImageCacheKey(params);
  if (!key) return undefined;
  return window.localStorage.getItem(key) ?? undefined;
}

function writeCachedNftImageUrl(
  params: {
    chainId?: number
    contractAddress?: Address
    tokenId: string
  },
  imageUrl: string,
) {
  if (typeof window === "undefined") return;
  const key = getNftImageCacheKey(params);
  if (!key) return;
  window.localStorage.setItem(key, imageUrl);
}

function readCachedNftGallery(params: {
  chainId?: number
  contractAddress?: Address
  ownerAddress?: Address
}) {
  if (typeof window === "undefined") return undefined;
  const key = getNftGalleryCacheKey(params);
  if (!key) return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Array<Omit<MintedNft, "blockNumber"> & { blockNumber?: string }>;
    return parsed.map((nft) => ({
      ...nft,
      blockNumber: nft.blockNumber ? BigInt(nft.blockNumber) : undefined,
      imageUrl: nft.imageUrl ?? getDeterministicNftImageUrl(nft.tokenId),
    }));
  } catch {
    return undefined;
  }
}

function writeCachedNftGallery(
  params: {
    chainId?: number
    contractAddress?: Address
    ownerAddress?: Address
  },
  nfts: MintedNft[],
) {
  if (typeof window === "undefined") return;
  const key = getNftGalleryCacheKey(params);
  if (!key) return;

  window.localStorage.setItem(
    key,
    JSON.stringify(
      nfts.map((nft) => ({
        ...nft,
        blockNumber: nft.blockNumber?.toString(),
      })),
    ),
  );
}

function formatShortHash(value: `0x${string}`) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isTransactionHash(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function toTransactionHash(value: unknown): `0x${string}` | null {
  return typeof value === "string" && isTransactionHash(value) ? value : null;
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

function getErrorText(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;

  const pieces: string[] = [];
  if (error instanceof Error) pieces.push(error.message);
  if (typeof error === "object") {
    for (const key of ["message", "shortMessage", "details"]) {
      if (
        key in error &&
        typeof error[key as keyof typeof error] === "string"
      ) {
        pieces.push(error[key as keyof typeof error] as string);
      }
    }
  }

  return pieces.join("\n");
}

function getMintErrorMessage(error: unknown) {
  const rawMessage = getErrorText(error);
  if (!rawMessage) return "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes("pm_getpaymasterdata") ||
    normalizedMessage.includes("pm_getpaymasterstubdata") ||
    normalizedMessage.includes("did not match any gas sponsoring policies") ||
    normalizedMessage.includes("no erc20 gas token data present")
  ) {
    return "Gas sponsorship rejected this action. Check that this contract and function are allowed in the dashboard gas policy, then try again.";
  }

  if (
    error &&
    typeof error === "object" &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("http request failed")) {
      return "Wallet is catching up. Try again in 1-2 seconds.";
    }
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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timeoutId: number;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function SeamlessImage({
  alt,
  aspectClassName = "aspect-[4/3]",
  className,
  fallbackSrc,
  src,
}: {
  alt: string
  aspectClassName?: string
  className?: string
  fallbackSrc?: string
  src: string
}) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setLoaded(false);
    setCurrentSrc(src);
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-gray-100", aspectClassName)}>
      <div
        className={cn(
          "absolute inset-0 bg-[linear-gradient(110deg,#f3f4f6_0%,#ffffff_45%,#f3f4f6_90%)] opacity-100 transition-opacity duration-300",
          loaded && "opacity-0",
        )}
      />
      <img
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          const fallback = fallbackSrc ?? src;
          if (currentSrc !== fallback) {
            setCurrentSrc(fallback);
          }
        }}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition duration-500 ease-out motion-reduce:transition-none",
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
  const [mintedNfts, setMintedNfts] = useState<MintedNft[]>([]);
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [codeOpen, setCodeOpen] = useState(false);
  const [nftsOpen, setNftsOpen] = useState(false);
  const [checkoutImageVisible, setCheckoutImageVisible] = useState(true);
  const [nextMintTokenId, setNextMintTokenId] = useState<string>("preview");
  const [previewImageSeed, setPreviewImageSeed] = useState<string>("demo-collectible");
  const [renderMintToast, setRenderMintToast] = useState(false);
  const [mintToastVisible, setMintToastVisible] = useState(false);
  const [renderBurnToast, setRenderBurnToast] = useState(false);
  const [burnToastVisible, setBurnToastVisible] = useState(false);
  const [renderMintError, setRenderMintError] = useState(false);
  const [mintErrorVisible, setMintErrorVisible] = useState(false);
  const [mintErrorMessage, setMintErrorMessage] = useState("");
  const [mintErrorScope, setMintErrorScope] = useState<"mint" | "burn">("mint");
  const [mintCtaHighlighted, setMintCtaHighlighted] = useState(false);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | undefined>();
  const [burningTokenId, setBurningTokenId] = useState<string | null>(null);
  const [removingTokenId, setRemovingTokenId] = useState<string | null>(null);
  const [latestBurnedTokenId, setLatestBurnedTokenId] = useState<string | null>(null);
  const [latestMintedTokenId, setLatestMintedTokenId] = useState<string | null>(null);
  const selectedImageByTokenIdRef = useRef<Record<string, string>>({});

  // Wagmi hooks
  const { address, isConnected, chain } = useAccount();
  const wagmiConfig = useConfig();
  const activeAddress = accountAddress ?? address;
  const hasUsableAddress =
    Boolean(activeAddress) && activeAddress?.toLowerCase() !== zeroAddress;
  const publicClient = usePublicClient({chainId: chain?.id});

  const nftContractAddress = chain?.id ? NFT_CONTRACTS[chain.id] : undefined;
  const explorerBaseUrl = chain?.blockExplorers?.default?.url ?? "https://sepolia.arbiscan.io";
  const galleryNfts = mintedNfts;
  const mintedCount = mintedNfts.length;
  const mintInProgress = mintStatus !== "idle";
  const nftActionInProgress = mintInProgress || Boolean(burningTokenId);
  const checkoutImageUrl = getPicsumImageUrl(previewImageSeed);
  const nextMintLabel = nextMintTokenId === "preview" ? "Next" : `#${nextMintTokenId}`;
  const mintStatusSteps = [
    {
      key: "submitting",
      label: "Submitting",
      done: mintStatus !== "idle",
      active: mintStatus === "submitting",
    },
    {
      key: "submitted",
      label: "Tx submitted",
      done: ["submitted", "confirmed", "syncing"].includes(mintStatus),
      active: mintStatus === "submitted",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      done: ["confirmed", "syncing"].includes(mintStatus),
      active: mintStatus === "confirmed",
    },
    {
      key: "syncing",
      label: "Wallet updated",
      done: mintStatus === "syncing",
      active: mintStatus === "syncing",
    },
  ];

  const randomizePreviewImage = () => {
    if (nftActionInProgress) return;
    const nextSeed = `demo-collectible-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    setCheckoutImageVisible(false);
    window.setTimeout(() => {
      setPreviewImageSeed(nextSeed);
      setCheckoutImageVisible(true);
    }, 120);
  };

  const sendNftTransaction = async (data: `0x${string}`) => {
    if (!chain?.id || !nftContractAddress) {
      throw new Error("NFT transaction is not available on this chain.");
    }

    const store = await getZeroDevStore(getZeroDevConnector(wagmiConfig));
    let kernelClient = store.getState().kernelClients.get(chain.id);
    const startedAt = Date.now();
    while (!kernelClient && Date.now() - startedAt < 3000) {
      await wait(250);
      kernelClient = store.getState().kernelClients.get(chain.id);
    }

    if (!kernelClient) {
      throw new Error("Smart account client is not ready. Reconnect the wallet and try again.");
    }

    const txHash = toTransactionHash(
      await withTimeout(
        kernelClient.sendTransaction({
          calls: [
            {
              to: nftContractAddress,
              data,
              value: BigInt(0),
            },
          ],
        }),
        30000,
        "Wallet RPC did not respond. Try again in a moment.",
      ),
    );

    if (!txHash) {
      throw new Error("The smart account did not return a transaction hash.");
    }

    return txHash;
  };

  const waitForNftTransactionReceipt = async (txHash: `0x${string}`) => {
    if (!publicClient) {
      throw new Error("RPC client is not ready");
    }

    const startedAt = Date.now();
    let lastError: unknown;

    while (Date.now() - startedAt < 60000) {
      let receipt;
      try {
        receipt = await publicClient.getTransactionReceipt({ hash: txHash });
      } catch (err) {
        lastError = err;
        await wait(1000);
        continue;
      }

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted.");
      }
      return receipt;
    }

    throw lastError instanceof Error
      ? new Error(`Transaction was submitted but the receipt is still indexing. ${lastError.message}`)
      : new Error("Transaction was submitted but the receipt is still indexing.");
  };

  const setGallery = (nextNfts: MintedNft[]) => {
    setMintedNfts(nextNfts);
  };

  const addGalleryNft = (nft: MintedNft) => {
    setMintedNfts((current) => {
      const withoutDuplicate = current.filter((item) => item.tokenId !== nft.tokenId);
      return [nft, ...withoutDuplicate].sort((a, b) =>
        compareBlockNumbers(a.blockNumber, b.blockNumber),
      );
    });
  };

  const removeGalleryNft = (tokenId: string) => {
    setMintedNfts((current) => {
      return current.filter((nft) => nft.tokenId !== tokenId);
    });
  };

  useEffect(() => {
    onNftCountChange?.(mintedNfts.length);

    if (!activeAddress || !hasUsableAddress || !nftContractAddress) return;

    writeCachedNftGallery(
      {
        chainId: chain?.id,
        contractAddress: nftContractAddress,
        ownerAddress: activeAddress,
      },
      mintedNfts,
    );
  }, [
    activeAddress,
    chain?.id,
    hasUsableAddress,
    mintedNfts,
    nftContractAddress,
    onNftCountChange,
  ]);

  const rebuildGalleryFromLogs = async () => {
    if (!publicClient || !activeAddress || !hasUsableAddress || !nftContractAddress) {
      return [];
    }

    try {
      const logs = await publicClient.getLogs({
        address: nftContractAddress,
        event: NFT_TRANSFER_EVENT,
        fromBlock: BigInt(0),
        toBlock: "latest",
      });
      const owned = new Map<string, MintedNft>();
      const normalizedOwner = activeAddress.toLowerCase();
      let highestTokenId: bigint | undefined;

      for (const log of logs) {
        const from = log.args.from?.toLowerCase();
        const to = log.args.to?.toLowerCase();
        const tokenId = log.args.tokenId?.toString();
        if (!tokenId) continue;

        const tokenIdBigInt = BigInt(tokenId);
        if (highestTokenId === undefined || tokenIdBigInt > highestTokenId) {
          highestTokenId = tokenIdBigInt;
        }

        if (from === normalizedOwner) {
          owned.delete(tokenId);
        }
        if (to === normalizedOwner) {
          owned.set(tokenId, {
            blockNumber: log.blockNumber,
            tokenId,
            txHash: log.transactionHash,
          });
        }
      }

      if (highestTokenId !== undefined) {
        setNextMintTokenId((highestTokenId + BigInt(1)).toString());
      }

      const imageUrls = new Map<string, string>();
      Array.from(owned.keys()).forEach((tokenId) => {
        const selectedImageUrl = selectedImageByTokenIdRef.current[tokenId];
        if (selectedImageUrl) {
          imageUrls.set(tokenId, selectedImageUrl);
          return;
        }

        const cachedImageUrl = readCachedNftImageUrl({
          chainId: chain?.id,
          contractAddress: nftContractAddress,
          tokenId,
        });
        if (cachedImageUrl) {
          imageUrls.set(tokenId, cachedImageUrl);
          return;
        }

        imageUrls.set(tokenId, getNftImageUrl(tokenId));
      });

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

      return Array.from(owned.values())
        .map((nft) => ({
          ...nft,
          imageUrl: imageUrls.get(nft.tokenId) ?? getNftImageUrl(nft.tokenId),
          timestamp: nft.blockNumber ? blockTimestamps.get(nft.blockNumber) : undefined,
        }))
        .sort((a, b) => compareBlockNumbers(a.blockNumber, b.blockNumber));
    } catch (err) {
      console.info("Could not rebuild NFT gallery from logs:", getMintErrorMessage(err));
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadGallery = async () => {
      if (!activeAddress || !hasUsableAddress || !nftContractAddress) {
        setMintedNfts([]);
        return;
      }

      const cachedNfts = readCachedNftGallery({
        chainId: chain?.id,
        contractAddress: nftContractAddress,
        ownerAddress: activeAddress,
      });

      if (cachedNfts) {
        if (cancelled) return;
        setMintedNfts(cachedNfts);
        const highestTokenId = cachedNfts.reduce<bigint | undefined>((highest, nft) => {
          const tokenId = BigInt(nft.tokenId);
          return highest === undefined || tokenId > highest ? tokenId : highest;
        }, undefined);
        if (highestTokenId !== undefined) {
          setNextMintTokenId((highestTokenId + BigInt(1)).toString());
        }
        return;
      }

      const rebuiltNfts = await rebuildGalleryFromLogs();
      if (cancelled) return;
      setGallery(rebuiltNfts);
    };

    loadGallery();

    return () => {
      cancelled = true;
    };
    // Only rebuild from logs when there is no local gallery cache for this account/contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress, chain?.id, hasUsableAddress, nftContractAddress, publicClient, refreshKey]);

  const handleMintNft = async () => {
    if (nftActionInProgress) return;
    if (!isConnected || !activeAddress || !hasUsableAddress) {
      setError("Please authenticate first");
      return;
    }
    if (!nftContractAddress) {
      setError("NFT minting is not available on this chain");
      return;
    }
    if (!publicClient) {
      setError("RPC client is not ready");
      return;
    }

    setError("");
    setRenderMintError(false);
    setMintErrorVisible(false);
    setMintErrorMessage("");
    setMintErrorScope("mint");
    setMintTxHash(undefined);
    setMintStatus("submitting");
    setNftsOpen(false);
    const selectedImageUrl = checkoutImageUrl;

    let submittedTxHash: `0x${string}` | undefined;
    try {
      const txHash = await sendNftTransaction(encodeFunctionData({
        abi: NFT_CONTRACT_ABI,
        functionName: "mint",
        args: [activeAddress],
      }));
      submittedTxHash = txHash;

      setMintStatus("submitted");
      setMintTxHash(txHash);

      const receipt = await waitForNftTransactionReceipt(txHash);
      setMintStatus("confirmed");
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
        let timestamp = new Date().toISOString();
        try {
          const block = await publicClient.getBlock({
            blockNumber: receipt.blockNumber,
          });
          timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
        } catch (blockError) {
          console.info("Could not fetch mint block timestamp:", getMintErrorMessage(blockError));
        }
        const mintedImageUrl = selectedImageUrl;
        selectedImageByTokenIdRef.current[tokenId] = mintedImageUrl;
        writeCachedNftImageUrl(
          {
            chainId: chain?.id,
            contractAddress: nftContractAddress,
            tokenId,
          },
          mintedImageUrl,
        );
        setLatestMintedTokenId(tokenId);
        setCheckoutImageVisible(false);
        window.setTimeout(() => {
          setNextMintTokenId((BigInt(tokenId) + BigInt(1)).toString());
          setPreviewImageSeed(`demo-collectible-${BigInt(tokenId) + BigInt(1)}`);
          setCheckoutImageVisible(true);
        }, 180);
        setMintStatus("syncing");
        addGalleryNft({
          blockNumber: receipt.blockNumber,
          imageUrl: mintedImageUrl,
          timestamp,
          tokenId,
          txHash,
        });
      }

      setMintStatus("idle");
    } catch (err) {
      console.info("Mint did not complete:", getMintErrorMessage(err));
      setMintErrorScope("mint");

      if (submittedTxHash) {
        setMintTxHash(submittedTxHash);
        setError("Transaction was submitted, but the receipt is still indexing. Check Arbiscan and try refreshing the NFTs if it does not appear.");
      } else {
        const message = getMintErrorMessage(err) || "Mint failed";
        setError(message);
      }
      setMintStatus("idle");
    }
  };

  const handleBurnNft = async (tokenId: string) => {
    if (!isConnected || !activeAddress || !hasUsableAddress) {
      setMintErrorScope("burn");
      setError("Please authenticate first");
      return;
    }
    if (!nftContractAddress) {
      setMintErrorScope("burn");
      setError("NFT burn is not available on this chain");
      return;
    }
    if (!publicClient) {
      setMintErrorScope("burn");
      setError("RPC client is not ready");
      return;
    }

    setError("");
    setMintErrorScope("burn");
    setRenderMintError(false);
    setMintErrorVisible(false);
    setMintErrorMessage("");
    setBurnTxHash(undefined);
    setBurningTokenId(tokenId);

    try {
      const tokenIdBigInt = BigInt(tokenId);
      const owner = await publicClient.readContract({
        address: nftContractAddress,
        abi: NFT_CONTRACT_ABI,
        functionName: "ownerOf",
        args: [tokenIdBigInt],
      });

      if (owner.toLowerCase() !== activeAddress.toLowerCase()) {
        removeGalleryNft(tokenId);
        throw new Error(
          `NFT #${tokenId} is owned by ${formatShortHash(owner)}, not this wallet.`,
        );
      }

      const txHash = await sendNftTransaction(encodeFunctionData({
        abi: NFT_CONTRACT_ABI,
        functionName: "transferFrom",
        args: [owner, DEAD_ADDRESS, tokenIdBigInt],
      }));

      await waitForNftTransactionReceipt(txHash);

      setLatestBurnedTokenId(tokenId);
      setBurnTxHash(txHash);
      setRemovingTokenId(tokenId);
      window.setTimeout(() => {
        removeGalleryNft(tokenId);
        setRemovingTokenId((current) => current === tokenId ? null : current);
      }, 220);
    } catch (err) {
      console.info("Burn did not complete:", getMintErrorMessage(err));
      setMintErrorScope("burn");
      setError(getMintErrorMessage(err) || "Burn failed");
    } finally {
      setBurningTokenId(null);
    }
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
    if (!burnTxHash) return;

    setRenderBurnToast(true);
    const showFrame = window.requestAnimationFrame(() => {
      setBurnToastVisible(true);
    });
    const hideTimeout = window.setTimeout(() => {
      setBurnToastVisible(false);
    }, 7600);
    const unmountTimeout = window.setTimeout(() => {
      setRenderBurnToast(false);
    }, 8000);

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(unmountTimeout);
    };
  }, [burnTxHash]);

  useEffect(() => {
    if (!error) return;

    const hideAfter = 4200;
    const unmountAfter = hideAfter + 300;

    setMintErrorMessage(error);
    setRenderMintError(true);
    const showFrame = window.requestAnimationFrame(() => {
      setMintErrorVisible(true);
    });
    const hideTimeout = window.setTimeout(() => {
      setMintErrorVisible(false);
    }, hideAfter);
    const unmountTimeout = window.setTimeout(() => {
      setRenderMintError(false);
    }, unmountAfter);

    return () => {
      window.cancelAnimationFrame(showFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(unmountTimeout);
    };
  }, [error, mintedCount, mintErrorScope]);

  useEffect(() => {
    if (!mintTxHash || mintErrorScope === "burn") return;

    setError("");
    setRenderMintError(false);
    setMintErrorVisible(false);
    setMintErrorMessage("");
  }, [mintTxHash, mintErrorScope]);

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

  const notification =
    renderMintError && mintErrorMessage
      ? {
          key: "error",
          visible: mintErrorVisible,
          tone: "error" as const,
          icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />,
          title: mintErrorScope === "burn" ? "Burn failed" : "Transaction failed",
          message: mintErrorMessage,
        }
      : mintTxHash && renderMintToast
        ? {
            key: "mint",
            visible: mintToastVisible,
            tone: "success" as const,
            href: `${explorerBaseUrl}/tx/${mintTxHash}`,
            icon: <Check className="h-4 w-4 shrink-0 text-emerald-700" />,
            title: "NFT minted",
            message: latestMintedTokenId
              ? `NFT #${latestMintedTokenId} minted.`
              : "NFT minted.",
            action: `View tx ${formatShortHash(mintTxHash)}`,
          }
        : burnTxHash && renderBurnToast
          ? {
              key: "burn",
              visible: burnToastVisible,
              tone: "success" as const,
              href: `${explorerBaseUrl}/tx/${burnTxHash}`,
              icon: <Check className="h-4 w-4 shrink-0 text-emerald-700" />,
              title: "NFT burned",
              message: latestBurnedTokenId
                ? `NFT #${latestBurnedTokenId} burned.`
                : "NFT burned.",
              action: `View tx ${formatShortHash(burnTxHash)}`,
            }
          : null;

  return (
    <div className="space-y-5">
      {notification && (
        <div
          className={cn(
            "fixed inset-x-0 top-20 z-50 pointer-events-none border-b backdrop-blur-xl transition duration-300 ease-out motion-reduce:transition-none",
            notification.tone === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
              : "border-red-200 bg-red-50/95 text-red-950",
            notification.visible
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0",
          )}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {notification.href ? (
              <a
                key={notification.key}
                href={notification.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "pointer-events-auto flex min-h-10 items-center justify-between gap-4 py-2 transition-colors",
                  notification.tone === "success"
                    ? "hover:text-emerald-800"
                    : "border-red-200 bg-red-50/95 text-red-950",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {notification.icon}
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">{notification.title}</span>
                    <span className="text-current/75"> · {notification.message}</span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold underline underline-offset-4">
                  {notification.action}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </a>
            ) : (
              <div
                key={notification.key}
                className="pointer-events-auto flex min-h-10 items-start gap-2 py-2 text-red-950"
              >
                {notification.icon}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{notification.title}</p>
                  <p className="line-clamp-2 break-words text-red-700">
                    {notification.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!nftContractAddress && (
        <div className="flex items-start gap-2 px-4 py-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-sm text-yellow-700">
            NFT minting is not available on {chain?.name}. Switch to Arbitrum Sepolia to mint.
          </p>
        </div>
      )}

	      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <SeamlessImage
          src={checkoutImageUrl}
          fallbackSrc={checkoutImageUrl}
          alt="Demo collectible preview"
          aspectClassName="aspect-[16/9]"
          className={cn(
            "transition duration-300 ease-out motion-reduce:transition-none",
            checkoutImageVisible ? "scale-100 opacity-100" : "scale-[0.985] opacity-0",
          )}
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">
                Demo Collectible {nextMintLabel}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              {chain?.name ?? "Current network"}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              Free
            </span>
            <span className="rounded-full bg-green-50 px-3 py-1 font-semibold text-green-700">
              Sponsored gas
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
            <button
              type="button"
              onClick={randomizePreviewImage}
              disabled={nftActionInProgress}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Shuffle className="h-4 w-4" />
              Try another
            </button>
            <button
              id="mint-nft-cta"
              onClick={handleMintNft}
              disabled={nftActionInProgress || !activeAddress || !hasUsableAddress || !nftContractAddress}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-800 cursor-pointer",
                "disabled:cursor-not-allowed disabled:opacity-50",
                mintCtaHighlighted && "ring-4 ring-blue-200",
              )}
            >
              {mintStatus === "syncing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing next mint...
                </>
              ) : mintInProgress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mintStatus === "submitted" || mintStatus === "confirmed"
                    ? "Confirming mint..."
                    : "Minting NFT..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Mint this NFT
                </>
              )}
	          </button>
          </div>
          {mintInProgress && (
            <div className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-4">
              {mintStatusSteps.map((step) => (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-gray-500",
                    step.done && "text-gray-950",
                    step.active && "bg-white shadow-sm",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full bg-gray-200",
                      step.done && "bg-emerald-100 text-emerald-800",
                    )}
                  >
                    {step.active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : step.done ? (
                      <Check className="h-3 w-3" />
                    ) : null}
                  </span>
                  {step.label}
                </div>
              ))}
            </div>
          )}
	      </div>
      </div>

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
                  className={cn(
                    "w-[260px] shrink-0 snap-start overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition duration-200 ease-out motion-reduce:transition-none",
                    removingTokenId === nft.tokenId && "scale-[0.98] opacity-0",
                  )}
                >
                  <SeamlessImage
                    src={getNftImageUrl(nft.tokenId, nft.imageUrl)}
                    fallbackSrc={getDeterministicNftImageUrl(nft.tokenId)}
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
                      href={getNftImageUrl(nft.tokenId, nft.imageUrl)}
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
                      disabled={nftActionInProgress}
                      className={cn(
                        "flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                      )}
                    >
                      {burningTokenId === nft.tokenId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {burningTokenId === nft.tokenId ? "Burning..." : "Burn"}
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
