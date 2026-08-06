"use client";

import { ZeroDevLogo } from "@zerodev/react-ui";
import { Settings2, SlidersHorizontal } from "lucide-react";
import { useResolvedConfig } from "../lib/use-wallet-config";
import { ConfigLink } from "./ConfigLink";

export function AppHeader() {
  const { applied } = useResolvedConfig();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-warm)] bg-white/95 font-[var(--font-dm-sans)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:h-[88px] lg:px-9 lg:py-0">
        <ConfigLink
          href="/"
          className="flex w-fit items-center gap-2.5 sm:gap-3"
          data-testid="header-home-link"
        >
          <ZeroDevLogo
            variant="lockup"
            tone="black"
            className="h-7 w-auto shrink-0 sm:h-9"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9c958c] sm:text-xs">
            QA Lab
          </span>
        </ConfigLink>

        <div className="flex items-center gap-2">
          {/*
            Config lives only in the URL, so a link that drops the query string
            silently reverts to defaults. This badge makes that visible: if it
            disappears mid-session, something dropped the params.
          */}
          {applied.length > 0 && (
            <span
              className="hidden items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 sm:inline-flex"
              title={`Overridden: ${applied.join(", ")}`}
              data-testid="header-config-overridden"
              data-applied={applied.join(",")}
            >
              config overridden · {applied.length}
            </span>
          )}

          <ConfigLink
            href="/config"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-white px-3 text-sm font-semibold text-[#423a32] transition-colors hover:bg-[var(--surface-warm)] sm:h-12 sm:px-4"
            data-testid="header-config-link"
            title="Build a config URL"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            <span className="hidden truncate sm:inline">Config</span>
          </ConfigLink>

          <ConfigLink
            href="/environment"
            className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a1c13] sm:h-12 sm:px-5"
            data-testid="header-environment-link"
          >
            <span className="truncate">Environment</span>
            <span className="ml-1 grid h-6 w-6 place-items-center rounded-full bg-white text-[var(--ink)] sm:h-7 sm:w-7">
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            </span>
          </ConfigLink>
        </div>
      </div>
    </header>
  );
}
