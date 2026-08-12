import type { EmailAuthMethod, WalletId } from '@zerodev/wallet-react-ui'

export type UnitType =
  | 'passkey'
  | 'google'
  | 'email'
  | 'wallet'
  | 'walletConnect'
  | 'installedWallets'
  | 'moreWallets'
  | 'divider'

export type PlaygroundItem =
  | {
      key: string
      type: Exclude<UnitType, 'email' | 'wallet' | 'installedWallets'>
    }
  | { key: string; type: 'email'; method: EmailAuthMethod }
  | { key: string; type: 'wallet'; walletId: WalletId }
  | {
      key: string
      type: 'installedWallets'
      /** Raw comma-separated ids — parsed with `parseExcludeIds`. */
      exclude: string
      /** null = untouched → the component's own default (4). */
      maxWallets: number | null
    }

/** SignUp page-level knobs, separate from the unit list. */
export type PlaygroundSettings = {
  termsUrl: string
  privacyUrl: string
}

export const DEFAULT_SETTINGS: PlaygroundSettings = {
  termsUrl: '',
  privacyUrl: '',
}

export const UNIT_DEFS: { type: UnitType; label: string; multi: boolean }[] = [
  { type: 'passkey', label: 'Passkey', multi: false },
  { type: 'google', label: 'Google', multi: false },
  { type: 'email', label: 'Email', multi: false },
  { type: 'wallet', label: 'Pinned wallet', multi: true },
  { type: 'walletConnect', label: 'WalletConnect', multi: false },
  { type: 'installedWallets', label: 'Installed wallets', multi: false },
  { type: 'moreWallets', label: 'More wallets', multi: false },
  { type: 'divider', label: 'Divider', multi: true },
]

// The wallet guide's ids — `WalletId` keeps this list typo-safe against the SDK.
export const PINNED_WALLETS: { id: WalletId; name: string }[] = [
  { id: 'metamask', name: 'MetaMask' },
  { id: 'trust', name: 'Trust Wallet' },
  { id: 'coinbase', name: 'Coinbase Wallet' },
  { id: 'rainbow', name: 'Rainbow' },
  { id: 'rabby', name: 'Rabby Wallet' },
  { id: 'okx', name: 'OKX Wallet' },
  { id: 'zerion', name: 'Zerion' },
  { id: 'uniswap', name: 'Uniswap' },
  { id: 'ledger', name: 'Ledger' },
  { id: 'binance', name: 'Binance Wallet' },
]

export function unitLabel(item: PlaygroundItem): string {
  if (item.type === 'wallet') {
    const wallet = PINNED_WALLETS.find((w) => w.id === item.walletId)
    return wallet ? wallet.name : 'Pinned wallet'
  }
  return UNIT_DEFS.find((d) => d.type === item.type)?.label ?? item.type
}

export function parseExcludeIds(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function emailMethod(
  items: PlaygroundItem[],
): EmailAuthMethod | undefined {
  for (const i of items) {
    if (i.type === 'email') return i.method
  }
  return undefined
}

// Mirrors the composition hardcoded here before the playground existed — the
// browser E2E specs rely on Passkey and Email being present on first load.
export const DEFAULT_ITEMS: PlaygroundItem[] = [
  { key: 'default-passkey', type: 'passkey' },
  { key: 'default-divider', type: 'divider' },
  { key: 'default-google', type: 'google' },
  { key: 'default-email', type: 'email', method: 'otp' },
]

const UNIT_TAG: Record<
  Exclude<UnitType, 'wallet' | 'installedWallets'>,
  string
> = {
  passkey: 'Passkey',
  google: 'Google',
  email: 'Email',
  walletConnect: 'WalletConnect',
  moreWallets: 'MoreWallets',
  divider: 'Divider',
}

function unitLine(item: PlaygroundItem): string {
  if (item.type === 'wallet') {
    return `<SignUp.Wallet walletId="${item.walletId}" />`
  }
  if (item.type === 'installedWallets') {
    const props: string[] = []
    const exclude = parseExcludeIds(item.exclude)
    if (exclude.length > 0) {
      props.push(
        `excludeWalletIds={[${exclude.map((id) => `'${id}'`).join(', ')}]}`,
      )
    }
    if (item.maxWallets !== null) {
      props.push(`maxWallets={${item.maxWallets}}`)
    }
    return `<SignUp.InstalledWallets${props.length > 0 ? ` ${props.join(' ')}` : ''} />`
  }
  return `<SignUp.${UNIT_TAG[item.type]} />`
}

export function buildSnippet(
  items: PlaygroundItem[],
  settings: PlaygroundSettings,
): string {
  const head =
    "import { ConnectWallet, SignUp } from '@zerodev/wallet-react-ui'\n\n"
  if (items.length === 0) {
    return `${head}// No renderSignUp — ConnectWallet falls back to <SignUp.Default />.\n<ConnectWallet\n  size="md"\n/>`
  }
  const rootProps: string[] = []
  const method = emailMethod(items)
  if (method) rootProps.push(`emailAuthMethod="${method}"`)
  if (settings.termsUrl) {
    rootProps.push(`termsAndConditionsUrl="${settings.termsUrl}"`)
  }
  if (settings.privacyUrl) {
    rootProps.push(`privacyPolicyUrl="${settings.privacyUrl}"`)
  }
  const signUpOpen =
    rootProps.length === 0
      ? '<SignUp>'
      : rootProps.length === 1
        ? `<SignUp ${rootProps[0]}>`
        : `<SignUp\n      ${rootProps.join('\n      ')}\n    >`
  const units = items.map((i) => `      ${unitLine(i)}`).join('\n')
  return `${head}<ConnectWallet\n  size="md"\n  renderSignUp={() => (\n    ${signUpOpen}\n${units}\n    </SignUp>\n  )}\n/>`
}

export type SnippetToken = {
  text: string
  kind: 'plain' | 'comment' | 'string' | 'tag' | 'keyword' | 'attr'
}

const TOKEN_RE =
  /(\/\/[^\n]*)|('[^'\n]*'|"[^"\n]*")|(<\/?[A-Za-z][\w.]*)|(\b(?:import|from)\b)|([a-zA-Z]\w*(?==))/g

export function tokenizeSnippet(code: string): SnippetToken[] {
  const tokens: SnippetToken[] = []
  let last = 0
  for (const match of code.matchAll(TOKEN_RE)) {
    if (match.index > last) {
      tokens.push({ text: code.slice(last, match.index), kind: 'plain' })
    }
    const kind = match[1]
      ? 'comment'
      : match[2]
        ? 'string'
        : match[3]
          ? 'tag'
          : match[4]
            ? 'keyword'
            : 'attr'
    tokens.push({ text: match[0], kind })
    last = match.index + match[0].length
  }
  if (last < code.length) {
    tokens.push({ text: code.slice(last), kind: 'plain' })
  }
  return tokens
}
