"use client";

import { EarnError, type Quote, type TokenInfo, type TokenInput, type Vault } from "@zerodev/earn";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { arbitrum } from "wagmi/chains";
import { EARN_CHAIN_IDS } from "./utils/chains";
import { earn } from "./utils/client";

export type Step = 1 | 2 | 3;
export type PanelMode = "deposit" | "withdraw";

/** Default slippage tolerance (bps); the quote panel offers presets. */
const DEFAULT_SLIPPAGE_BPS = 1000;
/** Extra funding tokens the SRA converts on delivery, keyed by vault token type. */
const CROSS_TOKEN_FUNDING: Record<string, string[]> = { USDG: ["USDC"] };

export function errorMessage(e: unknown): string {
  if (e instanceof EarnError) return `[${e.code}] ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

export type EarnState = ReturnType<typeof useEarnState>;

/** Discover, quote and execute state for the Earn tab. One instance per mounted tab. */
export function useEarnState(owner: Address | undefined, walletChainId: number | undefined) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [tokensByChain, setTokensByChain] = useState<Record<number, TokenInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Vault | null>(null);
  // Vault list follows the wallet's chain (the nav dropdown). Null on a
  // testnet, since the Earn server routes mainnet only.
  const listChainId =
    walletChainId != null && EARN_CHAIN_IDS.includes(walletChainId) ? walletChainId : null;

  const [step, setStep] = useState<Step>(1);
  const [panelMode, setPanelMode] = useState<PanelMode>("deposit");

  const [srcChainId, setSrcChainIdState] = useState<number>(arbitrum.id);
  const [srcToken, setSrcTokenState] = useState<Address | null>(null);
  const [amountStr, setAmountStrState] = useState("1");
  const [slippageBps, setSlippageBpsState] = useState(DEFAULT_SLIPPAGE_BPS);

  const [quote, setQuote] = useState<Quote | null>(null);
  // The signer the quote was built for. Its calls bake in the owner, so a
  // wallet switch after quoting makes the quote target the wrong account.
  const [quoteOwner, setQuoteOwner] = useState<Address | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  // Ticks once a second while a quote exists so expiry re-renders the panels.
  const [now, setNow] = useState(() => Date.now());

  // Token registries for every earn chain, loaded once: the funding token can
  // live on a different chain than the vault.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lists = await Promise.all(EARN_CHAIN_IDS.map((id) => earn.getTokens({ chainId: id })));
        if (cancelled) return;
        const map: Record<number, TokenInfo[]> = {};
        EARN_CHAIN_IDS.forEach((id, i) => {
          map[id] = lists[i] ?? [];
        });
        setTokensByChain(map);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Vaults for the listed network, walking every page. A single page is capped
  // server-side, so stopping at page 0 hides whole protocols.
  useEffect(() => {
    if (listChainId == null) {
      setVaults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const acc: Vault[] = [];
        let page: number | null = 0;
        while (page != null) {
          const res = await earn.listVaults({ chains: [listChainId], page });
          if (cancelled) return;
          acc.push(...res.vaults);
          page = res.nextPage;
        }
        setVaults(acc);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listChainId]);

  useEffect(() => {
    if (!quote) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [quote]);

  const protocols = useMemo(
    () => Array.from(new Set(vaults.map((v) => v.protocol))).sort(),
    [vaults],
  );

  function select(v: Vault) {
    setSelected(v);
    setSrcChainIdState(v.chainId);
    setSrcTokenState(null);
    setAmountStrState("1");
    setQuote(null);
    setQuoteError(null);
    setPanelMode("deposit");
    setStep(2);
  }

  // Funding tokens: the vault's own asset (bridged when cross-chain) plus the
  // SRA cross-token routes. Addresses deduped since WRAPPED_NATIVE == WETH.
  const srcTokens = tokensByChain[srcChainId] ?? [];
  const vaultTokens = selected ? (tokensByChain[selected.chainId] ?? []) : [];
  const vaultTokenInfo = selected
    ? vaultTokens.find((t) => t.address.toLowerCase() === selected.asset.address.toLowerCase())
    : undefined;
  const depositType = vaultTokenInfo?.tokenType ?? selected?.asset.symbol;
  const acceptedTypes = depositType
    ? [depositType, ...(CROSS_TOKEN_FUNDING[depositType] ?? [])]
    : [];
  const seen = new Set<string>();
  const depositableTokens = srcTokens.filter((t) => {
    const a = t.address.toLowerCase();
    if (seen.has(a)) return false;
    seen.add(a);
    return !depositType || acceptedTypes.includes(t.tokenType);
  });

  const effectiveToken = srcToken ?? depositableTokens[0]?.address ?? null;
  const tokenInfo = depositableTokens.find((t) => t.address === effectiveToken);
  const srcSymbol = tokenInfo?.tokenType ?? "token";
  const tokenOptions = depositableTokens.map((t) => ({ value: t.address, label: t.tokenType }));

  const quoteExpired = quote ? new Date(quote.expiresAt).getTime() < now : false;
  const ownerMismatch =
    !!quote && !!owner && !!quoteOwner && owner.toLowerCase() !== quoteOwner.toLowerCase();
  const quoteValid = !!quote && !quoteExpired && !ownerMismatch;
  const canQuote = !!selected && !!owner && !!effectiveToken && !quoteLoading;

  async function getQuote() {
    if (!selected || !owner || !effectiveToken) return;
    setQuoteError(null);
    setQuote(null);
    setQuoteLoading(true);
    try {
      const q = await earn.depositIntoVault({
        owner,
        srcChainId,
        token: effectiveToken as TokenInput,
        amount: amountStr,
        into: selected,
        protocol: selected.protocol,
        slippage: slippageBps,
      });
      setQuote(q);
      setQuoteOwner(owner);
    } catch (e) {
      setQuoteError(errorMessage(e));
    } finally {
      setQuoteLoading(false);
    }
  }

  const maxStep: Step = quote ? 3 : selected ? 2 : 1;

  return {
    vaults,
    tokensByChain,
    loading,
    loadError,
    protocols,
    selected,
    select,
    listChainId,

    step,
    maxStep,
    goStep: (n: Step) => {
      if (n <= maxStep) setStep(n);
    },
    panelMode,
    setPanelMode,

    srcChainId,
    setSrcChainId: (id: number) => {
      setSrcChainIdState(id);
      setSrcTokenState(null);
      setQuote(null);
    },
    srcToken: effectiveToken,
    setSrcToken: (a: Address) => {
      setSrcTokenState(a);
      setQuote(null);
    },
    srcSymbol,
    srcDecimals: tokenInfo?.decimals,
    tokenOptions,
    amountStr,
    // Amount and slippage are baked into the quote's calls, so editing either
    // drops the quote.
    setAmountStr: (s: string) => {
      setAmountStrState(s);
      setQuote(null);
    },
    slippageBps,
    setSlippageBps: (n: number) => {
      setSlippageBpsState(n);
      setQuote(null);
    },

    quote,
    quoteError,
    quoteLoading,
    quoteExpired,
    ownerMismatch,
    quoteValid,
    canQuote,
    getQuote,
    now,
    owner,
  };
}
