"use client";

import type { Vault } from "@zerodev/earn";
import { AlertCircle, Check } from "lucide-react";
import { useAccount } from "wagmi";
import { DiscoverPanel } from "./DiscoverPanel";
import { ExecutePanel } from "./ExecutePanel";
import { HistoryPanel } from "./HistoryPanel";
import { QuotePanel } from "./QuotePanel";
import { Segmented } from "./ui";
import { type PanelMode, type Step, useEarnState } from "./useEarnState";
import { useWalletSendCalls } from "./useWalletSendCalls";
import { chainName, EARN_CHAIN_IDS } from "./utils/chains";
import { fmtApy } from "./utils/format";
import { WithdrawPanel } from "./WithdrawPanel";

const STEPS: { n: Step; title: string; lock: string }[] = [
  { n: 1, title: "Discover", lock: "" },
  { n: 2, title: "Quote", lock: "Pick a vault first" },
  { n: 3, title: "Execute", lock: "Get a quote first" },
];

/** The selected vault, pinned above the quote and execute steps. */
function SelectedVault({ vault }: { vault: Vault }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{vault.name ?? vault.asset.symbol}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {vault.asset.symbol} · {vault.protocol} · {chainName(vault.chainId)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-bold tabular-nums leading-none text-gray-950">{fmtApy(vault.apy)}</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">APY</p>
      </div>
    </div>
  );
}

export function EarnTest() {
  const { address, chain } = useAccount();
  const d = useEarnState(address, chain?.id);
  const sendCalls = useWalletSendCalls();
  const onMainnet = d.listChainId != null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Earn</h2>
        <p className="text-sm text-gray-500 mt-1">
          Deposit into a yield vault on another chain with one signature. ZeroDev routes the funds through a
          Smart Routing Address, so there is no bridge, swap, or vault code to write.
        </p>
      </div>

      <div className="rounded-lg border border-yellow-100 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <p className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          Beta
        </p>
        <p className="mt-2 text-xs leading-5 text-yellow-700">
          ZeroDev Earn is an experimental product offered in beta. It supports your integration with third-party
          protocols. ZeroDev does not provide these protocols or the services they offer, does not custody assets,
          and does not execute or control transactions; any transactions are solely between you (or your end
          users) and the applicable third-party protocol. Any APY, rewards, or other amounts are provided by such
          protocols, not ZeroDev, and all data is supplied by third parties for informational purposes only. Use
          involves significant risk, including smart contract failures, market volatility, illiquidity, lockup,
          and loss of principal. ZeroDev is not liable for any losses arising from use of the product or the
          third-party protocols it surfaces. You are responsible for ensuring your end users understand these
          risks and for any disclosures required by applicable law. Do your own independent research and proceed
          at your own risk.
        </p>
      </div>

      {/* The Earn server routes mainnet only, so a testnet wallet chain gets a switch prompt. */}
      {!onMainnet && (
        <div className="flex items-start gap-2 px-4 py-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-700">
            Earn is not available on {chain?.name ?? "this network"}. Switch to{" "}
            {EARN_CHAIN_IDS.map(chainName).join(" or ")} to continue.
          </p>
        </div>
      )}

      {onMainnet && (
        <Segmented
          value={String(d.step)}
          onChange={(v) => d.goStep(Number(v) as Step)}
          options={STEPS.map((s) => ({
            value: String(s.n),
            disabled: s.n > d.maxStep,
            title: s.n > d.maxStep ? s.lock : undefined,
            label: (
              <>
                {s.n < d.step ? <Check className="h-3.5 w-3.5 text-green-600" /> : <span>{s.n}.</span>}
                {s.title}
              </>
            ),
          }))}
        />
      )}

      {onMainnet && d.step > 1 && d.selected && <SelectedVault vault={d.selected} />}

      {onMainnet && d.step === 1 && <DiscoverPanel d={d} />}
      {onMainnet && d.step === 2 && (
        <>
          <Segmented
            variant="pill"
            value={d.panelMode}
            onChange={(v) => d.setPanelMode(v as PanelMode)}
            options={[
              { value: "deposit", label: "Deposit" },
              { value: "withdraw", label: "Withdraw" },
            ]}
          />
          {d.panelMode === "deposit" ? <QuotePanel d={d} /> : <WithdrawPanel d={d} sendCalls={sendCalls} />}
        </>
      )}
      {onMainnet && d.step === 3 && <ExecutePanel d={d} sendCalls={sendCalls} />}

      <HistoryPanel owner={address} sendCalls={sendCalls} />
    </div>
  );
}
