import {
  createPasskey,
  PasskeyStamper as TurnkeyPasskeyStamper,
} from '@turnkey/react-native-passkey-stamper'
import type {
  PasskeyRegistrationOptions,
  PasskeyStamper,
} from '@zerodev/wallet-core'
import { v4 as uuidv4 } from 'uuid'

export async function createReactNativePasskeyStamper({
  rpId,
}: {
  rpId: string
}): Promise<PasskeyStamper> {
  const inner = new TurnkeyPasskeyStamper({ rpId })

  return {
    async stamp(payload: string) {
      return await inner.stamp(payload)
    },
    async clear() {},
    async register({ rp, userName }: PasskeyRegistrationOptions) {
      const { attestation, challenge: encodedChallenge } = await createPasskey({
        rp: {
          id: rp.id,
          name: rp.name ?? 'Turnkey',
        },
        user: {
          id: uuidv4(),
          name: userName,
          displayName: userName,
        },
        authenticatorName: userName ?? 'End-User Passkey',
      })
      return { attestation, encodedChallenge }
    },
  }
}
