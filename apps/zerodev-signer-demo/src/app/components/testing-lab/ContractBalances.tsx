"use client";

import { RefreshCw } from "lucide-react";
import { type Address, erc20Abi, erc721Abi, formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { cn } from "../../lib/utils";
import { getContractsByKind, type TestContract } from "./contracts";

function BalanceShell({
  contract,
  value,
  symbol,
  onRefresh,
  isFetching,
}: {
  contract: TestContract;
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
          title={contract.address}
        >
          {contract.address}
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
}: {
  contract: TestContract;
  account: Address;
}) {
  const { data, refetch, isFetching, isError } = useReadContracts({
    contracts: [
      { address: contract.address, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId: contract.chainId },
      { address: contract.address, abi: erc20Abi, functionName: "decimals", chainId: contract.chainId },
      { address: contract.address, abi: erc20Abi, functionName: "symbol", chainId: contract.chainId },
    ],
    query: { enabled: Boolean(account), refetchInterval: 15_000 },
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
}: {
  contract: TestContract;
  account: Address;
}) {
  const { data, refetch, isFetching, isError } = useReadContracts({
    contracts: [
      { address: contract.address, abi: erc721Abi, functionName: "balanceOf", args: [account], chainId: contract.chainId },
      { address: contract.address, abi: erc721Abi, functionName: "symbol", chainId: contract.chainId },
    ],
    query: { enabled: Boolean(account), refetchInterval: 15_000 },
  });

  const count = data?.[0]?.result as bigint | undefined;
  const symbol = (data?.[1]?.result as string | undefined) ?? "NFTs";

  const value = count != null ? count.toString() : isError ? "error" : "—";

  return (
    <BalanceShell
      contract={contract}
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
  const { address } = useAccount();
  const erc20Contracts = getContractsByKind("erc20");
  const erc721Contracts = getContractsByKind("erc721");

  if (erc20Contracts.length === 0 && erc721Contracts.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900">
        Contract balances
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Holdings of the active address for each deployed test contract (ERC20
        balance, ERC721 owned-NFT count).
      </p>
      <div className="mt-3 space-y-2">
        {address ? (
          <>
            {erc20Contracts.map((contract) => (
              <Erc20BalanceRow
                key={contract.key}
                contract={contract}
                account={address}
              />
            ))}
            {erc721Contracts.map((contract) => (
              <Erc721BalanceRow
                key={contract.key}
                contract={contract}
                account={address}
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
