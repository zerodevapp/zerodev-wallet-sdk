"use client";

import { waitForCallsStatus } from "@wagmi/core";
import type { OnChainCall } from "@zerodev/earn";
import { useCallback } from "react";
import type { Hex } from "viem";
import { useAccount, useConfig, useSendCalls, useSwitchChain } from "wagmi";

export type SendCalls = (calls: OnChainCall[], chainId: number) => Promise<Hex[]>;

/**
 * Send a quote's calls as one EIP-5792 batch on `chainId`. The connector builds
 * its kernel client per chain on connect/switchChain, so a chain the wallet
 * never selected is switched to first.
 */
export function useWalletSendCalls(): SendCalls {
  const config = useConfig();
  const { chainId: walletChainId } = useAccount();
  const { sendCallsAsync } = useSendCalls();
  const { switchChainAsync } = useSwitchChain();

  return useCallback(
    async (calls, chainId) => {
      if (walletChainId !== chainId) await switchChainAsync({ chainId });
      const { id } = await sendCallsAsync({
        calls: calls.map((c) => ({ to: c.to, value: BigInt(c.value), data: c.data })),
        chainId,
      });
      const { status, receipts } = await waitForCallsStatus(config, { id });
      if (status === "failure") throw new Error("Batch transaction failed");
      const hash = receipts?.[0]?.transactionHash;
      if (!hash) throw new Error("Batched call returned no receipt");
      return [hash];
    },
    [walletChainId, switchChainAsync, sendCallsAsync, config],
  );
}
