import {
  Clock,
  Code2,
  FileSignature,
  History,
  type LucideIcon,
  Network,
  Route,
  Send,
} from "lucide-react";

/**
 * Registry of everything the QA lab covers.
 *
 * This drives the sidebar, the overview page, the per-feature tab bars, the
 * routes, and the test IDs — all of them derived, none hand-maintained. Adding
 * a feature is one entry here plus a page under `(lab)/<id>/`; there is no
 * second place to remember to update, so nav and routing can't drift apart.
 *
 * A feature is a product capability (tx signing, SRA). An area is a slice of
 * one feature's test surface (signing, contracts). Keeping those two levels
 * distinct is the point — before this, a feature's areas sat at the top level,
 * so a second feature had nowhere to go that wasn't "another area".
 */

export type FeatureStatus = "ready" | "wip" | "planned";

export interface LabArea {
  id: string;
  name: string;
  icon: LucideIcon;
}

export interface LabFeature {
  id: string;
  name: string;
  icon?: LucideIcon;
  /** One line, shown on the overview card. */
  description: string;
  status: FeatureStatus;
  /** Empty for features that have no test surface yet. */
  areas: LabArea[];
}

export const LAB_FEATURES: LabFeature[] = [
  {
    id: "tx-signing",
    name: "Tx Signing",
    description:
      "Signing, transactions, contract calls and RPC behaviour against the wallet's request queue.",
    status: "wip",
    areas: [
      { id: "signing", name: "Signing", icon: FileSignature },
      { id: "transactions", name: "Transactions", icon: Send },
      { id: "contracts", name: "Contracts", icon: Code2 },
      { id: "rpc", name: "RPC", icon: Network },
      { id: "session", name: "Session", icon: Clock },
    ],
  },
  {
    id: "transaction-history",
    name: "Transaction History",
    icon: History,
    description:
      "Live Data API requests signed by the wallet's active session key.",
    status: "wip",
    areas: [],
  },
  {
    id: "sra",
    name: "SRA",
    description: "Smart Routing Address deposits.",
    status: "wip",
    areas: [],
  },
];

export const getFeature = (id: string): LabFeature | undefined =>
  LAB_FEATURES.find((feature) => feature.id === id);

/** A feature's landing area — the first one it declares. */
export const defaultAreaId = (feature: LabFeature): string | undefined =>
  feature.areas[0]?.id;

export const featureHref = (feature: LabFeature) => {
  const area = defaultAreaId(feature);
  return area ? `/${feature.id}/${area}` : `/${feature.id}`;
};

export const areaHref = (featureId: string, areaId: string) =>
  `/${featureId}/${areaId}`;

/**
 * Whether a feature declares an area — the guard behind each `[area]` route.
 *
 * Lives here, not next to the area's components, because those modules are
 * `"use client"`: Next turns every export of a client module into a client
 * reference, so a server page calling one throws at render time. This module
 * has no directive and is safe to call from either side.
 */
export const isFeatureArea = (featureId: string, areaId: string) =>
  Boolean(getFeature(featureId)?.areas.some((area) => area.id === areaId));

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  ready: "ready",
  wip: "in progress",
  planned: "planned",
};

/** Icon for features whose areas list is empty, so the sidebar still has one. */
export const FALLBACK_FEATURE_ICON = Route;
