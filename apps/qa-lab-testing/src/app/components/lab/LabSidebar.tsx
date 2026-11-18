"use client";


import { ConfigLink } from "../ConfigLink";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  FALLBACK_FEATURE_ICON,
  type FeatureStatus,
  LAB_FEATURES,
  type LabFeature,
  STATUS_LABEL,
  featureHref,
} from "../../lib/features";

const STATUS_STYLES: Record<FeatureStatus, string> = {
  ready: "border-green-100 bg-green-50 text-green-700",
  wip: "border-amber-100 bg-amber-50 text-amber-700",
  planned: "border-[var(--border-warm)] bg-[var(--surface-warm)] text-[var(--muted)]",
};

export function StatusChip({ status }: { status: FeatureStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        STATUS_STYLES[status],
      )}
      data-testid={`status-${status}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="hidden px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c958c] first:pt-0 lg:block">
      {children}
    </p>
  );
}

function FeatureLink({
  feature,
  active,
}: {
  feature: LabFeature;
  active: boolean;
}) {
  const Icon = feature.icon ?? feature.areas[0]?.icon ?? FALLBACK_FEATURE_ICON;

  return (
    <ConfigLink
      href={featureHref(feature)}
      data-testid={`nav-feature-${feature.id}`}
      data-active={String(active)}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-[var(--ink)] text-white"
          : "text-[#423a32] hover:bg-[var(--surface-warm)] hover:text-[var(--ink)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{feature.name}</span>
      {!active && <StatusChip status={feature.status} />}
    </ConfigLink>
  );
}

/**
 * Feature-level navigation. Vertical on desktop, a horizontal scroller on
 * narrow screens so it never competes with a feature's own tab bar.
 */
export function LabSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-warm)] bg-white px-3 py-2 lg:w-56 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
      data-testid="lab-sidebar"
    >
      {/*
        Features only. Environment deliberately isn't repeated here — the
        header already links it, and two nav entries pointing at one page is
        the kind of thing that quietly rots when one of them moves.
      */}
      <SectionLabel>Features</SectionLabel>
      {LAB_FEATURES.map((feature) => (
        <FeatureLink
          key={feature.id}
          feature={feature}
          active={pathname.startsWith(`/${feature.id}`)}
        />
      ))}
    </nav>
  );
}
