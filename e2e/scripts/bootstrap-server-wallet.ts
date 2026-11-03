/// <reference types="node" />
/**
 * Produces the two server wallet fixtures the backend suite cannot derive for itself:
 * `ZD_SW_WALLET_ID` and `ZD_SW_ADDRESS`.
 *
 * Run: pnpm dlx tsx --env-file=.env e2e/scripts/bootstrap-server-wallet.ts
 */

// biome-ignore-all lint/suspicious/noConsole: the console is this script's report.

import { isAddressEqual, recoverMessageAddress } from 'viem'
import {
  createServerWalletClient,
  toViemAccount,
} from '../../packages/core/src/server/index.js'
import { BACKEND_URL } from '../helpers/constants.js'

const organizationId = process.env.ZD_SW_ORGANIZATION_ID
const projectId = process.env.ZD_SW_PROJECT_ID
const agentPrivateKey = process.env.ZD_SW_AGENT_PRIVATE_KEY
const origin = process.env.ZD_SW_ORIGIN
/** Same fallback as the suite, so this bootstraps against the deployment it will run on. */
const proxyBaseUrl = process.env.ZD_SW_PROXY_BASE_URL || BACKEND_URL

/** Set to derive on a wallet that already exists instead of creating one. */
const existingWalletId = process.env.ZD_SW_WALLET_ID
/**
 * The index to derive at.
 */
const index = Number(process.env.ZD_SW_BOOTSTRAP_INDEX ?? 1)

const missing = Object.entries({
  ZD_SW_ORGANIZATION_ID: organizationId,
  ZD_SW_PROJECT_ID: projectId,
  ZD_SW_AGENT_PRIVATE_KEY: agentPrivateKey,
  ZD_SW_ORIGIN: origin,
})
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missing.length > 0 || !organizationId || !projectId || !agentPrivateKey) {
  console.log(`\nmissing: ${missing.join(', ')}\n`)
  process.exit(1)
}

if (!/^(0x)?[0-9a-fA-F]{64}$/.test(agentPrivateKey)) {
  console.log('\nZD_SW_AGENT_PRIVATE_KEY is not 32 bytes of hex\n')
  process.exit(1)
}

if (!Number.isInteger(index) || index < 0 || index > 2 ** 31 - 1) {
  console.log(
    `\nZD_SW_BOOTSTRAP_INDEX must be a non-hardened BIP-32 index (0 to ${2 ** 31 - 1}), got ${index}\n`,
  )
  process.exit(1)
}

const client = createServerWalletClient({
  organizationId,
  privateKey: agentPrivateKey,
  proxyBaseUrl,
  fetchOptions: { headers: { Origin: origin as string } },
})

console.log(`kms    ${proxyBaseUrl}`)
console.log(`org    ${organizationId}`)
console.log(`origin ${origin}\n`)

let walletId = existingWalletId

if (walletId) {
  console.log(`reusing wallet ${walletId}`)
} else {
  console.log("creating a wallet (spends 1 of the sub-org's 100)…")
  const created = await client.createServerWallet({ projectId })
  walletId = created.walletId
  console.log(`  ok ${walletId}  ${created.walletAddress}`)
}

const path = `m/44'/60'/0'/0/${index}`
console.log(`\nderiving at ${path}…`)
const derived = await client.createServerWalletAddress({
  projectId,
  walletId,
  path,
})
console.log(`  ok ${derived.walletAddress}  turnkeyId ${derived.turnkeyId}`)

const message = `server wallet bootstrap · ${new Date().toISOString()}`
console.log(`\nsigning as ${derived.walletAddress}…`)
const account = await toViemAccount({
  client,
  organizationId,
  projectId,
  address: derived.walletAddress,
})
const signature = await account.signMessage({ message })

const recovered = await recoverMessageAddress({ message, signature })

if (!isAddressEqual(recovered, derived.walletAddress)) {
  console.log(`  FAIL recovered ${recovered}, which is not the derived address`)
  process.exitCode = 1
} else {
  console.log('  ok recovered to itself')
  console.log(
    '\nPaste into .env, and set the same two as repository secrets:\n',
  )
  console.log(`ZD_SW_WALLET_ID=${walletId}`)
  console.log(`ZD_SW_ADDRESS=${derived.walletAddress}`)
}
