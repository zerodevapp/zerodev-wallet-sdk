import type { CDPSession, Page } from '@playwright/test'

export type VirtualAuthenticator = {
  cdpSession: CDPSession
  authenticatorId: string
}

/**
 * Sets up a Chrome DevTools Protocol virtual WebAuthn authenticator.
 * This allows testing passkey flows without a real biometric device.
 *
 * The virtual authenticator auto-responds to WebAuthn ceremonies with
 * user verification = true, simulating a successful biometric check.
 */
export async function setupVirtualAuthenticator(
  page: Page,
): Promise<VirtualAuthenticator> {
  const cdpSession = await page.context().newCDPSession(page)

  await cdpSession.send('WebAuthn.enable')

  const { authenticatorId } = await cdpSession.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    },
  )

  return { cdpSession, authenticatorId }
}

/**
 * Tears down the virtual authenticator.
 */
export async function teardownVirtualAuthenticator(
  auth: VirtualAuthenticator,
): Promise<void> {
  try {
    await auth.cdpSession.send('WebAuthn.removeVirtualAuthenticator', {
      authenticatorId: auth.authenticatorId,
    })
    await auth.cdpSession.send('WebAuthn.disable')
  } catch {
    // Ignore errors during cleanup
  }
}
