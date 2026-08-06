"use client";

import { AlertCircle, Sparkles } from "lucide-react";
import { type Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { cn } from "../../lib/utils";
import { DEMO_NFT_ADDRESSES, demoNftAbi } from "./contracts";
import { ClearRunsButton, TxRunList, useTxRuns } from "./txRuns";

const shortAddress = (value: string) =>
  value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;

/**
 * Test Case — the gas-free mint `zerodev-signer-demo` performs, against the
 * same per-chain NFT contracts. Kept alongside `Erc721ContractTest` rather than
 * replacing it: this one is the demo's flow on the demo's contract (and works
 * on both default chains), that one is the lab's own ERC721 with every write
 * function exposed.
 */
export function DemoNftMintTest() {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { runs, track, clear } = useTxRuns();

  const nftAddress = chain ? DEMO_NFT_ADDRESSES[chain.id] : undefined;

  const handleMint = () => {
    const to = (address ?? "") as Address;
    track(`mint(${shortAddress(to)}) on ${chain?.name ?? "unknown chain"}`, () => {
      if (!nftAddress) {
        throw new Error(
          `No demo NFT deployed on ${chain?.name ?? "this chain"} (${chain?.id})`,
        );
      }
      return writeContractAsync({
        address: nftAddress,
        abi: demoNftAbi,
        functionName: "mint",
        args: [to],
      });
    });
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
      data-testid="case-demo-nft-mint"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Gas-free mint (demo NFT)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Mints to the connected wallet on the signer demo&apos;s NFT
            contract. Deployed on Sepolia and Arbitrum Sepolia, so it follows
            whichever of the two the wallet is on.
          </p>
        </div>
        {runs.length > 0 && <ClearRunsButton onClear={clear} />}
      </div>

      {!nftAddress && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700" data-testid="demo-nft-no-deployment">
            No demo NFT on {chain?.name ?? "this chain"}. Switch to Sepolia or
            Arbitrum Sepolia.
          </p>
        </div>
      )}

      <dl className="mt-4 space-y-1.5 font-mono text-xs text-gray-500">
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-400">contract</dt>
          <dd className="min-w-0 truncate" data-testid="demo-nft-address">
            {nftAddress ?? "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-400">to</dt>
          <dd className="min-w-0 truncate">{address ?? "—"}</dd>
        </div>
      </dl>

      <div aria-hidden className="grow" />
      <button
        onClick={handleMint}
        data-testid="demo-nft-mint-submit"
        className={cn(
          "mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer",
          "border border-gray-950 bg-gray-950 text-white hover:bg-black hover:shadow-sm",
          "flex items-center justify-center gap-2",
        )}
      >
        <Sparkles className="h-4 w-4" />
        Mint
      </button>

      <TxRunList runs={runs} />
    </div>
  );
}
