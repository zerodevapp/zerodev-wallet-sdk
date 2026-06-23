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
            <span className="text-sm md:text-base px-3 py-1.5 bg-blue-50 text-blue-500 rounded-full font-medium border border-blue-100">
              Wallet Demo
            </span>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-4 md:flex"
          >
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
