import { earnChains } from "../../../wagmi-config";

export type EarnChainId = (typeof earnChains)[number]["id"];

export const EARN_CHAIN_IDS: number[] = earnChains.map((c) => c.id);

export const CHAIN_NAME: Record<number, string> = Object.fromEntries(
  earnChains.map((c) => [c.id, c.name]),
);

const EXPLORER: Record<number, string> = Object.fromEntries(
  earnChains.map((c) => [c.id, c.blockExplorers.default.url]),
);

export function chainName(chainId: number): string {
  return CHAIN_NAME[chainId] ?? String(chainId);
}

export function explorerTx(chainId: number, hash: string): string {
  return `${EXPLORER[chainId] ?? "https://etherscan.io"}/tx/${hash}`;
}

export function explorerAddress(chainId: number, address: string): string {
  return `${EXPLORER[chainId] ?? "https://etherscan.io"}/address/${address}`;
}

export function sraDashboard(sra: string): string {
  return `https://smart-routing-address.zerodev.app/address/${sra}`;
}
