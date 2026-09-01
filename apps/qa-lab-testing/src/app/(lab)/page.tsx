import { ArrowRight } from "lucide-react";
import { ConfigLink } from "../components/ConfigLink";
import { StatusChip } from "../components/lab/LabSidebar";
import {
  FALLBACK_FEATURE_ICON,
  LAB_FEATURES,
  featureHref,
} from "../lib/features";

export const dynamic = "force-dynamic";

/**
 * Landing page for the lab: every feature, its status, and a way in.
 *
 * Exists so there's one obvious place to find a capability as the app grows —
 * the sidebar gets you there in a click, but a feature that isn't built yet
 * still needs somewhere to be visible.
 */
export default function OverviewPage() {
  return (
    <div data-testid="overview">
      <h1 className="font-[var(--font-dm-sans)] text-lg font-bold text-[var(--ink)]">
        QA Lab
      </h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Every feature we ship gets a surface here, usable by hand and by
        Playwright. Pick one to start, or deep-link straight to an area.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {LAB_FEATURES.map((feature) => {
          const Icon =
            feature.icon ?? feature.areas[0]?.icon ?? FALLBACK_FEATURE_ICON;

          return (
            <ConfigLink
              key={feature.id}
              href={featureHref(feature)}
              data-testid={`overview-feature-${feature.id}`}
              className="group flex flex-col rounded-lg border border-[var(--border-warm)] bg-white p-4 transition-colors hover:border-[#d9d2ca] hover:bg-[var(--surface-warm)]"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-[var(--ink)]" />
                <h2 className="font-[var(--font-dm-sans)] text-sm font-bold text-[var(--ink)]">
                  {feature.name}
                </h2>
                <StatusChip status={feature.status} />
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              </div>

              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {feature.description}
              </p>

              {feature.areas.length > 0 && (
                <p className="mt-3 font-mono text-[11px] text-[#9c958c]">
                  {feature.areas.map((area) => area.name).join(" · ")}
                </p>
              )}
            </ConfigLink>
          );
        })}
      </div>
    </div>
  );
}
