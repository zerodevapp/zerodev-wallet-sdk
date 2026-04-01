import { getWebAuthnAttestation } from '@turnkey/http'
import { WebauthnStamper as TurnkeyWebauthnStamper } from '@turnkey/webauthn-stamper'
import { base64UrlEncode, generateRandomBuffer } from '../utils/utils.js'
import type { PasskeyRegistrationOptions, PasskeyStamper } from './types.js'

export async function createWebauthnStamper({
  rpId,
}: {
  rpId: string
}): Promise<PasskeyStamper> {
  const inner = new TurnkeyWebauthnStamper({ rpId })

  return {
    async getPublicKey() {
      //   return await inner.();
      return null
    },
    async stamp(payload: string) {
      return await inner.stamp(payload)
    },
    async clear() {},
    async register(options: PasskeyRegistrationOptions) {
      const challenge = generateRandomBuffer()
      const encodedChallenge = base64UrlEncode(challenge)
      const authenticatorUserId = generateRandomBuffer()

      const attestation = await getWebAuthnAttestation({
        publicKey: {
          rp: options.rp,
          challenge,
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          user: {
            id: authenticatorUserId,
            name: options.userName,
            displayName: options.userName,
          },
        },
      })

      return { attestation, encodedChallenge }
    },
  }
}
