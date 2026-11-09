/**
 * Connects the lab to MetaMask, driving both halves: the sheet in the page and
 * the approval in the extension.
 */

import type { Page } from '@playwright/test'
import { expectConnected, type Namespace } from '../connector-bar.js'
import { openSignInAndPickChain } from '../ui-login.js'
import type { MetaMask } from './metamask.js'

export async function connectThroughMetaMask(
  page: Page,
  metamask: MetaMask,
  namespace: Namespace,
  /**
   * Whether MetaMask is expected to prompt. False only where the wallet has
   * already authorised the namespace, in which case there is no request to
   * answer and reaching `connected` is itself the assertion.
   */
  prompts = true,
): Promise<void> {
  await openSignInAndPickChain(page, 'MetaMask', namespace)

  if (prompts) await metamask.approveConnection()
  await expectConnected(page, namespace)
}
