import * as LocalAuthentication from 'expo-local-authentication'

/**
 * Biometric-only gate for sensitive flows (export). Fails closed on every
 * branch — no hardware, no enrollment, OS error, user cancel — all return
 * `false`. Device passcode fallback is explicitly disabled because the
 * security intent for wallet-secret access is biometric-only.
 */
export async function authenticateForReveal(reason: string): Promise<boolean> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return false
    if (!(await LocalAuthentication.isEnrolledAsync())) return false
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      disableDeviceFallback: true,
    })
    return result.success
  } catch {
    return false
  }
}
