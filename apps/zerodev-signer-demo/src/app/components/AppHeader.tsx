/* eslint-disable @next/next/no-img-element */
"use client";

import { ArrowRight, ChevronDown, ExternalLink, Github } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 px-4 py-3 sm:px-6 lg:h-[92px] lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-0">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex w-fit items-center gap-2.5 sm:gap-3">
            <img
              src="/images/zerodev-logo.png"
              alt="ZeroDev Logo"
              className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
            />
            <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
              <span className="text-xl font-semibold leading-none tracking-[-0.01em] text-gray-950 sm:text-2xl">
                ZeroDev
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-xs">
                Wallet Demo
              </span>
            </div>
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 sm:hidden"
            aria-expanded={mobileMenuOpen}
          >
            Links
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="grid gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm sm:hidden">
            {headerLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center justify-between rounded-md px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
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
                    ? "bg-[#140d09] text-white hover:bg-black hover:text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-950"
                }`}
              >
                <span className="truncate">{link.label}</span>
                <Icon className="h-4 w-4 shrink-0" />
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
