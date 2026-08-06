"use client";

import { ChainMethodsTest } from "./ChainMethodsTest";
import { ContractBalances } from "./ContractBalances";
import { DemoNftMintTest } from "./DemoNftMintTest";
import { Erc20ContractTest } from "./Erc20ContractTest";
import { Erc721ContractTest } from "./Erc721ContractTest";
import { HelloWorldContractTest } from "./HelloWorldContractTest";
import { RpcReadTests } from "./RpcReadTests";
import { SendEthTest } from "./SendEthTest";
import { SendHighAmountTest } from "./SendHighAmountTest";
import { SendInvalidAddressTest } from "./SendInvalidAddressTest";
import { SessionExpiryTest } from "./SessionExpiryTest";
import { SignMessageCounterTest } from "./SignMessageCounterTest";
import { SignMessagePresetTest } from "./SignMessagePresetTest";
import { SignTypedDataInvalidTest } from "./SignTypedDataInvalidTest";
import { SignTypedDataTest } from "./SignTypedDataTest";
import { WatchAssetTest } from "./WatchAssetTest";

/**
 * Test cases for one area of the Tx Signing feature.
 *
 * Previously this mapping lived inside `TestingLab` alongside a stateful tab
 * bar. The tabs are routes now, so this is just the lookup — which area is
 * showing is the URL's job, not this component's.
 */
const AREA_CASES: Record<string, React.ComponentType[]> = {
  signing: [
    SignMessageCounterTest,
    SignMessagePresetTest,
    SignTypedDataTest,
    SignTypedDataInvalidTest,
  ],
  transactions: [SendEthTest, SendHighAmountTest, SendInvalidAddressTest],
  contracts: [
    ContractBalances,
    DemoNftMintTest,
    Erc20ContractTest,
    Erc721ContractTest,
    HelloWorldContractTest,
  ],
  rpc: [RpcReadTests, WatchAssetTest, ChainMethodsTest],
  session: [SessionExpiryTest],
};

/**
 * Which area is valid is the registry's call, not this module's — see
 * `isFeatureArea` in `lib/features.ts`. Exporting a validator from here would
 * be unusable: this file is `"use client"`, so a server page can't call it.
 */
/**
 * Column counts, keyed by how many cases an area has.
 *
 * Capped at the case count so a one-case area doesn't render a lone card in a
 * third of the viewport. Written as whole literal class strings because
 * Tailwind scans source statically — an interpolated `xl:grid-cols-${n}` never
 * makes it into the stylesheet.
 *
 * Cards are left to stretch (grid's default `align-items`) and `auto-rows-fr`
 * makes every row the same height, so all cells match rather than each ending
 * wherever its content happens to stop. Each test case's root element is the
 * grid item, so they fill their cell without needing `h-full`.
 */
const LAYOUT_BY_COUNT: Record<number, string> = {
  0: "space-y-4",
  1: "space-y-4",
  2: "grid auto-rows-fr gap-4 xl:grid-cols-2",
};

const LAYOUT_MANY = "grid auto-rows-fr gap-4 xl:grid-cols-2 2xl:grid-cols-3";

export function TxSigningArea({ areaId }: { areaId: string }) {
  const cases = AREA_CASES[areaId] ?? [];
  const layout = LAYOUT_BY_COUNT[cases.length] ?? LAYOUT_MANY;

  return (
    <div className={layout} data-testid={`area-${areaId}`}>
      {cases.map((Case, index) => (
        // Static, order-stable list — index is a safe key here.
        <Case key={index} />
      ))}
    </div>
  );
}
