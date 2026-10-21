"use client";

import type { OnChainCall } from "@zerodev/earn";
import { useCallback, useState } from "react";
import type { Address, Hex } from "viem";
import { earn } from "./utils/client";
import type { DepositRecord } from "./utils/historyStore";
import type { SendCalls } from "./useWalletSendCalls";

export type RecoveryPhase = "idle" | "preparing" | "withdrawing" | "done" | "error";

/**
 * Pull funds stranded in an SRA back to the owner: tokens that landed but never
 * executed into the vault. Builds the recovery calls server-side and sends them
 * per chain.
 */
export function useSraRecovery(rec: DepositRecord, owner: Address | undefined, sendCalls: SendCalls) {
  const [phase, setPhase] = useState<RecoveryPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<Hex[]>([]);

  const withdraw = useCallback(async () => {
    if (!owner) return;
    setError(null);
    setTxHashes([]);
    setPhase("preparing");
    try {
      const status = await earn.getStatus(rec.sra);
      const seen = new Set<string>();
      const tokens: { chainId: number; token: Address }[] = [];
      for (const d of status.deposits) {
        if (d.execution) continue;
        const key = `${d.deposit.chainId}:${d.deposit.token.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({ chainId: d.deposit.chainId, token: d.deposit.token });
      }
      if (tokens.length === 0) {
        throw new Error("Nothing to withdraw. Funds already deposited or not yet detected on the SRA.");
      }

      const res = await earn.getWithdrawCalls({ sra: rec.sra, tokens });
      setPhase("withdrawing");
      const hashes: Hex[] = [];
      for (const group of res.data) {
        const calls: OnChainCall[] = group.calls.map((c) => ({
          to: c.to,
          data: c.data ?? "0x",
          value: c.value,
        }));
        if (calls.length === 0) continue;
        hashes.push(...(await sendCalls(calls, group.chainId)));
      }
      setTxHashes(hashes);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [rec.sra, owner, sendCalls]);

  return { phase, error, txHashes, withdraw };
}
