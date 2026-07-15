"use client";

import { Code2, FileSignature, FlaskConical, Network, Send } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { ContractBalances } from "./ContractBalances";
import { Erc20ContractTest } from "./Erc20ContractTest";
import { Erc721ContractTest } from "./Erc721ContractTest";
import { HelloWorldContractTest } from "./HelloWorldContractTest";
import { RpcReadTests } from "./RpcReadTests";
import { SendEthTest } from "./SendEthTest";
import { SendHighAmountTest } from "./SendHighAmountTest";
import { SendInvalidAddressTest } from "./SendInvalidAddressTest";
import { SignMessageCounterTest } from "./SignMessageCounterTest";
import { SignMessagePresetTest } from "./SignMessagePresetTest";
import { SignTypedDataInvalidTest } from "./SignTypedDataInvalidTest";

type LabTab = "signing" | "transactions" | "contracts" | "rpc";

const tabs = [
  { id: "signing" as const, name: "Signing", icon: FileSignature },
  { id: "transactions" as const, name: "Transactions", icon: Send },
  { id: "contracts" as const, name: "Contracts", icon: Code2 },
  { id: "rpc" as const, name: "RPC", icon: Network },
];

/**
 * Testing Lab — a QA playground that sits below the demo operations block.
 * Each tab holds a growing vertical stack of self-contained test cases, each
 * with its own explanation, button(s), and inline results.
 */
export function TestingLab() {
  const [activeTab, setActiveTab] = useState<LabTab>("signing");

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-warm)] bg-white sm:mt-6">
      <div className="flex items-center gap-2 border-b border-[var(--border-warm)] bg-[var(--surface-warm)] px-4 py-3">
        <FlaskConical className="h-4 w-4 text-[var(--ink)]" />
        <h2 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">
          Testing Lab
        </h2>
        <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          QA
        </span>
      </div>

      {/* Tab nav */}
      <div className="border-b border-[var(--border-warm)] bg-[var(--surface-warm)]">
        <nav className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 border-b-2 px-5 text-sm font-semibold transition-all duration-200 cursor-pointer",
                  isActive
                    ? "border-[var(--ink)] bg-white text-[var(--ink)]"
                    : "border-transparent text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === "signing" && (
          <div className="space-y-4">
            <SignMessageCounterTest />
            <SignMessagePresetTest />
            <SignTypedDataInvalidTest />
          </div>
        )}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            <SendEthTest />
            <SendHighAmountTest />
            <SendInvalidAddressTest />
          </div>
        )}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            <ContractBalances />
            <Erc20ContractTest />
            <Erc721ContractTest />
            <HelloWorldContractTest />
          </div>
        )}
        {activeTab === "rpc" && (
          <div className="space-y-4">
            <RpcReadTests />
          </div>
        )}
      </div>
    </div>
  );
}
