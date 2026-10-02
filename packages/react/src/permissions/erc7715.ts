import {
  type AbiFunction,
  type Address,
  type Hex,
  hexToBigInt,
  isHex,
  numberToHex,
  parseAbiItem,
} from 'viem'
import type {
  ArgRule,
  ContractCallPermission,
  GrantPermissionsParameters,
  SessionPermission,
} from './types.js'

/**
 * ERC-7715 `wallet_grantPermissions` over the wire, as viem's
 * `grantPermissions` (viem/experimental) sends it: custom types are plain
 * strings and amounts are hex.
 *
 * Standard 7715 `contract-call` only lists function signatures. ZeroDev adds:
 * - policy `zerodev-arg-rules`: per-argument rules and a value limit for one call
 * - permission `zerodev-sudo`: everything the account can do (consent must warn)
 */
export const ZERODEV_ARG_RULES = 'zerodev-arg-rules'
export const ZERODEV_SUDO = 'zerodev-sudo'

export type Erc7715Policy =
  | {
      type: typeof ZERODEV_ARG_RULES
      data: {
        /** The call this rule set applies to, as listed in `calls`. */
        call: string
        args?: readonly (ArgRule | null)[]
        valueLimit?: Hex
      }
    }
  | { type: string; data: unknown }

export type Erc7715Permission =
  | {
      type: 'contract-call'
      data: { address: Address; calls: string[]; label?: string }
      policies: Erc7715Policy[]
      required?: boolean
    }
  | {
      type: typeof ZERODEV_SUDO
      data: Record<string, never>
      policies: Erc7715Policy[]
      required?: boolean
    }
  | {
      type: string
      data: unknown
      policies: Erc7715Policy[]
      required?: boolean
    }

export type Erc7715GrantPermissionsRequest = {
  chainId?: Hex
  expiry: number
  signer: { type: 'account'; data: { id: Address } }
  permissions: Erc7715Permission[]
}

export type Erc7715GrantPermissionsResponse = {
  expiry: number
  grantedPermissions: Erc7715Permission[]
  permissionsContext: string
  signerData: { submitToAddress: Address }
  /** ZeroDev extension: the chain the permission was granted on. */
  chainId: Hex
}

// ponytail: flat argument types only; tuple arguments need abitype's formatter.
function toSignature(fn: AbiFunction): string {
  const inputs = fn.inputs
    .map((i) => (i.name ? `${i.type} ${i.name}` : i.type))
    .join(', ')
  return `function ${fn.name}(${inputs})`
}

const isIntType = (type: string) => /^u?int\d*$/.test(type)

function encodeRuleValue(value: unknown): unknown {
  if (typeof value === 'bigint') return numberToHex(value)
  if (Array.isArray(value)) return value.map(encodeRuleValue)
  return value
}

function decodeRuleValue(value: unknown, type: string | undefined): unknown {
  if (Array.isArray(value)) return value.map((v) => decodeRuleValue(v, type))
  if (type && isIntType(type) && isHex(value)) return hexToBigInt(value)
  return value
}

export function toErc7715Request(
  params: GrantPermissionsParameters,
): Erc7715GrantPermissionsRequest {
  return {
    ...(params.chainId && { chainId: numberToHex(params.chainId) }),
    expiry: params.expiry,
    signer: { type: 'account', data: { id: params.signer } },
    permissions: params.permissions.map((p): Erc7715Permission => {
      if (p.type === 'sudo') {
        return { type: ZERODEV_SUDO, data: {}, policies: [], required: true }
      }
      const fn = p.abi.find(
        (item): item is AbiFunction =>
          item.type === 'function' && item.name === p.functionName,
      )
      if (!fn) {
        throw new Error(`grantPermissions: ${p.functionName} is not in the ABI`)
      }
      const call = toSignature(fn)
      const hasRules = Boolean(p.args?.some(Boolean) || p.valueLimit)
      return {
        type: 'contract-call',
        data: {
          address: p.target,
          calls: [call],
          ...(p.label && { label: p.label }),
        },
        policies: hasRules
          ? [
              {
                type: ZERODEV_ARG_RULES,
                data: {
                  call,
                  ...(p.args && {
                    args: p.args.map((rule) =>
                      rule
                        ? ({
                            ...rule,
                            value: encodeRuleValue(rule.value),
                          } as ArgRule)
                        : null,
                    ),
                  }),
                  ...(p.valueLimit && {
                    valueLimit: numberToHex(p.valueLimit),
                  }),
                },
              },
            ]
          : [],
        required: true,
      }
    }),
  }
}

/** Inverse of `toErc7715Request`. Throws on permission or policy types ZeroDev does not support. */
export function fromErc7715Request(
  request: Erc7715GrantPermissionsRequest,
): GrantPermissionsParameters {
  if (request.signer?.type !== 'account') {
    throw new Error(
      "wallet_grantPermissions: only an 'account' signer (the session key's address) is supported",
    )
  }
  const permissions = request.permissions.flatMap((p): SessionPermission[] => {
    if (p.type === ZERODEV_SUDO) return [{ type: 'sudo' as const }]
    if (p.type !== 'contract-call') {
      throw new Error(
        `wallet_grantPermissions: permission type ${p.type} is not supported`,
      )
    }
    const data = p.data as { address: Address; calls: string[]; label?: string }
    const rules = new Map<
      string,
      { args?: readonly (ArgRule | null)[]; valueLimit?: Hex }
    >()
    for (const policy of p.policies) {
      if (policy.type !== ZERODEV_ARG_RULES) {
        throw new Error(
          `wallet_grantPermissions: policy type ${policy.type} is not supported`,
        )
      }
      const d = policy.data as {
        call: string
        args?: readonly (ArgRule | null)[]
        valueLimit?: Hex
      }
      rules.set(d.call, d)
    }
    return data.calls.map((call): ContractCallPermission => {
      const fn = parseAbiItem(call) as AbiFunction
      const rule = rules.get(call)
      return {
        type: 'contract-call',
        target: data.address,
        abi: [fn],
        functionName: fn.name,
        ...(data.label && { label: data.label }),
        ...(rule?.args && {
          args: rule.args.map((r, i) =>
            r
              ? ({
                  ...r,
                  value: decodeRuleValue(r.value, fn.inputs[i]?.type),
                } as ArgRule)
              : null,
          ),
        }),
        ...(rule?.valueLimit && { valueLimit: hexToBigInt(rule.valueLimit) }),
      }
    })
  })
  return {
    signer: request.signer.data.id,
    permissions,
    expiry: request.expiry,
    ...(request.chainId && { chainId: Number.parseInt(request.chainId, 16) }),
  }
}
