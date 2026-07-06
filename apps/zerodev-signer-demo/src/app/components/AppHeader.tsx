"use client";

import { Icon } from "@zerodev/react-ui";
import { ArrowRight, ChevronDown, ExternalLink, Github } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const headerLinks = [
  { href: "https://docs.zerodev.app", label: "Documentation", icon: ExternalLink },
  { href: "https://dashboard.zerodev.app", label: "Get your API keys", icon: ExternalLink },
  { href: "https://github.com/zerodevapp/zerodev-wallet-sdk/tree/main/apps/zerodev-signer-demo", label: "GitHub", icon: Github },
  { href: "https://zerodev.app/contact", label: "Contact sales", icon: ArrowRight, emphasis: true },
];

export function AppHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-0 border-b border-[var(--border-warm)] bg-white/95 font-[var(--font-dm-sans)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 px-4 py-3 sm:px-6 lg:h-[88px] lg:flex-row lg:items-center lg:justify-between lg:px-9 lg:py-0">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex w-fit items-center gap-2.5 sm:gap-3">
            <Icon name="zerodevLogo" className="h-7 w-auto shrink-0 sm:h-9" />
            <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9c958c] sm:text-xs">
                Wallet Demo
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border-warm)] bg-[var(--surface-warm)] px-3 text-sm font-bold text-[var(--ink)] sm:hidden"
            aria-expanded={mobileMenuOpen}
          >
            Links
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="grid gap-1 rounded-xl border border-[var(--border-warm)] bg-white p-1 shadow-sm sm:hidden">
            {headerLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center justify-between rounded-lg px-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface-warm)]"
                >
                  {link.label}
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </nav>
        )}

        <nav className="hidden w-auto flex-wrap items-center gap-3 sm:flex">
          {headerLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors ${
                  link.emphasis
                    ? "bg-[var(--ink)] text-white hover:bg-[#2a1c13] hover:text-white"
                    : "bg-[var(--surface-warm)] text-[#423a32] hover:bg-[#eee9e3] hover:text-[var(--ink)]"
                }`}
              >
                <span className="truncate">{link.label}</span>
                {link.emphasis ? (
                  <span className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--ink)]">
                    <Icon className="h-4 w-4 shrink-0" />
                  </span>
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
