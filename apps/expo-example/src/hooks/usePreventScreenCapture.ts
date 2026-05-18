import * as ScreenCapture from 'expo-screen-capture'
import { useEffect, useState } from 'react'

type ScreenCaptureProtectionStatus = 'pending' | 'enabled' | 'failed'

/**
 * Apply screen-capture protection (FLAG_SECURE on Android, screen-recording
 * overlay on iOS) for the lifetime of the consumer component. Restores on
 * unmount.
 *
 * Callers should fail closed until the status is `'enabled'`. If the native
 * protection rejects, `status` flips to `'failed'` so sensitive UI can stay
 * hidden instead of rendering without screenshot protection.
 */
export function usePreventScreenCapture() {
  const [status, setStatus] = useState<ScreenCaptureProtectionStatus>('pending')

  useEffect(() => {
    let mounted = true
    ScreenCapture.preventScreenCaptureAsync()
      .then(() => {
        if (mounted) setStatus('enabled')
      })
      .catch(() => {
        if (mounted) setStatus('failed')
      })
    return () => {
      mounted = false
      ScreenCapture.allowScreenCaptureAsync().catch(() => {})
    }
  }, [])

  return {
    protectionEnabled: status === 'enabled',
    preventionFailed: status === 'failed',
    status,
  }
}
