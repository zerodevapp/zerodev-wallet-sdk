"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PARAM } from "./config-params";
import {
  AUTH_PRESET_STORAGE_KEY,
  type AuthPresetId,
  DEFAULT_AUTH_PRESET,
  isAuthPresetId,
} from "./wallet-config";

/** Which of the three channels decided the preset. */
export type AuthPresetSource = "url" | "stored" | "default";

/**
 * The active sign-in preset. The only lab config that persists, and the only
 * one that safely can: it picks which `SignUp.*` units render and never reaches
 * the wagmi config, so a stored value cannot make the server and client build
 * different connectors.
 *
 *   ?preset=<id>  ->  use it, and store it
 *   nothing       ->  use what is stored
 *   neither       ->  DEFAULT_AUTH_PRESET
 *
 * The URL writes through, so a stored preset stays changeable by URL.
 */
export function useAuthPreset(): {
  preset: AuthPresetId;
  /**
   * Not inferable from `preset`: "no param, nothing stored" and "no param,
   * stored preset-1" both resolve to preset-1.
   */
  source: AuthPresetSource;
  /**
   * False until storage has been read, which SSR and the first client render
   * cannot do. Anything rendering per-preset must wait rather than guess.
   */
  ready: boolean;
} {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(PARAM.preset);
  const urlPreset = fromUrl && isAuthPresetId(fromUrl) ? fromUrl : undefined;

  const [stored, setStored] = useState<AuthPresetId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (urlPreset) {
      writeStoredPreset(urlPreset);
      setStored(urlPreset);
      setReady(true);
      return;
    }
    setStored(readStoredPreset());
    setReady(true);
  }, [urlPreset]);

  const source: AuthPresetSource = urlPreset
    ? "url"
    : stored
      ? "stored"
      : "default";

  return {
    preset: urlPreset ?? stored ?? DEFAULT_AUTH_PRESET,
    source,
    ready,
  };
}

/**
 * Discards an unrecognised stored value rather than trusting it — a stale or
 * hand-edited one would otherwise survive every reload.
 */
function readStoredPreset(): AuthPresetId | null {
  try {
    const raw = window.localStorage.getItem(AUTH_PRESET_STORAGE_KEY);
    if (raw && isAuthPresetId(raw)) return raw;
    if (raw) window.localStorage.removeItem(AUTH_PRESET_STORAGE_KEY);
    return null;
  } catch {
    // Storage blocked. The lab works, it just stops remembering.
    return null;
  }
}

function writeStoredPreset(preset: AuthPresetId): void {
  try {
    window.localStorage.setItem(AUTH_PRESET_STORAGE_KEY, preset);
  } catch {
    // Not remembering is survivable; throwing here is not.
  }
}

/** Drops the stored preset so the next bare URL falls back to the default. */
export function clearStoredPreset(): void {
  try {
    window.localStorage.removeItem(AUTH_PRESET_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage was never readable.
  }
}
