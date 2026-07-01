/* eslint-disable @next/next/no-img-element */

import { ArrowRight, ExternalLink } from "lucide-react";

export function Navbar() {
  return (
    <header className="bg-black/[0.01] backdrop-blur-[60px] [font-family:var(--font-dm-sans)]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/images/zerodev-logo.png" alt="ZeroDev Logo" className="h-10 w-10" />
              <span className="text-2xl font-medium leading-none tracking-tight text-gray-900">
                ZeroDev
              </span>
            </div>
            <span className="text-xs font-semibold uppercase leading-none tracking-wider text-gray-400">
              Wallet Demo
            </span>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-4 md:flex"
          >
            {process.env.NODE_ENV === "development" && (
              <a
                href="/dashboard?preview=1"
                className="inline-flex items-center rounded-full border border-dashed border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-800"
                title="Dev only: open the logged-in dashboard without a session"
              >
                Preview
              </a>
            )}
            <div className="flex items-center gap-6 rounded-full bg-[#E7E2DD]/30 px-5 py-2 backdrop-blur-[30px]">
              <a
                href="https://docs.zerodev.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base font-medium text-black/80 transition-colors hover:text-gray-950"
              >
                Documentation
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href="https://dashboard.zerodev.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base font-medium text-black/80 transition-colors hover:text-gray-950"
              >
                Get your API keys
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <a
              href="https://zerodev.app/book-a-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#19110B] py-1.5 pl-4 pr-1.5 text-base font-medium text-[#faf7f4] shadow-sm transition-colors hover:bg-[#2a1d12]"
            >
              Contact sales
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                <ArrowRight className="h-4 w-4 text-[#19110B]" />
              </span>
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
