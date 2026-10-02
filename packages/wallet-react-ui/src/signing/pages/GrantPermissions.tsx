import { Callout, DataRow, Section, Text } from '@zerodev/react-ui'
import {
  type ArgRule,
  type ContractCallPermission,
  type Erc7715GrantPermissionsRequest,
  fromErc7715Request,
} from '@zerodev/wallet-react'
import { type AbiFunction, formatEther, isAddress, isAddressEqual } from 'viem'
import { useAccount } from 'wagmi'
import { SigningLayout } from '../components/SigningLayout'

interface GrantPermissionsProps {
  request: Erc7715GrantPermissionsRequest
  confirm: () => void
  reject: () => void
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const CONDITION_TEXT: Record<ArgRule['condition'], string> = {
  equal: 'must be',
  notEqual: 'must not be',
  greaterThan: 'must be more than',
  lessThan: 'must be less than',
  greaterThanOrEqual: 'must be at least',
  lessThanOrEqual: 'must be at most',
  oneOf: 'must be one of',
}

function formatValue(value: unknown, you: string | undefined): string {
  if (typeof value === 'string' && isAddress(value)) {
    return you && isAddressEqual(value, you as `0x${string}`)
      ? 'you'
      : short(value)
  }
  return String(value)
}

/** "mint, _to must be you" — every clause comes from a rule in the request. */
function describeCall(p: ContractCallPermission, you: string | undefined) {
  const fn = p.abi.find(
    (item): item is AbiFunction =>
      item.type === 'function' && item.name === p.functionName,
  )
  const clauses = (p.args ?? []).flatMap((rule, i) => {
    if (!rule) return []
    const name = fn?.inputs[i]?.name?.replace(/^_/, '') || `argument ${i + 1}`
    const value = Array.isArray(rule.value)
      ? rule.value.map((v) => formatValue(v, you)).join(', ')
      : formatValue(rule.value, you)
    return [`${name} ${CONDITION_TEXT[rule.condition]} ${value}`]
  })
  if (p.valueLimit)
    clauses.push(`up to ${formatEther(p.valueLimit)} ETH per call`)
  return [p.functionName, ...clauses].join(', ')
}

function formatExpiry(unixSeconds: number) {
  const ms = unixSeconds * 1000
  const mins = Math.round((ms - Date.now()) / 60_000)
  const when = new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return mins < 120 ? `${when} (in ${mins} min)` : when
}

/**
 * Consent sheet for ERC-7715 `wallet_grantPermissions`. Decodes the request
 * with the same translator the provider uses, so the user approves exactly
 * the policies that will be signed. Who is asking is the page's host, as in a
 * browser wallet.
 */
export function GrantPermissions({
  request,
  confirm,
  reject,
}: GrantPermissionsProps) {
  const { address: you } = useAccount()
  const { signer, permissions, expiry, maxUses } = fromErc7715Request(request)
  const appName =
    typeof window === 'undefined' ? 'This app' : window.location.host
  const unrestricted = permissions.some((p) => p.type === 'sudo')
  const calls = permissions.filter(
    (p): p is ContractCallPermission => p.type === 'contract-call',
  )

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Allow {appName} to act for you</Text>
          <Text className="zd:text-center">
            A key held by {appName} can send transactions from your wallet, only
            within the limits below, until they expire.
          </Text>
        </div>

        {unrestricted && (
          <Callout
            title="No limits"
            description={`${appName} is asking to do anything your wallet can do. Only allow this if you fully trust ${appName}.`}
          />
        )}

        {!unrestricted && (
          <Section title="It can" iconName="keySquare">
            {calls.map((c) => (
              <DataRow
                key={`${c.target}-${c.functionName}`}
                label={c.label ?? short(c.target)}
                value={describeCall(c, you)}
              />
            ))}
          </Section>
        )}

        <Section title="Until" iconName="clock">
          <DataRow label="Expires" value={formatExpiry(expiry)} />
          {maxUses && (
            <DataRow
              label="Uses"
              value={`At most ${maxUses} transaction${maxUses === 1 ? '' : 's'}`}
            />
          )}
        </Section>

        <Section title="Key" iconName="shield">
          <DataRow label="Held by" value={`${appName} · ${short(signer)}`} />
        </Section>
      </div>
    </SigningLayout>
  )
}
