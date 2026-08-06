"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { type Address, erc20Abi, erc721Abi, formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { cn } from "../../lib/utils";
import {
  addressOn,
  getContractsByKind,
  isTestContractChain,
  TEST_CONTRACT_CHAIN_NAMES,
  type TestContract,
} from "./contracts";

function BalanceShell({
  contract,
  address,
  value,
  symbol,
  onRefresh,
  isFetching,
}: {
  contract: TestContract;
  address: Address | undefined;
  value: string;
  symbol: string;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{contract.name}</p>
        <p
          className="truncate font-mono text-[11px] text-gray-400"
          title={address}
        >
          {address ?? "not deployed here"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {value}
          {symbol && (
            <span className="ml-1 font-normal text-gray-500">{symbol}</span>
          )}
        </span>
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-50 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}

function Erc20BalanceRow({
  contract,
  account,
  chainId,
}: {
  contract: TestContract;
  account: Address;
  chainId: number | undefined;
}) {
  const address = addressOn(contract, chainId);
  const { data, refetch, isFetching, isError } = useReadContracts({
    contracts: [
      { address, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId },
      { address, abi: erc20Abi, functionName: "decimals", chainId },
      { address, abi: erc20Abi, functionName: "symbol", chainId },
    ],
    query: { enabled: Boolean(account && address), refetchInterval: 15_000 },
  });

  const balance = data?.[0]?.result as bigint | undefined;
  const decimals = data?.[1]?.result as number | undefined;
  const symbol = (data?.[2]?.result as string | undefined) ?? "";

  const value =
    balance != null && decimals != null
      ? Number(formatUnits(balance, decimals)).toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })
      : isError
        ? "error"
        : "—";

  return (
    <BalanceShell
      contract={contract}
      address={address}
      value={value}
      symbol={symbol}
      onRefresh={() => refetch()}
      isFetching={isFetching}
    />
  );
}

function Erc721BalanceRow({
  contract,
  account,
  chainId,
}: {
  contract: TestContract;
  account: Address;
  chainId: number | undefined;
}) {
  const address = addressOn(contract, chainId);
  const { data, refetch, isFetching, isError } = useReadContracts({
    contracts: [
      { address, abi: erc721Abi, functionName: "balanceOf", args: [account], chainId },
      { address, abi: erc721Abi, functionName: "symbol", chainId },
    ],
    query: { enabled: Boolean(account && address), refetchInterval: 15_000 },
  });

  const count = data?.[0]?.result as bigint | undefined;
  const symbol = (data?.[1]?.result as string | undefined) ?? "NFTs";

  const value = count != null ? count.toString() : isError ? "error" : "—";

  return (
    <BalanceShell
      contract={contract}
      address={address}
      value={value}
      symbol={symbol}
      onRefresh={() => refetch()}
      isFetching={isFetching}
    />
  );
}

/**
 * Dynamic balance panel for the Contracts tab — queries the active address's
 * holdings for each deployed test contract (see `contracts.ts`): ERC20 token
 * balance and ERC721 owned-NFT count.
 */
export function ContractBalances() {
  const { address, chain } = useAccount();
  const erc20Contracts = getContractsByKind("erc20");
  const erc721Contracts = getContractsByKind("erc721");

  // Only flag a mismatch once a chain is actually known — while disconnected
  // the panel shows its "connect a wallet" state instead.
  const unsupportedChain = Boolean(chain && !isTestContractChain(chain.id));

  if (erc20Contracts.length === 0 && erc721Contracts.length === 0) return null;

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900">
        Contract balances
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Holdings of the active address for each deployed test contract (ERC20
        balance, ERC721 owned-NFT count), on{" "}
        <span
          className="font-medium text-gray-700"
          data-testid="contract-balances-chain"
        >
          {chain?.name ?? "the connected chain"}
        </span>
        . Each chain is a separate deployment, so balances don&apos;t carry
        across.
      </p>

      {unsupportedChain && (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5"
          data-testid="contract-balances-wrong-chain"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Your wallet is on{" "}
            <span className="font-semibold">{chain?.name}</span>, where none of
            these are deployed. Switch to {TEST_CONTRACT_CHAIN_NAMES} (top of
            the dashboard) — the write tests below are disabled until you do.
          </p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {address ? (
          <>
            {erc20Contracts.map((contract) => (
              <Erc20BalanceRow
                key={contract.key}
                contract={contract}
                account={address}
                chainId={chain?.id}
              />
            ))}
            {erc721Contracts.map((contract) => (
              <Erc721BalanceRow
                key={contract.key}
                contract={contract}
                account={address}
                chainId={chain?.id}
              />
            ))}
          </>
        ) : (
          <p className="text-sm text-gray-400">Connect a wallet to view balances.</p>
        )}
      </div>
    </div>
  );
}
