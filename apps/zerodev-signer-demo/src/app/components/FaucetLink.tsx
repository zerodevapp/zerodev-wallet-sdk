"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/**
 * A faucet link that first copies the user's wallet address to the clipboard,
 * briefly confirms it ("Address copied"), then opens the faucet — so the address
 * is ready to paste. While in the copied state the control stays clickable, which
 * doubles as a fallback if the browser blocks the delayed popup.
 */
export function FaucetLink({
  address,
  children,
  className,
  href,
}: {
  address?: string | null
  children: ReactNode
  className?: string
  href: string
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const openFaucet = () => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleClick = async () => {
    if (copied) {
      // Second click (or fallback if the auto-open was blocked): just open.
      openFaucet();
      return;
    }
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        /* clipboard may be unavailable; still open the faucet below */
      }
    }
    setCopied(true);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      openFaucet();
      resetTimer.current = window.setTimeout(() => setCopied(false), 800);
    }, 1000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={
        copied
          ? "Wallet address copied — opening faucet"
          : "Copies your wallet address, then opens the faucet"
      }
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Address copied
        </>
      ) : (
        children
      )}
    </button>
  );
}
