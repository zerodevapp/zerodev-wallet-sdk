import type { WebauthnStamper } from "./types.js";
import { WebauthnStamper as TurnkeyWebauthnStamper } from "@turnkey/webauthn-stamper";

export async function createWebauthnStamper({rpId}: {rpId: string}): Promise<WebauthnStamper> {
  const inner = new TurnkeyWebauthnStamper({ rpId });

  return {
    async getPublicKey() {
    //   return await inner.();
    return null;
    },
    async stamp(payload:string) {
      return await inner.stamp(payload);
    },
    async clear() {
    },
  };
}
