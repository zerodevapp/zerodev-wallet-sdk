// src/stampers/indexeddb.ts
import type { IndexedDbStamper } from "./types.js";
import { IndexedDbStamper as TurnkeyIndexedDbStamper } from "@turnkey/indexed-db-stamper";

export async function createIndexedDbStamper(): Promise<IndexedDbStamper> {
  const inner = new TurnkeyIndexedDbStamper();
  await inner.init();

  return {
    async getPublicKey() {
      return await inner.getPublicKey();
    },
    async stamp(payload:string) {
      return await inner.stamp(payload);
    },
    async clear() {
      await inner.clear();
    },
  };
}
