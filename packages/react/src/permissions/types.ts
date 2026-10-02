import type { Abi, Address } from 'viem'

/** How one function argument is constrained. Mirrors the call policy's conditions. */
export type ArgRule =
  | {
      condition:
        | 'equal'
        | 'notEqual'
        | 'greaterThan'
        | 'lessThan'
        | 'greaterThanOrEqual'
        | 'lessThanOrEqual'
      value: unknown
    }
  | { condition: 'oneOf'; value: readonly unknown[] }

/**
 * Lets the session key call one function on one contract. `args` lines up with
 * the function's inputs; `null` leaves an argument unconstrained.
 */
export type ContractCallPermission = {
  type: 'contract-call'
  target: Address
  abi: Abi
  functionName: string
  args?: readonly (ArgRule | null)[]
  /** Max native value per call, in wei. Defaults to 0. */
  valueLimit?: bigint
  /** Shown to the user instead of the address, e.g. "Rewards Vault". */
  label?: string
}

/** Lets the session key do anything the account can. Consent UIs must warn. */
export type SudoPermission = { type: 'sudo' }

export type SessionPermission = ContractCallPermission | SudoPermission

export type GrantPermissionsParameters = {
  /** The session key's address: a server wallet, or any ECDSA key the app controls. */
  signer: Address
  permissions: readonly SessionPermission[]
  /** Unix seconds after which the session key stops working. */
  expiry: number
  /** Chain the permission is for. Defaults to the connected chain. */
  chainId?: number
}

export type GrantPermissionsReturnType = {
  /**
   * Opaque approval for the session key's holder: the user's enable signature,
   * the policies, and the 7702 authorization when needed. It holds no private
   * key, so it can be stored like any other record.
   */
  permissionsContext: string
  /** The user's smart account the permission is installed on. */
  account: Address
  signer: Address
  chainId: number
  expiry: number
}
