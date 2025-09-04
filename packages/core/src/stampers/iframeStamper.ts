import type { IframeStamper } from "./types.js";
import { IframeStamper as TurnkeyIframeStamper } from "@turnkey/iframe-stamper";

export async function createIframeStamper(cfg?: {
  iframeUrl?: string;
  iframeContainer?: HTMLElement | null;
  iframeElementId?: string;
}): Promise<IframeStamper> {
  const inner = new TurnkeyIframeStamper({
    iframeUrl: cfg?.iframeUrl ?? "https://auth.turnkey.com",
    iframeContainer: cfg?.iframeContainer ?? document.body,
    iframeElementId: cfg?.iframeElementId ?? "turnkey-iframe",
  });

  await inner.init();

  return {
    async injectCredentialBundle(bundle: string) {
      return await inner.injectCredentialBundle(bundle);
    },
    async getPublicKey() {
      return await inner.getEmbeddedPublicKey();
    },
    async stamp(payload: string) {
      return await inner.stamp(payload);
    },
    async clear() {
      await inner.clear();
    },
  };
}
