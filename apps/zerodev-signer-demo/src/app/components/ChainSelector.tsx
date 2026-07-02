"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useAccount, useSwitchChain, useChains } from "wagmi";
import { cn } from "../lib/utils";

export function ChainSelector({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const chains = useChains();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChainSwitch = (chainId: number) => {
    if (chainId !== chain?.id) {
      switchChain({ chainId });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={cn(
          "flex h-12 items-center gap-2 rounded-lg border border-gray-200 px-3",
          "bg-white hover:bg-gray-50 transition-colors",
          "text-sm font-medium text-gray-700",
          isPending && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span>{chain?.name}</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {chains.map((chain_) => {
              const isSelected = chain_.id === chain?.id;

              return (
                <button
                  key={chain_.id}
                  onClick={() => handleChainSwitch(chain_.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm",
                    "hover:bg-gray-50 transition-colors",
                    isSelected ? "text-blue-600 font-medium" : "text-gray-700"
                  )}
                >
                  <span>{chain_.name}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
