"use client";

import { useState } from "react";
import { Download, Key, X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useExportPrivateKey, useExportWallet } from "@zerodev/wallet-react";

type ExportWalletModalProps = {
  isOpen: boolean;
  onClose: () => void;
}

const iframeContainerId = "export-wallet-iframe-container";
type ExportKind = "seed" | "privateKey";

export function ExportWalletModal({ isOpen, onClose }: ExportWalletModalProps) {
  const [showWarning, setShowWarning] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const exportWallet = useExportWallet();
  const exportPrivateKey = useExportPrivateKey();

  const handleExport = async (kind: ExportKind) => {
    setExportKind(kind);
    setIframeReady(false);
    setShowWarning(false);
    setExporting(true);

    // Wait for iframe container to be in DOM
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const exportMutation = kind === "seed" ? exportWallet : exportPrivateKey;
      await exportMutation.mutateAsync({
        iframeContainerId,
        iframeStyles: {
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          fontSize: '14px',
          fontFamily: 'monospace',
          padding: '16px',
          borderRadius: '8px',
          width: '100%',
        },
      });
      // The secure iframe does a small internal layout pass after injection.
      // Keep it covered briefly so the demo doesn't show that transition.
      await new Promise(resolve => setTimeout(resolve, 900));
      setIframeReady(true);
    } catch (err) {
      console.error("Export error:", err);
      setShowWarning(true);
      setExporting(false);
    }
  };

  const handleClose = () => {
    document.getElementById(iframeContainerId)?.replaceChildren();
    setShowWarning(true);
    setExporting(false);
    setExportKind(null);
    setIframeReady(false);
    onClose();
  };

  if (!isOpen) return null;

  const isPending = exportWallet.isPending || exportPrivateKey.isPending;
  const exportError = exportWallet.error ?? exportPrivateKey.error;
  const secretLabel = exportKind === "privateKey" ? "Private Key" : "Seed Phrase";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Export Keys</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Warning */}
          {showWarning && !exporting && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-2">Security Warning</p>
                <ul className="text-sm text-red-700 space-y-1.5">
                  <li>• Never share your seed phrase or private key with anyone</li>
                  <li>• Store it in a secure location (password manager, offline)</li>
                  <li>• Anyone with these keys can access your funds</li>
                  <li>• Make sure no one is watching your screen</li>
                </ul>
              </div>
            </div>
          )}

          {/* Export Button or Iframe Container */}
          {!exporting ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose which wallet secret you want to export.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => handleExport("seed")}
                  disabled={isPending}
                  className={cn(
                    "flex min-h-24 flex-col items-start justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Download className="h-4 w-4" />
                    Seed Phrase
                  </span>
                  <span className="text-xs leading-5 text-gray-500">
                    Recovery words for wallet backup and import.
                  </span>
                </button>
                <button
                  onClick={() => handleExport("privateKey")}
                  disabled={isPending}
                  className={cn(
                    "flex min-h-24 flex-col items-start justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Key className="h-4 w-4" />
                    Private Key
                  </span>
                  <span className="text-xs leading-5 text-gray-500">
                    Raw key for advanced wallet import.
                  </span>
                </button>
              </div>

              {isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">Your {secretLabel}</p>
                <p className="text-xs text-blue-500">
                  Store this safely before closing this window.
                </p>
              </div>

              {/* Iframe Container - This will show the seed phrase */}
              <div
                id={iframeContainerId}
                className={cn(
                  "relative min-h-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white transition-opacity duration-200",
                  "[&>iframe]:w-full [&>iframe]:min-h-[200px] [&>iframe]:border-none [&>iframe]:block",
                  iframeReady ? "[&>iframe]:opacity-100" : "[&>iframe]:opacity-0",
                )}
              >
                {/* Secure export iframe will inject content here */}
                {!iframeReady && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-sm font-medium text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading secure export...
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-xs text-yellow-700">
                  Make sure to save this {secretLabel.toLowerCase()} before closing this window
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {exportError && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Export Failed</p>
                <p className="text-sm text-red-700 mt-0.5">{exportError.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
