"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/", label: "Default" },
  { href: "/sample-1", label: "Sample 1" },
] as const;

export function PageToggle() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full bg-[#E7E2DD]/30 p-1 backdrop-blur-[30px]">
      {PAGES.map((page) => {
        const active = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-[#19110B] text-[#faf7f4]"
                : "text-[#19110B] hover:text-gray-950"
            }`}
          >
            {page.label}
          </Link>
        );
      })}
    </div>
  );
}
