"use client";

import type { Vault } from "@zerodev/earn";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { errorMessage } from "./useEarnState";
import { earn } from "./utils/client";
import type { SendCalls } from "./useWalletSendCalls";

export type WithdrawPhase = "idle" | "preparing" | "sending" | "done" | "error";

/**
 * Exit a vault position. `withdrawFromVault` with neither `amount` nor `max`
 * is a preview: it reports the withdrawable balance and builds no calls.
 * Withdraw is same-chain and owner-signed, so there is no quote to expire.
 */
export function useVaultWithdraw(vault: Vault, owner: Address | undefined, sendCalls: SendCalls) {
  const [available, setAvailable] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<WithdrawPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<Hex[]>([]);
  // A preview in flight when the owner or vault changes must not write its
  // stale balance over the current one.
  const generation = useRef(0);

  const loadAvailable = useCallback(async () => {
    if (!owner) return;
    const gen = generation.current;
    setLoadError(null);
    try {
      const preview = await earn.withdrawFromVault({
        owner,
        vaultId: vault.id,
        chainId: vault.chainId,
      });
      if (gen !== generation.current) return;
      setAvailable(preview.available);
    } catch (e) {
      if (gen !== generation.current) return;
      setLoadError(errorMessage(e));
    }
  }, [owner, vault.id, vault.chainId]);

  useEffect(() => {
    generation.current += 1;
    setAvailable(null);
    setPhase("idle");
    setError(null);
    setTxHashes([]);
    void loadAvailable();
  }, [loadAvailable]);

  /** `amount` in display units, or `"max"` to exit the whole position. */
  const withdraw = useCallback(
    async (amount: string | "max") => {
      if (!owner) return;
      generation.current += 1;
      setError(null);
      setTxHashes([]);
      setPhase("preparing");
      try {
        const res = await earn.withdrawFromVault(
          amount === "max"
            ? { owner, vaultId: vault.id, chainId: vault.chainId, max: true }
            : { owner, vaultId: vault.id, chainId: vault.chainId, amount },
        );
        setAvailable(res.available);
        setPhase("sending");
        const hashes = await sendCalls(res.calls, res.chainId);
        setTxHashes(hashes);
        setPhase("done");
        void loadAvailable();
      } catch (e) {
        setError(errorMessage(e));
        setPhase("error");
      }
    },
    [owner, sendCalls, vault.id, vault.chainId, loadAvailable],
  );

  return { available, loadError, phase, error, txHashes, withdraw, reloadAvailable: loadAvailable };
}
