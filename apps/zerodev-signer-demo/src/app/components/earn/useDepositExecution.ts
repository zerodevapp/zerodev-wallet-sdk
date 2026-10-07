"use client";

import type { EarnStatus, Quote, Vault } from "@zerodev/earn";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient } from "wagmi";
import { earn } from "./utils/client";
import { type ExecPhase, patchPhase, upsertDeposit } from "./utils/historyStore";
import type { SendCalls } from "./useWalletSendCalls";

/**
 * Send the quote, wait for the funding receipt, then watch the SRA until the
 * relayer reports COMPLETED. Every deposit funds an SRA, same-chain included;
 * same-chain only skips the bridge leg of the `bridging` phase.
 */
export function useDepositExecution(opts: {
  owner: Address | undefined;
  sendCalls: SendCalls;
  quote: Quote | null;
  vault: Vault;
  meta: { amount: string; srcSymbol: string };
  ownerMismatch: boolean;
}) {
  const { owner, sendCalls, quote, vault, meta, ownerMismatch } = opts;
  const srcPublicClient = usePublicClient({ chainId: quote?.transaction.chainId });

  const [status, setStatus] = useState<ExecPhase>("idle");
  const [txHashes, setTxHashes] = useState<Hex[]>([]);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [earnStatus, setEarnStatus] = useState<EarnStatus | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh quote resets the run.
  useEffect(() => {
    setStatus("idle");
    setTxHashes([]);
    setTxHash(null);
    setEarnStatus(null);
    setError(null);
  }, [quote?.quoteId]);

  // Persist before and after sending so an interrupted deposit keeps its SRA.
  const persist = useCallback(
    (phase: ExecPhase, hashes: Hex[]) => {
      if (!quote?.sra || !owner) return;
      const now = Date.now();
      upsertDeposit({
        quoteId: quote.quoteId,
        createdAt: now,
        updatedAt: now,
        owner,
        sra: quote.sra,
        vault: {
          address: vault.address,
          chainId: vault.chainId,
          assetSymbol: vault.asset.symbol,
          protocol: vault.protocol,
        },
        srcChainId: quote.transaction.chainId,
        srcSymbol: meta.srcSymbol,
        amount: meta.amount,
        txHashes: hashes,
        phase,
      });
    },
    [quote, owner, vault, meta],
  );

  useEffect(() => {
    if (status !== "signing" || !txHash || !srcPublicClient) return;
    let cancelled = false;
    srcPublicClient.waitForTransactionReceipt({ hash: txHash }).then(() => {
      if (cancelled) return;
      setStatus("bridging");
      if (quote) patchPhase(quote.quoteId, "bridging", Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [txHash, status, srcPublicClient, quote]);

  // `watchStatus` stops itself on a terminal state and times out on its own.
  useEffect(() => {
    const sra = quote?.sra;
    const quoteId = quote?.quoteId;
    if (status !== "bridging" || !sra || !txHash) return;
    // Scoped to this funding tx: the SRA is reused across deposits and an
    // address-wide state would report on money that is not this deposit's.
    const watcher = earn.watchStatus(sra, {
      depositTx: txHash,
      onStatusChange: (s) => {
        setEarnStatus(s);
        if (quoteId) patchPhase(quoteId, s.state, Date.now());
        if (s.state === "COMPLETED") setStatus("deposited");
        if (s.state === "FAILED" || s.state === "ABANDONED") {
          setError(s.failureReason ?? "Deposit did not settle. Funds may be recoverable from the SRA.");
          setStatus("error");
        }
      },
      // A watch that gives up is not a failed deposit: report it and leave the
      // phase alone so Refresh and Withdraw stay available in history.
      onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
    return () => watcher.stop();
  }, [status, txHash, quote?.sra, quote?.quoteId]);

  const execute = useCallback(async () => {
    if (!quote || !owner) return;
    if (ownerMismatch) {
      setError("Quote was built for a different wallet. Re-quote with the active signer.");
      setStatus("error");
      return;
    }
    setError(null);
    setTxHashes([]);
    setIsExecuting(true);
    try {
      setStatus("signing");
      setEarnStatus(null);
      persist("signing", []);
      const hashes = await sendCalls(quote.transaction.calls, quote.transaction.chainId);
      setTxHashes(hashes);
      persist("signing", hashes);
      const last = hashes[hashes.length - 1];
      if (last) setTxHash(last);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      patchPhase(quote.quoteId, "error", Date.now());
    } finally {
      setIsExecuting(false);
    }
  }, [quote, owner, sendCalls, persist, ownerMismatch]);

  return { status, txHashes, earnStatus, isExecuting, error, execute };
}
